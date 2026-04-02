"use client";

import { useState, useEffect, useRef } from "react";
import { subscribe } from "@inngest/realtime";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { SendHorizontal } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import ChatMessage from "./components/ChatMessage";
import FragmentViewer from "./components/FragmentViewer";
import HILControls, { type HilState } from "./components/HILControls";
import MobileBlockScreen from "./components/MobileBlockScreen";

// ─── Types ────────────────────────────────────────────────────────────────────

type RealtimeEvent =
  | { type: "fragment_started"; fragmentId: string; clubId: string; projectId: string }
  | { type: "chunk"; messageId: string; text: string; clubId: string; projectId: string }
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

export default function EventGeneratorPage({ clubId, projectId }: Props) {
  const utils = trpc.useUtils();

  // Core tRPC data
  const { data: project } = trpc.eventGenerator.projects.get.useQuery({ projectId });
  const {
    data: messages = [],
    isLoading: messagesLoading,
    refetch: refetchMessages,
  } = trpc.eventGenerator.messages.list.useQuery({ projectId });

  // UI state
  const [activeFragmentId, setActiveFragmentId] = useState<string | null>(null);
  const [streamingFragmentId, setStreamingFragmentId] = useState<string | null>(null);
  const [chunksByMessage, setChunksByMessage] = useState<Record<string, string[]>>({});
  const [hilState, setHilState] = useState<HilState | null>(null);
  const [inputValue, setInputValue] = useState("");

  // Ref so the subscription closure always sees the latest streaming fragment
  const streamingFragmentIdRef = useRef<string | null>(null);
  const setStreaming = (id: string | null) => {
    streamingFragmentIdRef.current = id;
    setStreamingFragmentId(id);
  };

  // Bottom-of-chat scroll ref
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Send message mutation ─────────────────────────────────────────────────

  const sendMutation = trpc.eventGenerator.messages.send.useMutation({
    onSuccess: () => {
      setInputValue("");
      refetchMessages();
    },
  });

  // ── Rehydrate HIL + active fragment from project flags on mount ───────────

  useEffect(() => {
    if (!project) return;

    if (project.isAwaitingEventScale) setHilState({ type: "scale" });
    else if (project.isAwaitingEventType) setHilState({ type: "type" });
    else if (project.isAwaitingEventTopic) setHilState({ type: "topic" });
    else if (project.isAwaitingIdeaSelection) setHilState({ type: "idea", ideas: [] });
    else if (project.isAwaitingEventApproval) setHilState({ type: "event_approval" });
    else if (project.isAwaitingEmailApproval) setHilState({ type: "email_approval" });
  }, [project]);

  // ── Set initial active + streaming fragment from message history ──────────

  useEffect(() => {
    if (messages.length === 0) return;

    // Find last fragment (most recent)
    for (let i = messages.length - 1; i >= 0; i--) {
      const frag = messages[i].fragment;
      if (!frag) continue;

      if (!activeFragmentId) setActiveFragmentId(frag.id);

      // If incomplete, mark as streaming so FragmentViewer polls
      if (!frag.completedAt) {
        setStreaming(frag.id);
      }
      break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // ── Also hydrate existing chunks for incomplete messages ──────────────────

  // (Chunks are fetched lazily per-message; for rehydration we rely on the
  //  existing DB chunks via a separate query per incomplete message if needed.
  //  For simplicity, ThinkingAccordion only shows live-streamed chunks from
  //  this session — reloads show no accordion for past messages.)

  // ── Realtime subscription ─────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    let reader: ReadableStreamDefaultReader | null = null;

    const run = async () => {
      const res = await fetch(
        `/api/event-generator/subscribe-token?clubId=${clubId}&projectId=${projectId}`
      );
      if (cancelled) return;

      const { token } = await res.json();
      const stream = await subscribe(token);
      reader = stream.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done || cancelled) break;

        const data = value?.data as RealtimeEvent | undefined;
        if (!data?.type) continue;

        switch (data.type) {
          case "fragment_started":
            setStreaming(data.fragmentId);
            setActiveFragmentId(data.fragmentId);
            await refetchMessages();
            break;

          case "chunk":
            setChunksByMessage((prev) => ({
              ...prev,
              [data.messageId]: [...(prev[data.messageId] ?? []), data.text],
            }));
            break;

          case "fragment_update":
            // FragmentViewer polls every 3s while generating — but also
            // invalidate immediately so it refetches without waiting for the interval
            if (streamingFragmentIdRef.current) {
              utils.eventGenerator.fragments.get.invalidate({
                fragmentId: streamingFragmentIdRef.current,
              });
            }
            break;

          case "awaiting_event_scale":
            setHilState({ type: "scale" });
            break;

          case "awaiting_event_type":
            setHilState({ type: "type" });
            break;

          case "awaiting_event_topic":
            setHilState({ type: "topic" });
            break;

          case "awaiting_idea_selection":
            setHilState({ type: "idea", ideas: data.ideas ?? [] });
            break;

          case "awaiting_event_approval":
            setHilState({ type: "event_approval" });
            break;

          case "awaiting_email_approval":
            setHilState({ type: "email_approval" });
            break;

          case "hil_completed":
            setHilState(null);
            break;

          case "fragment_completed":
            setStreaming(null);
            await refetchMessages();
            break;
        }
      }
    };

    run().catch(console.error);

    return () => {
      cancelled = true;
      reader?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, projectId]);

  // ── Auto-scroll to bottom on new messages ────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, Object.keys(chunksByMessage).length]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const handleSend = () => {
    const value = inputValue.trim();
    if (!value || sendMutation.isPending || hilState) return;
    sendMutation.mutate({ projectId, value });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Build fragment number map (messages with fragments, in order)
  const fragmentNumberMap = new Map(
    messages
      .filter((m): m is typeof m & { fragment: NonNullable<typeof m.fragment> } => !!m.fragment)
      .map((m, i) => [m.fragment.id, i + 1])
  );

  const isBlocked = !!hilState || sendMutation.isPending;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Left pane: Chat ─────────────────────────────────────────────── */}
      <div className="flex w-1/2 flex-col border-r">
        <ScrollArea className="flex-1 px-4 py-4">
          <div className="space-y-4">
            {messagesLoading ? (
              <>
                <Skeleton className="h-10 w-48 ml-auto" />
                <Skeleton className="h-16 w-64" />
              </>
            ) : (
              messages.map((message) => (
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
              <HILControls
                clubId={clubId}
                projectId={projectId}
                hilState={hilState}
              />
            )}

            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t p-3 flex items-end gap-2">
          <Textarea
            className="min-h-[40px] max-h-32 resize-none flex-1 text-sm"
            placeholder={
              hilState
                ? "Respond to the request above…"
                : "Type a message… (Enter to send)"
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
            className="shrink-0"
          >
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Right pane: Workspace ────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
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
