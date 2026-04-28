'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Plus, Trash2, ChevronLeft, Wrench, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { renderMarkdownToHtml } from '@/lib/markdown';
import { trpc } from '@/trpc/client';

type View = 'sessions' | 'chat';

type ChatMessage = {
  id: string;
  role: string;
  content: string | null;
  toolCalls?: unknown;
  toolName?: string | null;
};

type ChatPanelProps = {
  onClose?: () => void;
};

type MessageRole = 'USER' | 'ASSISTANT' | 'TOOL';

function normalizeRole(role: string | null | undefined): MessageRole {
  const normalized = (role ?? '').toUpperCase();
  if (normalized === 'USER' || normalized === 'ASSISTANT' || normalized === 'TOOL') {
    return normalized;
  }
  return 'ASSISTANT';
}

function StreamingMessage({ content }: { content: string }) {
  const [displayedContent, setDisplayedContent] = useState(content);

  useEffect(() => {
    if (content === displayedContent) return;

    if (content.length < displayedContent.length || !content.startsWith(displayedContent)) {
      setDisplayedContent(content);
      return;
    }

    const charsToAdd = content.slice(displayedContent.length);
    const delay = Math.max(15, Math.min(40, 1000 / charsToAdd.length));
    
    let currentIndex = displayedContent.length;
    const interval = setInterval(() => {
      currentIndex++;
      setDisplayedContent(content.slice(0, currentIndex));
      if (currentIndex >= content.length) {
        clearInterval(interval);
      }
    }, delay);

    return () => clearInterval(interval);
  }, [content, displayedContent]);

  const markdownClassName =
    'text-sm leading-relaxed break-words [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_p]:leading-relaxed [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:text-xs [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_ul]:list-disc [&_ul]:space-y-1';

  return (
    <article
      className={markdownClassName}
      dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(displayedContent) }}
    />
  );
}

function MessageBubble({ role, content, isStreaming }: { role: string; content: string; isStreaming?: boolean }) {
  const isUser = normalizeRole(role) === 'USER';

  const markdownClassName =
    'text-sm leading-relaxed break-words [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_p]:leading-relaxed [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:text-xs [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_ul]:list-disc [&_ul]:space-y-1';

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[82%] rounded-2xl px-3 py-2 break-words',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground',
        )}
      >
        {isUser ? (
          <span className="text-sm leading-relaxed whitespace-pre-wrap">{content}</span>
        ) : isStreaming ? (
          <StreamingMessage content={content} />
        ) : (
          <article
            className={markdownClassName}
            dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(content) }}
          />
        )}
      </div>
    </div>
  );
}

function getToolNames(toolCalls: unknown): string[] {
  const calls = Array.isArray(toolCalls)
    ? toolCalls
    : typeof toolCalls === 'object' && toolCalls !== null
      ? Array.isArray(Reflect.get(toolCalls, 'calls'))
        ? (Reflect.get(toolCalls, 'calls') as unknown[])
        : Object.values(toolCalls as Record<string, unknown>)
      : [];
  const names: string[] = [];
  for (const call of calls) {
    if (typeof call !== 'object' || call === null) {
      continue;
    }

    const directName = Reflect.get(call, 'name');
    if (typeof directName === 'string' && directName.trim().length > 0) {
      names.push(directName);
      continue;
    }

    const alternateName = Reflect.get(call, 'toolName');
    if (typeof alternateName === 'string' && alternateName.trim().length > 0) {
      names.push(alternateName);
      continue;
    }

    const type = Reflect.get(call, 'type');
    if (typeof type === 'string' && type !== 'function') {
      continue;
    }

    const fn = Reflect.get(call, 'function');
    if (typeof fn !== 'object' || fn === null) {
      continue;
    }

    const name = Reflect.get(fn, 'name');
    if (typeof name === 'string' && name.trim().length > 0) {
      names.push(name);
    }
  }

  return [...new Set(names)];
}

function formatToolContent(content: string | null) {
  if (!content) return '';
  const trimmed = content.trim();
  if (!trimmed) return '';

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return trimmed;
  }
}

