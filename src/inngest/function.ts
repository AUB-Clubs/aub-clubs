import { openai, createAgent, createTool, createNetwork, Message, createState } from "@inngest/agent-kit"
import { inngest } from "./client"
import { lastAssistantTextMessageContent } from "./utils"
import z from "zod"
import { FRAGMENT_TITLE_PROMPT, PROMPT, RESPONSE_PROMPT } from "../prompt"
import { prisma } from "@/lib/prisma"

interface  AgentState {
  summary: string;
}

export const eventFunction = inngest.createFunction(
  {
    id: "event-function",
    triggers: { event: "aub-clubs/generate-event" },
  },
  async ({ event, step }) => {
    const previousMessages = await step.run("get-previous messages", async () => {
      const formattedMessages: Message[] = []

      const messages = await prisma.message.findMany({
        where: {
          projectId: event.data.projectId
        },
        orderBy : {
          createdAt: "desc"
        },
        take: 10
      })

      for (const message of messages) {
        formattedMessages.push({
          type: "text",
          role: message.role === "ASSISTANT" ? "assistant": "user",
          content: message.content
        })
      }

      return formattedMessages.reverse()
    })

    const state = createState<AgentState>(
      {
        summary: "",
      },
      {
        messages:previousMessages,
      }
    )

    const codeAgent = createAgent<AgentState>({
      name: "event-agent",
      description: "An expert event management agent",
      system: PROMPT,
      model: openai({ 
        model: "gpt-5.4"
      }),
      tools :[
        createTool({
          name: "queryRAG",
          description: "Query the vector database for speakers or sponsors related to the project",
          parameters: z.object({
            query: z.string().describe("The search query"),
            type: z.enum(["speakers", "sponsors"]).describe("Which collection to query")
          }),
          handler: async ({query, type}, {step}) => {
            return await step?.run(`ragSearch-${type}`, async () => {
                 const { supabase } = await import("@/lib/RAG/config");
                 const { createEmbedding } = await import("@/lib/RAG/utils");
                 const embedding = await createEmbedding(query);
                 const rpcName = type === "speakers" ? "match_speakers" : "match_sponsors";
                 const { data, error } = await supabase.rpc(rpcName as any, {
                   query_embedding: embedding,
                   match_threshold: 0.5,
                   match_count: 5
                 });
                 if (error) return "Error querying RAG: " + error.message;
                 if (!data || data.length === 0) return "No results found.";
                 return data.map((d: any) => d.content).join("\n\n");
            });
          }
        }),
        createTool({
          name: "webSearch",
          description: "Search the web for real-time information",
          parameters: z.object({
            query: z.string().describe("The search query")
          }),
          handler: async ({query}, {step}) => {
            return await step?.run("web-search", async () => {
              try {
                const cheerio = await import("cheerio");
                const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
                const html = await res.text();
                const $ = cheerio.load(html);
                const results: any[] = [];
                $(".result__body").each((i, el) => {
                  if (i >= 5) return; // Limit to top 5
                  results.push({
                    title: $(el).find(".result__title").text().trim(),
                    snippet: $(el).find(".result__snippet").text().trim(),
                    link: $(el).find(".result__url").text().trim()
                  });
                });
                return JSON.stringify({ results }, null, 2);
              } catch (e: any) {
                return "Web search failed: " + e.message;
              }
            });
          }
        }),
        createTool({
          name: "getEventsThisSemester",
          description: "Get all the events in JSON that were done this semester",
          parameters: z.object({}),
          handler: async (_, {step}) => {
            return await step?.run("get-events", async () => {
              try {
                const events = await prisma.event.findMany({
                   orderBy: { startsAt: "asc" },
                   include: { club: { select: { title: true } } },
                   take: 100
                });
                return JSON.stringify(events, null, 2);
              } catch (e: any) {
                return "Failed to fetch events: " + e.message;
              }
            });
          }
        })
      ], 
      lifecycle: {
        onResponse: async ({result, network}) => {
          const lastAssistantMessageText = 
            lastAssistantTextMessageContent(result)
          if (lastAssistantMessageText && network) {
            if (lastAssistantMessageText.includes("<task_summary>")) {
              network.state.data.summary = lastAssistantMessageText
            }
          }
          return result
        }
      }
    })

    const network = createNetwork<AgentState>({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: 15,
      defaultState: state,
      router: async ({network}) => {
        const summary = network.state.data.summary

        if (summary) {
          return
        }

        return codeAgent
      }
    })

    const result = await network.run(event.data.value, {state})

    const fragmentTitleGenerator = createAgent({
      name:"fragment-title-generator",
      description: "A fragment title generator",
      system: FRAGMENT_TITLE_PROMPT,
      model: openai({
        model: "gpt-5-nano"
      })
    })

    const responseGenerator = createAgent({
      name:"response-generator",
      description: "A response generator",
      system: RESPONSE_PROMPT,
      model: openai({
        model: "gpt-5-nano"
      })
    })

    const {output: fragmentTitleOutput} = await fragmentTitleGenerator.run(result.state.data.summary) 
    const {output: responseOutput} = await responseGenerator.run(result.state.data.summary)

    const generateFragmentTitle = () => {
      if (fragmentTitleOutput[0].type !== "text") {
        return "Fragment"
      }

      if (Array.isArray(fragmentTitleOutput[0].content)) {
        return fragmentTitleOutput[0].content.map((txt)=> txt).join("")
      } else {
        return fragmentTitleOutput[0].content
      }
    }

    const generateResponse = () => {
      if (responseOutput[0].type !== "text") {
        return "Fragment"
      }

      if (Array.isArray(responseOutput[0].content)) {
        return responseOutput[0].content.map((txt)=> txt).join("")
      } else {
        return responseOutput[0].content
      }
    }

    const isError = 
      !result.state.data.summary

    await step.run("save-result", async () =>{

      if (isError) {
        return await prisma.message.create({
          data: {
            projectId: event.data.projectId,
            content: "Something went wrong. Please try again.",
            role: "ASSISTANT",
            type: "ERROR"
          }
        })
      }

      return await prisma.message.create({
        data: {
          projectId: event.data.projectId,
          role: "ASSISTANT",
          type: "RESULT",
          content: generateResponse(),
          fragment: {
            create:{
              title: generateFragmentTitle(),
              eventOutput: result.state.data.summary.replaceAll("<task_summary>", "").replaceAll("</task_summary>", ""),
            }
          }
        }
      })
    })

    return {
      title: generateFragmentTitle(),
      summary: result.state.data.summary.replaceAll("<task_summary>", "").replaceAll("</task_summary>", ""),
    }
  },
)
