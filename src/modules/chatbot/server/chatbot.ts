import 'server-only';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import type OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { createTRPCRouter } from '@/trpc/init';
import { protectedProcedure } from '@/modules/auth/server/middleware';
import { getMcpClient, resetMcpClient } from './mcpClient';
import { getOpenAI, getModel } from './openai';

const SYSTEM_PROMPT = `You are a club discovery assistant for AUB Clubs, helping students at the American University of Beirut find clubs that match their interests, availability, and goals.

Use the provided tools to ground every claim about clubs, events, or announcements — never invent club names, events, or details. If the tools return no results, say so directly instead of guessing.

A good flow:
1. If the student mentions interests, call list_club_categories first (or rely on prior knowledge if you've already seen it this session) to map their words to category values.
2. Call list_clubs with relevant types and/or a free-text query.
3. If list_clubs returns empty, call list_recent_announcements and list_recent_events before replying so you can still share what is currently happening.
4. For promising candidates, call get_club for full details, list_club_meetings if the student mentioned scheduling constraints, and list_club_posts/list_recent_announcements to gauge how active the club is.

When recommending, cite real club titles from tool results, briefly explain why each is a good fit for the student's stated interests/goals/availability, and list at most 3-5 recommendations unless the student asks for more.
For broad requests (for example "nice clubs"), proactively provide concrete options instead of only asking follow-up questions whenever tool data is available.`;

const MAX_TOOL_LOOPS = 6;

type DBMessage = {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'TOOL';
  content: string | null;
  toolCalls: unknown;
  toolCallId: string | null;
  toolName: string | null;
  createdAt: Date;
};

function dbMessagesToOpenAI(
  messages: DBMessage[],
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const out: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  for (const m of messages) {
    if (m.role === 'USER') {
      out.push({ role: 'user', content: m.content ?? '' });
    } else if (m.role === 'ASSISTANT') {
      const toolCalls = m.toolCalls as
        | OpenAI.Chat.Completions.ChatCompletionMessageToolCall[]
        | null;
      if (toolCalls && toolCalls.length > 0) {
        out.push({
          role: 'assistant',
          content: m.content ?? null,
          tool_calls: toolCalls,
        });
      } else {
        out.push({ role: 'assistant', content: m.content ?? '' });
      }
    } else if (m.role === 'TOOL') {
      out.push({
        role: 'tool',
        tool_call_id: m.toolCallId ?? '',
        content: m.content ?? '',
      });
    }
  }
  return out;
}

async function getOpenAITools(): Promise<OpenAI.Chat.Completions.ChatCompletionTool[]> {
  const mcp = await getMcpClient();
  const { tools } = await mcp.listTools();
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description ?? '',
      parameters: (t.inputSchema as Record<string, unknown>) ?? { type: 'object', properties: {} },
    },
  }));
}

async function callMcpTool(name: string, args: unknown): Promise<string> {
  const mcp = await getMcpClient();
  const result = await mcp.callTool({
    name,
    arguments: (args ?? {}) as Record<string, unknown>,
  });
  const content = (result.content ?? []) as Array<{ type: string; text?: string }>;
  const text = content
    .filter((c) => c.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text!)
    .join('\n');
  return text || JSON.stringify(result);
}

async function generateTitle(firstUserMessage: string): Promise<string | null> {
  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: getModel(),
      messages: [
        {
          role: 'system',
          content:
            'You generate a 3-6 word title summarizing the user message. Reply with the title only, no quotes, no punctuation at the end.',
        },
        { role: 'user', content: firstUserMessage.slice(0, 500) },
      ],
    });
    const title = completion.choices[0]?.message?.content?.trim();
    if (!title) return null;
    return title.replace(/^["']|["']$/g, '').slice(0, 80);
  } catch {
    return null;
  }
}

async function ensureOwnSession(sessionId: string, userId: string) {
  const session = await prisma.chatbotSession.findUnique({
    where: { id: sessionId },
  });
  if (!session || session.userId !== userId) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Chat session not found' });
  }
  return session;
}

type ToolCallAccumulator = {
  id: string;
  name: string;
  args: string;
};

type StreamedAssistantTurn = {
  content: string;
  toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
};

function buildToolCalls(
  toolCallMap: Map<number, ToolCallAccumulator>,
): OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] {
  return [...toolCallMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, value]) => value)
    .filter((value) => value.id.trim().length > 0 && value.name.trim().length > 0)
    .map((value) => ({
      id: value.id,
      type: 'function',
      function: {
        name: value.name,
        arguments: value.args || '{}',
      },
    }));
}

async function streamAssistantTurn(params: {
  openai: OpenAI;
  model: string;
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  tools: OpenAI.Chat.Completions.ChatCompletionTool[];
  onContent: (content: string) => Promise<void>;
}): Promise<StreamedAssistantTurn> {
  const stream = await params.openai.chat.completions.create({
    model: params.model,
    messages: params.messages,
    tools: params.tools,
    tool_choice: 'auto',
    stream: true,
  });

  const toolCallMap = new Map<number, ToolCallAccumulator>();
  let content = '';

  for await (const chunk of stream) {
    const choice = chunk.choices[0];
    if (!choice) continue;

    const delta = choice.delta;
    if (typeof delta.content === 'string' && delta.content.length > 0) {
      content += delta.content;
      await params.onContent(content);
    }

    for (const toolCallDelta of delta.tool_calls ?? []) {
      const index = typeof toolCallDelta.index === 'number' ? toolCallDelta.index : 0;
      const current = toolCallMap.get(index) ?? { id: '', name: '', args: '' };

      if (typeof toolCallDelta.id === 'string' && toolCallDelta.id.length > 0) {
        current.id = toolCallDelta.id;
      }

      const fn = toolCallDelta.function;
      if (fn) {
        if (typeof fn.name === 'string' && fn.name.length > 0) {
          if (current.name.length === 0 || fn.name.startsWith(current.name)) {
            current.name = fn.name;
          } else if (!current.name.endsWith(fn.name)) {
            current.name += fn.name;
          }
        }
        if (typeof fn.arguments === 'string' && fn.arguments.length > 0) {
          current.args += fn.arguments;
        }
      }

      toolCallMap.set(index, current);
    }
  }

  return {
    content,
    toolCalls: buildToolCalls(toolCallMap),
  };
}

