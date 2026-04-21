"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { subscribe } from "@inngest/realtime";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, SendHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import ChatMessage from "./components/ChatMessage";
import FragmentViewer from "./components/FragmentViewer";
import HILControls, { type HilState } from "./components/HILControls";

// ─── Types ────────────────────────────────────────────────────────────────────

type RealtimeEvent =
  | { type: "fragment_started"; fragmentId: string; clubId: string; projectId: string }
  | {
      type: "chunk";
      messageId: string;
      text: string;
      sequence?: number;
      chunkId?: string;
      clubId: string;
      projectId: string;
    }
  | { type: "fragment_update"; updateType: string; payload: unknown; clubId: string; projectId: string }
  | { type: "awaiting_event_scale"; clubId: string; projectId: string }
  | { type: "awaiting_event_type"; clubId: string; projectId: string }
  | { type: "awaiting_event_topic"; clubId: string; projectId: string }
  | { type: "awaiting_idea_selection"; ideas: string[]; clubId: string; projectId: string }
  | { type: "awaiting_event_approval"; clubId: string; projectId: string }
  | { type: "awaiting_email_approval"; clubId: string; projectId: string }
  | { type: "hil_completed"; hilType: string; clubId: string; projectId: string }
  | { type: "fragment_completed"; fragmentId: string; clubId: string; projectId: string };

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  clubId: string;
  projectId: string;
}

interface MessageChunkData {
  id: string;
  response: string;
  sequence: number;
  createdAt: Date;
}

interface MessageData {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string | null;
  fragment?: {
    id: string;
    completedAt: Date | null;
  } | null;
  chunks?: MessageChunkData[];
}

const EMPTY_MESSAGES: MessageData[] = [];

