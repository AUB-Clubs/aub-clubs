import { Sparkles } from "lucide-react";
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
      <div className="flex justify-end px-4">
        <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  // ASSISTANT message
  const isComplete = !!message.fragment?.completedAt;

  return (
    <div className="flex gap-3 px-4">
      {/* AI icon */}
      <div className="mt-0.5 shrink-0 flex size-6 items-center justify-center rounded-full bg-gray-100 ring-1 ring-gray-200">
        <Sparkles className="size-3 text-gray-500" />
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2 min-w-0 flex-1">
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
          <p className="text-sm text-gray-700 leading-relaxed">{message.content}</p>
        )}

        {isStreaming && !message.content && chunks.length === 0 && (
          <div className="flex gap-1 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce" />
          </div>
        )}
      </div>
    </div>
  );
}
