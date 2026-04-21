import { Sparkles } from "lucide-react";
import FragmentBadge from "./FragmentBadge";
import { renderMarkdownToHtml } from "../lib/markdown";

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

  const markdownClassName =
    "text-sm text-gray-900 leading-relaxed [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_p]:leading-relaxed [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_td]:border [&_td]:border-gray-300 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-gray-400 [&_th]:bg-gray-100 [&_th]:px-2 [&_th]:py-1 [&_ul]:list-disc [&_ul]:space-y-1";

  return (
    <div className="flex gap-3 px-4">
      {/* AI icon */}
      <div className="mt-0.5 shrink-0 flex size-6 items-center justify-center rounded-full bg-gray-100 ring-1 ring-gray-200">
        <Sparkles className="size-3 text-gray-500" />
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2 min-w-0 flex-1">
        {chunks.length > 0 && (
          <div className="flex flex-col gap-2">
            {chunks.map((chunk, i) => {
              const isLast = i === chunks.length - 1;
              return (
                <div
                  key={i}
                  className="text-sm text-gray-900 leading-relaxed animate-in fade-in slide-in-from-bottom-1 duration-300"
                >
                  <article
                    className={markdownClassName}
                    dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(chunk) }}
                  />
                  {isLast && isStreaming && !message.content && (
                    <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 bg-gray-900 animate-pulse" />
                  )}
                </div>
              );
            })}
          </div>
        )}

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
          <article
            className={markdownClassName}
            dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(message.content) }}
          />
        )}

        {isStreaming && !message.content && chunks.length === 0 && (
          <div className="flex gap-1 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" />
          </div>
        )}
      </div>
    </div>
  );
}