function toSingleLine(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function ToolInvocationBubble({ toolNames }: { toolNames: string[] }) {
  if (toolNames.length === 0) return null;
  const toolList = toSingleLine(toolNames.join(', '));

  return (
    <div className="flex w-full min-w-0 justify-start">
      <div className="max-w-[92%] min-w-0 rounded-lg border bg-muted/25 px-3 py-2">
        <div className="flex min-w-0 items-start gap-2 text-xs">
          <Badge
            variant="outline"
            className="h-auto shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium overflow-visible"
          >
            <Wrench className="size-3" />
            Tool call
          </Badge>
          <span className="min-w-0 flex-1 truncate text-muted-foreground leading-5">
            {toolList}
          </span>
        </div>
      </div>
    </div>
  );
}

function ToolResultBubble({ toolName, content }: { toolName?: string | null; content: string | null }) {
  const formatted = formatToolContent(content);
  const previewLine = toSingleLine(formatted);
  const preview = previewLine.length > 180 ? `${previewLine.slice(0, 180)}…` : previewLine;

  return (
    <div className="flex w-full min-w-0 justify-start">
      <details className="group max-w-[92%] min-w-0 rounded-lg border bg-muted/25 px-3 py-2 text-xs">
        <summary className="flex cursor-pointer list-none items-start gap-2 [&::-webkit-details-marker]:hidden">
          <Badge
            variant="secondary"
            className="h-auto max-w-56 shrink-0 rounded-md px-2 py-0.5 overflow-visible"
          >
            <Wrench className="size-3" />
            <span className="truncate">{toolName ?? 'tool'}</span>
          </Badge>
          <span className="min-w-0 flex-1 truncate text-muted-foreground leading-5">
            {preview || 'Tool returned no output.'}
          </span>
        </summary>
        <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-background p-2 text-xs leading-relaxed whitespace-pre-wrap break-words">
          {formatted || 'Tool returned no output.'}
        </pre>
      </details>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-muted rounded-2xl px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
        <Loader2 className="size-3 animate-spin" />
        Working...
      </div>
    </div>
  );
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const utils = trpc.useUtils();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('chatbot_session_id');
    }
    return null;
  });
  const [view, setView] = useState<View>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('chatbot_session_id')) {
      return 'chat';
    }
    return 'sessions';
  });
  const [draft, setDraft] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isSending = useRef(false);
  const [pendingMsg, setPendingMsg] = useState<{ msg: ChatMessage, minCount: number } | null>(null);

  const sessionsQuery = trpc.chatbot.listSessions.useQuery();

  const sessionQuery = trpc.chatbot.getSession.useQuery(
    { sessionId: activeSessionId! },
    {
      enabled: !!activeSessionId,
      refetchInterval: isStreaming ? 1000 : false,
      refetchIntervalInBackground: true,
    },
  );

  const createSession = trpc.chatbot.createSession.useMutation({
    onSuccess: ({ sessionId }) => {
      localStorage.setItem('chatbot_session_id', sessionId);
      setActiveSessionId(sessionId);
      setView('chat');
      void utils.chatbot.listSessions.invalidate();
    },
  });

  const deleteSession = trpc.chatbot.deleteSession.useMutation({
    onSuccess: () => {
      void utils.chatbot.listSessions.invalidate();
    },
  });

  const sendMessage = trpc.chatbot.sendMessage.useMutation({
    onSuccess: (_data, { sessionId }) => {
      setPendingMsg(null);
      void utils.chatbot.getSession.invalidate({ sessionId });
      void utils.chatbot.listSessions.invalidate();
      setIsStreaming(false);
      isSending.current = false;
    },
    onError: () => {
      setPendingMsg(null);
      setIsStreaming(false);
      isSending.current = false;
    },
  });

  useEffect(() => {
    if (view === 'chat') {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [sessionQuery.data?.messages?.length, isStreaming, view]);

  useEffect(() => {
    if (isStreaming && view === 'chat') {
      const interval = setInterval(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isStreaming, view]);

  const openSession = useCallback((id: string) => {
    localStorage.setItem('chatbot_session_id', id);
    setActiveSessionId(id);
    setView('chat');
  }, []);

  const queueSend = useCallback((sessionId: string, content: string) => {
    setPendingMsg({
      msg: {
        id: 'pending-user-message',
        role: 'USER',
        content,
        toolName: null,
        toolCalls: null,
      },
      minCount: (sessionQuery.data?.messages ?? []).length + 1,
    });
    setIsStreaming(true);
    void utils.chatbot.getSession.invalidate({ sessionId });
    sendMessage.mutate({ sessionId, content });
  }, [sendMessage, utils, sessionQuery.data?.messages]);

  const handleSend = useCallback(async () => {
    const content = draft.trim();
    if (!content || isSending.current) return;
    isSending.current = true;
    setDraft('');

    if (activeSessionId) {
      queueSend(activeSessionId, content);
      return;
    }

    try {
      const result = await createSession.mutateAsync({});
      queueSend(result.sessionId, content);
    } catch {
      isSending.current = false;
      setIsStreaming(false);
    }
  }, [draft, activeSessionId, queueSend, createSession]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const dbMessages = (sessionQuery.data?.messages ?? []) as ChatMessage[];
  
  // If we have a pending message, check if the DB has caught up.
  // We expect the DB to have at least `minCount` messages once the user message is saved.
  const pendingInDb = pendingMsg && dbMessages.length >= pendingMsg.minCount;

  const visibleMessages = pendingMsg && !pendingInDb 
    ? [...dbMessages, pendingMsg.msg] 
    : dbMessages;



  const isBusy = sendMessage.isPending || createSession.isPending;

  if (view === 'sessions') {
    const sessions = sessionsQuery.data ?? [];
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
          <span className="font-semibold text-sm">Chats</span>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5"
              onClick={() => createSession.mutate({})}
              disabled={createSession.isPending}
            >
              <Plus className="size-4" />
              New
            </Button>
            {onClose && (
              <Button
                size="icon"
                variant="ghost"
                className="size-8 shrink-0"
                onClick={onClose}
                title="Close chat"
                aria-label="Close chat"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0 px-2 py-2">
          {sessionsQuery.isLoading ? (
            <div className="space-y-2 px-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-muted-foreground text-sm text-center py-8">
              No chats yet. Start one!
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center group rounded-lg hover:bg-muted transition-colors"
                >
                  <button
                    onClick={() => openSession(s.id)}
                    className="flex-1 text-left px-3 py-2.5 text-sm truncate"
                  >
                    {s.title ?? 'New conversation'}
                  </button>
                  <button
                    onClick={() => deleteSession.mutate({ sessionId: s.id })}
                    className="opacity-0 group-hover:opacity-100 p-2 text-muted-foreground hover:text-destructive transition-opacity"
                    aria-label="Delete chat"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-3 border-t">
          <Button
            className="w-full gap-2"
            onClick={() => createSession.mutate({})}
            disabled={createSession.isPending}
          >
            <Plus className="size-4" />
            New chat
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0">
        <Button
          size="icon"
          variant="ghost"
          className="size-8 shrink-0"
          onClick={() => setView('sessions')}
          aria-label="Back to chats"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium truncate flex-1">
          {sessionQuery.data?.session.title ?? 'Club Assistant'}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 shrink-0"
          onClick={() => createSession.mutate({})}
          title="New chat"
          aria-label="New chat"
        >
          <Plus className="size-4" />
        </Button>
        {onClose && (
          <Button
            size="icon"
            variant="ghost"
            className="size-8 shrink-0"
            onClick={onClose}
            title="Close chat"
            aria-label="Close chat"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 min-w-0 px-3 py-3">
        <div className="space-y-3 min-w-0">
          {sessionQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-3/4 rounded-2xl" />
              <Skeleton className="h-8 w-1/2 rounded-2xl ml-auto" />
            </div>
          ) : visibleMessages.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8 px-4">
              Ask me anything about AUB clubs — interests, availability, goals.
            </p>
          ) : (
            visibleMessages.map((m, i) => {
              const normalizedRole = normalizeRole(m.role);
              const isLast = i === visibleMessages.length - 1;
              const isCurrentlyStreaming = isStreaming && isLast && normalizedRole === 'ASSISTANT';

              if (normalizedRole === 'TOOL') {
                return (
                  <ToolResultBubble
                    key={m.id}
                    toolName={m.toolName}
                    content={m.content}
                  />
                );
              }

              if (normalizedRole === 'ASSISTANT') {
                const toolNames = getToolNames(m.toolCalls);
                const hasContent = (m.content ?? '').trim().length > 0;

                if (toolNames.length > 0 && hasContent) {
                  return (
                    <div key={m.id} className="space-y-2">
                      <ToolInvocationBubble toolNames={toolNames} />
                      <MessageBubble role={normalizedRole} content={m.content ?? ''} isStreaming={isCurrentlyStreaming} />
                    </div>
                  );
                }

                if (toolNames.length > 0) {
                  return <ToolInvocationBubble key={`${m.id}-tools`} toolNames={toolNames} />;
                }

                if (!hasContent) return null;
              }

              return <MessageBubble key={m.id} role={normalizedRole} content={m.content ?? ''} isStreaming={isCurrentlyStreaming && normalizedRole === 'ASSISTANT'} />;
            })
          )}
          {isStreaming && <TypingIndicator />}
        </div>
        <div ref={bottomRef} />
      </ScrollArea>

      <div className="p-3 border-t flex gap-2 items-end">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about clubs..."
          className="min-h-[40px] max-h-32 resize-none text-sm"
          rows={1}
          disabled={isBusy}
        />
        <Button
          size="icon"
          onClick={() => void handleSend()}
          disabled={!draft.trim() || isBusy}
          className="shrink-0"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
