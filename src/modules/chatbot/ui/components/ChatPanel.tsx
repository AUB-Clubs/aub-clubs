'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Plus, Trash2, ChevronLeft, Wrench, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc/client';

type View = 'sessions' | 'chat';

type ChatMessage = {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'TOOL';
  content: string | null;
  toolCalls?: unknown;
  toolName?: string | null;
};

type PendingUserMessage = {
  sessionId: string;
  content: string;
} | null;

type ChatPanelProps = {
  onClose?: () => void;
};

function MessageBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === 'USER';
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground',
        )}
      >
        {content}
      </div>
    </div>
  );
}

function getToolNames(toolCalls: unknown): string[] {
  if (!Array.isArray(toolCalls)) {
    return [];
  }

  const names: string[] = [];
  for (const call of toolCalls) {
    if (typeof call !== 'object' || call === null) {
      continue;
    }

    const type = Reflect.get(call, 'type');
    if (type !== 'function') {
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

  return names;
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
      <div className="w-[92%] min-w-0 rounded-xl border bg-muted/20 px-3 py-1.5">
        <div className="flex h-8 items-center gap-2 text-xs">
          <Badge variant="outline" className="h-6 gap-1 shrink-0">
            <Wrench className="size-3" />
            Tool call
          </Badge>
          <span className="min-w-0 flex-1 truncate text-muted-foreground whitespace-nowrap">
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
      <details className="group w-[92%] min-w-0 rounded-xl border bg-muted/20 px-3 py-1.5 text-xs">
        <summary className="flex h-8 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
          <Badge variant="secondary" className="h-6 gap-1 max-w-40 shrink-0">
            <Wrench className="size-3" />
            <span className="truncate">{toolName ?? 'tool'}</span>
          </Badge>
          <span className="min-w-0 flex-1 truncate text-muted-foreground whitespace-nowrap">
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
  const [pendingUserMessage, setPendingUserMessage] = useState<PendingUserMessage>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isSending = useRef(false);

  const sessionsQuery = trpc.chatbot.listSessions.useQuery();

  const sessionQuery = trpc.chatbot.getSession.useQuery(
    { sessionId: activeSessionId! },
    {
      enabled: !!activeSessionId,
      refetchInterval: isStreaming ? 300 : false,
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
    onSuccess: (_data, variables) => {
      void utils.chatbot.getSession.invalidate({ sessionId: variables.sessionId });
      void utils.chatbot.listSessions.invalidate();
      setPendingUserMessage((current) =>
        current?.sessionId === variables.sessionId ? null : current);
      setIsStreaming(false);
      isSending.current = false;
    },
    onError: () => {
      setPendingUserMessage(null);
      setIsStreaming(false);
      isSending.current = false;
    },
  });

  useEffect(() => {
    if (view === 'chat') {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [sessionQuery.data, isStreaming, view]);

  const openSession = useCallback((id: string) => {
    localStorage.setItem('chatbot_session_id', id);
    setActiveSessionId(id);
    setView('chat');
  }, []);

  const queueSend = useCallback((sessionId: string, content: string) => {
    setPendingUserMessage({ sessionId, content });
    setIsStreaming(true);
    void utils.chatbot.getSession.invalidate({ sessionId });
    sendMessage.mutate({ sessionId, content });
  }, [sendMessage, utils]);

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
      setPendingUserMessage(null);
    }
  }, [draft, activeSessionId, queueSend, createSession]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const dbMessages = (sessionQuery.data?.messages ?? []) as ChatMessage[];
  const pendingForCurrentSession = pendingUserMessage?.sessionId === activeSessionId
    ? pendingUserMessage
    : null;
  const pendingAlreadyPersisted = pendingForCurrentSession
    ? dbMessages.some((m) => m.role === 'USER' && (m.content ?? '') === pendingForCurrentSession.content)
    : false;
  const visibleMessages: ChatMessage[] = pendingForCurrentSession && !pendingAlreadyPersisted
    ? [
      ...dbMessages,
      {
        id: 'pending-user-message',
        role: 'USER',
        content: pendingForCurrentSession.content,
        toolName: null,
        toolCalls: null,
      },
    ]
    : dbMessages;

  const isBusy = sendMessage.isPending || createSession.isPending;

  if (view === 'sessions') {
    const sessions = sessionsQuery.data ?? [];
    return (
      <div className="flex flex-col h-full">
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

        <ScrollArea className="flex-1 px-2 py-2">
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
    <div className="flex min-w-0 flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b">
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
          {sessionQuery.isLoading && !pendingForCurrentSession ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-3/4 rounded-2xl" />
              <Skeleton className="h-8 w-1/2 rounded-2xl ml-auto" />
            </div>
          ) : visibleMessages.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8 px-4">
              Ask me anything about AUB clubs — interests, availability, goals.
            </p>
          ) : (
            visibleMessages.map((m) => {
              if (m.role === 'TOOL') {
                return (
                  <ToolResultBubble
                    key={m.id}
                    toolName={m.toolName}
                    content={m.content}
                  />
                );
              }

              if (m.role === 'ASSISTANT' && !(m.content ?? '').trim()) {
                const toolNames = getToolNames(m.toolCalls);
                if (toolNames.length > 0) {
                  return <ToolInvocationBubble key={`${m.id}-tools`} toolNames={toolNames} />;
                }
                return null;
              }

              return <MessageBubble key={m.id} role={m.role} content={m.content ?? ''} />;
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