export default function EventGeneratorPage({ clubId, projectId }: Props) {
  const utils = trpc.useUtils();
  const router = useRouter();

  // Core tRPC data
  const { data: project } = trpc.eventGenerator.projects.get.useQuery({ projectId });
  const {
    data: messagesData,
    isLoading: messagesLoading,
    refetch: refetchMessages,
  } = trpc.eventGenerator.messages.list.useQuery({ projectId });
  const messages = (messagesData ?? EMPTY_MESSAGES) as MessageData[];

  // UI state
  const [activeFragmentId, setActiveFragmentId] = useState<string | null>(null);
  const [streamingFragmentId, setStreamingFragmentId] = useState<string | null>(null);
  const [chunksByMessage, setChunksByMessage] = useState<Record<string, string[]>>({});
  const [hilState, setHilState] = useState<HilState | null>(null);
  const [isHilPendingSubmission, setIsHilPendingSubmission] = useState(false);
  const [optimisticMessage, setOptimisticMessage] = useState<MessageData | null>(null);
  const [inputValue, setInputValue] = useState("");

  // Whether the agent is currently running (controls the single realtime subscription)
  const [isAgentActive, setIsAgentActiveState] = useState(false);
  const isAgentActiveRef = useRef(false);
  const initialMessagesCheckDoneRef = useRef(false);

  const setAgentActive = useCallback((active: boolean) => {
    isAgentActiveRef.current = active;
    setIsAgentActiveState(active);
  }, []);

  const ideaOptionsStorageKey = `event-generator:idea-options:${projectId}`;

  // Ref so the subscription closure always sees the latest streaming fragment
  const streamingFragmentIdRef = useRef<string | null>(null);
  const lastChunkSequenceRef = useRef<Record<string, number>>({});
  const pendingHilStateRef = useRef<HilState | null>(null);
  const hilRestoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setStreaming = (id: string | null) => {
    streamingFragmentIdRef.current = id;
    setStreamingFragmentId(id);
  };

  // Bottom-of-chat scroll ref
  const bottomRef = useRef<HTMLDivElement>(null);

  const clearStoredIdeaOptions = useCallback(() => {
    try {
      localStorage.removeItem(ideaOptionsStorageKey);
    } catch {
      // ignore localStorage access failures
    }
  }, [ideaOptionsStorageKey]);

  const readStoredIdeaOptions = useCallback((): string[] => {
    try {
      const raw = localStorage.getItem(ideaOptionsStorageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((idea): idea is string => typeof idea === "string" && idea.trim().length > 0)
        : [];
    } catch {
      return [];
    }
  }, [ideaOptionsStorageKey]);

  const persistIdeaOptions = useCallback(
    (ideas: string[]) => {
      try {
        localStorage.setItem(ideaOptionsStorageKey, JSON.stringify(ideas));
      } catch {
        // ignore localStorage access failures
      }
    },
    [ideaOptionsStorageKey]
  );

  const clearHilRestoreTimer = useCallback(() => {
    if (hilRestoreTimerRef.current) {
      clearTimeout(hilRestoreTimerRef.current);
      hilRestoreTimerRef.current = null;
    }
    pendingHilStateRef.current = null;
    setIsHilPendingSubmission(false);
  }, []);

  // ── Send message mutation ─────────────────────────────────────────────────

  const sendMutation = trpc.eventGenerator.messages.send.useMutation({
    onSuccess: async (createdMessage) => {
      setInputValue("");
      setOptimisticMessage((prev) =>
        prev
          ? {
              ...prev,
              id: createdMessage.id,
              content: createdMessage.content,
              role: createdMessage.role,
            }
          : {
              id: createdMessage.id,
              role: createdMessage.role,
              content: createdMessage.content,
              fragment: null,
              chunks: [],
            }
      );
      await refetchMessages();
      setOptimisticMessage(null);
    },
    onError: () => {
      setOptimisticMessage(null);
    },
  });

  // ── Rehydrate HIL + active fragment from project flags on mount ───────────

  useEffect(() => {
    if (!project) return;

    const isAwaitingAnything =
      project.isAwaitingEventScale ||
      project.isAwaitingEventType ||
      project.isAwaitingEventTopic ||
      project.isAwaitingIdeaSelection ||
      project.isAwaitingEventApproval ||
      project.isAwaitingEmailApproval;

    if (pendingHilStateRef.current) {
      if (!isAwaitingAnything) {
        clearHilRestoreTimer();
        clearStoredIdeaOptions();
        setHilState(null);
      }
      return;
    }

    if (project.isAwaitingEventScale) {
      setHilState((prev) => (prev?.type === "scale" ? prev : { type: "scale" }));
      return;
    }
    if (project.isAwaitingEventType) {
      setHilState((prev) => (prev?.type === "type" ? prev : { type: "type" }));
      return;
    }
    if (project.isAwaitingEventTopic) {
      setHilState((prev) => (prev?.type === "topic" ? prev : { type: "topic" }));
      return;
    }
    if (project.isAwaitingIdeaSelection) {
      setHilState((prev) => {
        if (prev?.type === "idea") {
          return prev;
        }
        return { type: "idea", ideas: readStoredIdeaOptions() };
      });
      return;
    }
    if (project.isAwaitingEventApproval) {
      setHilState((prev) =>
        prev?.type === "event_approval" ? prev : { type: "event_approval" }
      );
      return;
    }
    if (project.isAwaitingEmailApproval) {
      setHilState((prev) =>
        prev?.type === "email_approval" ? prev : { type: "email_approval" }
      );
      return;
    }

    clearHilRestoreTimer();
    clearStoredIdeaOptions();
    setHilState(null);
  }, [project, readStoredIdeaOptions, clearStoredIdeaOptions, clearHilRestoreTimer]);

  // ── Set initial active + streaming fragment from message history ──────────

  useEffect(() => {
    if (messages.length === 0) {
      if (streamingFragmentIdRef.current !== null) {
        setStreaming(null);
      }
      return;
    }

    // Find last fragment (most recent)
    let foundIncomplete = false;
    for (let i = messages.length - 1; i >= 0; i--) {
      const frag = messages[i].fragment;
      if (!frag) continue;

      if (!activeFragmentId) setActiveFragmentId(frag.id);

      // If incomplete, mark as streaming so FragmentViewer polls
      if (!frag.completedAt) {
        foundIncomplete = true;
        setStreaming(frag.id);
      }
      break;
    }

    if (!foundIncomplete) {
      setStreaming(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // ── Hydrate persisted message chunks for durable refresh behavior ─────────

  useEffect(() => {
    if (messages.length === 0) {
      setChunksByMessage((prev) =>
        Object.keys(prev).length === 0 ? prev : {}
      );
      lastChunkSequenceRef.current = {};
      return;
    }

    setChunksByMessage((prev) => {
      let didChange = false;
      const next = { ...prev };
      const messageIds = new Set(messages.map((message) => message.id));

      for (const messageId of Object.keys(next)) {
        if (!messageIds.has(messageId)) {
          delete next[messageId];
          delete lastChunkSequenceRef.current[messageId];
          didChange = true;
        }
      }

      for (const message of messages) {
        if (!message.chunks || message.chunks.length === 0) continue;

        const persistedChunks = message.chunks
          .slice()
          .sort((a, b) => a.sequence - b.sequence)
          .map((chunk) => chunk.response);

        const maxSequence = message.chunks.reduce(
          (max, chunk) => (chunk.sequence > max ? chunk.sequence : max),
          0
        );
        lastChunkSequenceRef.current[message.id] = maxSequence;

        const current = next[message.id] ?? [];
        const isSame =
          current.length === persistedChunks.length &&
          current.every((chunk, index) => chunk === persistedChunks[index]);

        if (isSame) continue;

        next[message.id] = persistedChunks;
        didChange = true;
      }

      return didChange ? next : prev;
    });
  }, [messages]);

  // ── On initial messages load: activate subscription if agent is mid-run ───

  useEffect(() => {
    if (messagesLoading || initialMessagesCheckDoneRef.current) return;
    initialMessagesCheckDoneRef.current = true;

    if (messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];

    // Agent hasn't responded yet
    if (lastMsg.role === "USER") {
      setAgentActive(true);
      return;
    }

    if (lastMsg.role === "ASSISTANT") {
      // Agent just started (placeholder created, no fragment yet)
      if (!lastMsg.content && !lastMsg.fragment) {
        setAgentActive(true);
        return;
      }
      // Agent is mid-run (fragment exists but not completed)
      if (lastMsg.fragment && !lastMsg.fragment.completedAt) {
        setAgentActive(true);
        return;
      }
    }
  }, [messages, messagesLoading, setAgentActive]);

  // ── Realtime subscription ─────────────────────────────────────────────────

  useEffect(() => {
    if (!isAgentActive) return;

    let cancelled = false;
    let reader: ReadableStreamDefaultReader | null = null;

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      });

    const handleRealtimeEvent = async (data: RealtimeEvent) => {
      switch (data.type) {
        case "fragment_started":
          setStreaming(data.fragmentId);
          setActiveFragmentId(data.fragmentId);
          await refetchMessages();
          break;

        case "chunk":
          setChunksByMessage((prev) => {
            const existing = prev[data.messageId] ?? [];
            const latestSequence = lastChunkSequenceRef.current[data.messageId] ?? 0;

            if (typeof data.sequence === "number") {
              if (data.sequence <= latestSequence) {
                return prev;
              }
              lastChunkSequenceRef.current[data.messageId] = data.sequence;
            }

            if (existing[existing.length - 1] === data.text) {
              return prev;
            }
            return {
              ...prev,
              [data.messageId]: [...existing, data.text],
            };
          });
          break;

        case "fragment_update":
          if (streamingFragmentIdRef.current) {
            utils.eventGenerator.fragments.get.invalidate({
              fragmentId: streamingFragmentIdRef.current,
            });
          }
          break;

        case "awaiting_event_scale":
          clearHilRestoreTimer();
          setHilState((prev) => (prev?.type === "scale" ? prev : { type: "scale" }));
          break;

        case "awaiting_event_type":
          clearHilRestoreTimer();
          setHilState((prev) => (prev?.type === "type" ? prev : { type: "type" }));
          break;

        case "awaiting_event_topic":
          clearHilRestoreTimer();
          setHilState((prev) => (prev?.type === "topic" ? prev : { type: "topic" }));
          break;

        case "awaiting_idea_selection": {
          clearHilRestoreTimer();
          const ideas = (data.ideas ?? []).filter((idea) => idea.trim().length > 0);
          const nextIdeas = ideas.length > 0 ? ideas : readStoredIdeaOptions();

          if (nextIdeas.length > 0) {
            persistIdeaOptions(nextIdeas);
          }

          setHilState((prev) => {
            if (
              prev?.type === "idea" &&
              prev.ideas.length === nextIdeas.length &&
              prev.ideas.every((idea, index) => idea === nextIdeas[index])
            ) {
              return prev;
            }

            return {
              type: "idea",
              ideas: nextIdeas,
            };
          });
          break;
        }

        case "awaiting_event_approval":
          clearHilRestoreTimer();
          setHilState((prev) =>
            prev?.type === "event_approval" ? prev : { type: "event_approval" }
          );
          break;

        case "awaiting_email_approval":
          clearHilRestoreTimer();
          setHilState((prev) =>
            prev?.type === "email_approval" ? prev : { type: "email_approval" }
          );
          break;

        case "hil_completed":
          clearHilRestoreTimer();
          clearStoredIdeaOptions();
          setHilState(null);
          break;

        case "fragment_completed":
          setStreaming(null);
          setAgentActive(false);
          await refetchMessages();
          break;
      }
    };

    const run = async () => {
      while (!cancelled) {
        try {
          const res = await fetch(
            `/api/event-generator/subscribe-token?clubId=${clubId}&projectId=${projectId}`
          );
          if (!res.ok) {
            throw new Error(`Failed to get subscription token (${res.status})`);
          }
          if (cancelled) return;

          const { token } = await res.json();
          const stream = await subscribe(token);
          reader = stream.getReader();

          while (!cancelled) {
            const { done, value } = await reader.read();
            if (done || cancelled) break;

            const data = value?.data as RealtimeEvent | undefined;
            if (!data?.type) continue;
            await handleRealtimeEvent(data);
          }
        } catch (error) {
          if (!cancelled) {
            console.error("Event generator realtime subscription error:", error);
          }
        } finally {
          try {
            await reader?.cancel();
          } catch {
            // ignore cancellation errors
          }
          reader = null;
        }

        if (!cancelled) {
          await sleep(1500);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      void reader?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, projectId, isAgentActive]);

  // ── Auto-scroll to bottom on new messages ────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, Object.keys(chunksByMessage).length]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const handleSend = () => {
    const value = inputValue.trim();
    if (
      !value ||
      isAgentActive ||
      sendMutation.isPending ||
      hilState ||
      isHilPendingSubmission
    ) {
      return;
    }

    setOptimisticMessage({
      id: `optimistic-${Date.now()}`,
      role: "USER",
      content: value,
      fragment: null,
      chunks: [],
    });

    setAgentActive(true);
    sendMutation.mutate({ projectId, value });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleHilOptimisticSubmit = useCallback((submittedState: HilState) => {
    if (hilRestoreTimerRef.current) {
      clearTimeout(hilRestoreTimerRef.current);
    }

    pendingHilStateRef.current = submittedState;
    setIsHilPendingSubmission(true);
    setHilState(null);

    hilRestoreTimerRef.current = setTimeout(() => {
      setHilState((current) => current ?? pendingHilStateRef.current);
      pendingHilStateRef.current = null;
      hilRestoreTimerRef.current = null;
      setIsHilPendingSubmission(false);
    }, 30000);
  }, []);

  const handleHilSubmissionFailed = useCallback(() => {
    if (hilRestoreTimerRef.current) {
      clearTimeout(hilRestoreTimerRef.current);
      hilRestoreTimerRef.current = null;
    }

    setHilState((current) => current ?? pendingHilStateRef.current);
    pendingHilStateRef.current = null;
    setIsHilPendingSubmission(false);
  }, []);

  useEffect(() => {
    return () => {
      if (hilRestoreTimerRef.current) {
        clearTimeout(hilRestoreTimerRef.current);
      }
    };
  }, []);

  // Build fragment number map (messages with fragments, in order)
  const fragmentNumberMap = new Map(
    messages
      .filter((m): m is typeof m & { fragment: NonNullable<typeof m.fragment> } => !!m.fragment)
      .map((m, i) => [m.fragment.id, i + 1])
  );

  const isAwaitingHilResolution = isHilPendingSubmission;
  const isBlocked =
    isAgentActive || !!hilState || isAwaitingHilResolution || sendMutation.isPending;
  const messagesForRender =
    optimisticMessage && !messages.some((message) => message.id === optimisticMessage.id)
      ? [...messages, optimisticMessage]
      : messages;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* ── Left pane: Chat ─────────────────────────────────────────────── */}
      <div className="flex w-[40%] min-w-[560px] min-h-0 flex-col border-r">
        <div className="flex h-14 items-center justify-between border-b px-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/clubs/${clubId}/admin?section=event-generator`)}
          >
            <ArrowLeft className="mr-1 size-4" />
            Back to projects
          </Button>
          {project?.name ? (
            <p className="line-clamp-1 max-w-[45%] text-right text-sm text-muted-foreground">
              {project.name}
            </p>
          ) : null}
        </div>

        <ScrollArea className="flex-1 min-h-0 py-4">
          <div className="space-y-5">
            {messagesLoading ? (
              <>
                <div className="flex justify-end px-4">
                  <Skeleton className="h-10 w-48" />
                </div>
                <div className="flex gap-3 px-4">
                  <Skeleton className="size-6 rounded-full shrink-0" />
                  <Skeleton className="h-16 w-64" />
                </div>
              </>
            ) : (
              messagesForRender.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  fragmentNumber={
                    message.fragment
                      ? fragmentNumberMap.get(message.fragment.id)
                      : undefined
                  }
                  chunks={chunksByMessage[message.id] ?? []}
                  isStreaming={
                    message.fragment?.id === streamingFragmentId
                  }
                  activeFragmentId={activeFragmentId}
                  onFragmentClick={setActiveFragmentId}
                />
              ))
            )}

            {hilState && (
              <div className="px-4">
                <HILControls
                  clubId={clubId}
                  projectId={projectId}
                  hilState={hilState}
                  onOptimisticSubmit={handleHilOptimisticSubmit}
                  onSubmissionFailed={handleHilSubmissionFailed}
                />
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t p-3 flex items-end gap-2">
          <Textarea
            className="min-h-[40px] max-h-32 resize-none flex-1 text-sm"
            placeholder={
              isAgentActive
                ? "Agent is generating…"
                : hilState || isAwaitingHilResolution
                ? "Respond to the request above…"
                : "What would you like to do?"
            }
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isBlocked}
            rows={1}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={isBlocked || !inputValue.trim()}
            className="shrink-0 rounded-full"
          >
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Right pane: Workspace ────────────────────────────────────────── */}
      <div className="flex w-[60%] min-h-0 flex-col overflow-hidden">
        {activeFragmentId ? (
          <FragmentViewer fragmentId={activeFragmentId} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center px-8">
            <p className="text-sm font-medium text-muted-foreground">
              No fragment selected
            </p>
            <p className="text-xs text-muted-foreground">
              Start a conversation to generate event data. Fragments will appear
              here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
