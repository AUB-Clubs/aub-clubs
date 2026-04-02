import ThinkingAccordion from "./ThinkingAccordion";
import FragmentBadge from "./FragmentBadge";

interface Fragment {
  id: string;
  completedAt: Date | null;
}

interface Message {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string | null;
  fragment?: Fragment | null;
}

interface Props {
  message: Message;
  fragmentNumber?: number;
  chunks: string[];
  isStreaming: boolean;
  activeFragmentId: string | null;
  onFragmentClick: (fragmentId: string) => void;
}

export default function ChatMessage({
  message,
  fragmentNumber,
  chunks,
  isStreaming,
  activeFragmentId,
  onFragmentClick,
}: Props) {
  if (message.role === "USER") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  // ASSISTANT message
  const isComplete = !!message.fragment?.completedAt;

  return (
    <div className="flex flex-col gap-2 max-w-[85%]">
      <ThinkingAccordion chunks={chunks} isComplete={isComplete} />

      {message.fragment && fragmentNumber !== undefined && (
        <FragmentBadge
          fragmentId={message.fragment.id}
          fragmentNumber={fragmentNumber}
          isActive={activeFragmentId === message.fragment.id}
          isGenerating={isStreaming}
          onClick={onFragmentClick}
        />
      )}

      {message.content && (
        <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm leading-relaxed">
          {message.content}
        </div>
      )}

      {isStreaming && !message.content && chunks.length === 0 && (
        <div className="flex gap-1 px-2 py-3">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.3s]" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.15s]" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" />
        </div>
      )}
    </div>
  );
}