export const chatbotRouter = createTRPCRouter({
  listSessions: protectedProcedure.query(async ({ ctx }) => {
    const sessions = await prisma.chatbotSession.findMany({
      where: { userId: ctx.userId! },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
      take: 50,
    });
    return sessions;
  }),

  getSession: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const session = await ensureOwnSession(input.sessionId, ctx.userId!);
      const messages = await prisma.chatbotMessage.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: 'asc' },
      });
      return { session, messages };
    }),

  createSession: protectedProcedure
    .input(z.object({}).optional())
    .mutation(async ({ ctx }) => {
      const session = await prisma.chatbotSession.create({
        data: { userId: ctx.userId! },
        select: { id: true },
      });
      return { sessionId: session.id };
    }),

  deleteSession: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ensureOwnSession(input.sessionId, ctx.userId!);
      await prisma.chatbotSession.delete({ where: { id: input.sessionId } });
      return { ok: true };
    }),

  sendMessage: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        content: z.string().min(1).max(4000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const session = await ensureOwnSession(input.sessionId, ctx.userId!);

      const isFirstUserMessage =
        (await prisma.chatbotMessage.count({
          where: { sessionId: session.id, role: 'USER' },
        })) === 0;

      await prisma.chatbotMessage.create({
        data: {
          sessionId: session.id,
          role: 'USER',
          content: input.content,
        },
      });

      let openaiTools: OpenAI.Chat.Completions.ChatCompletionTool[];
      try {
        openaiTools = await getOpenAITools();
      } catch (err) {
        await resetMcpClient();
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Could not reach the clubs data service. Please try again.',
          cause: err,
        });
      }

      const history = await prisma.chatbotMessage.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: 'asc' },
      });

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...dbMessagesToOpenAI(history as DBMessage[]),
      ];

      const openai = getOpenAI();
      const model = getModel();

      let finalAssistant: { content: string } | null = null;

      for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
        const assistantMessage = await prisma.chatbotMessage.create({
          data: {
            sessionId: session.id,
            role: 'ASSISTANT',
            content: null,
          },
          select: { id: true },
        });

        let persistedContent = '';
        let lastFlushAt = 0;
        const flushContent = async (nextContent: string, force: boolean) => {
          if (nextContent === persistedContent) return;
          const now = Date.now();
          const reachedInterval = now - lastFlushAt >= 220;
          const reachedCharDelta = nextContent.length - persistedContent.length >= 36;
          if (!force && !reachedInterval && !reachedCharDelta) return;

          await prisma.chatbotMessage.update({
            where: { id: assistantMessage.id },
            data: { content: nextContent },
          });
          persistedContent = nextContent;
          lastFlushAt = now;
        };

        const streamedTurn = await streamAssistantTurn({
          openai,
          model,
          messages,
          tools: openaiTools,
          onContent: async (partialContent) => {
            await flushContent(partialContent, false);
          },
        });

        await flushContent(streamedTurn.content, true);

        if (streamedTurn.toolCalls.length > 0) {
          const assistantContent = streamedTurn.content.trim().length > 0
            ? streamedTurn.content
            : null;
          await prisma.chatbotMessage.update({
            where: { id: assistantMessage.id },
            data: {
              content: assistantContent,
              toolCalls: streamedTurn.toolCalls as unknown as object,
            },
          });
          messages.push({
            role: 'assistant',
            content: assistantContent,
            tool_calls: streamedTurn.toolCalls,
          });

          for (const tc of streamedTurn.toolCalls) {
            if (tc.type !== 'function') continue;
            let parsedArgs: unknown = {};
            try {
              parsedArgs = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
            } catch {
              parsedArgs = {};
            }
            let toolText: string;
            try {
              toolText = await callMcpTool(tc.function.name, parsedArgs);
            } catch (err) {
              toolText = `Error calling tool ${tc.function.name}: ${
                err instanceof Error ? err.message : String(err)
              }`;
              await resetMcpClient();
            }
            await prisma.chatbotMessage.create({
              data: {
                sessionId: session.id,
                role: 'TOOL',
                content: toolText,
                toolCallId: tc.id,
                toolName: tc.function.name,
              },
            });
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: toolText,
            });
          }
          continue;
        }

        const assistantContent = streamedTurn.content;
        await prisma.chatbotMessage.update({
          where: { id: assistantMessage.id },
          data: { content: assistantContent },
        });
        finalAssistant = { content: assistantContent };
        break;
      }

      if (!finalAssistant) {
        const fallback = "I wasn't able to finish that thought — could you rephrase?";
        await prisma.chatbotMessage.create({
          data: {
            sessionId: session.id,
            role: 'ASSISTANT',
            content: fallback,
          },
        });
        finalAssistant = { content: fallback };
      }

      await prisma.chatbotSession.update({
        where: { id: session.id },
        data: { updatedAt: new Date() },
      });

      if (isFirstUserMessage && !session.title) {
        const title = await generateTitle(input.content);
        if (title) {
          await prisma.chatbotSession.update({
            where: { id: session.id },
            data: { title },
          });
        }
      }

      return { content: finalAssistant.content };
    }),
});
