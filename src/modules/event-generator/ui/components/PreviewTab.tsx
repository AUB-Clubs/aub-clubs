import { Separator } from "@/components/ui/separator";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderInlineMarkdown(input: string): string {
  const escaped = escapeHtml(input);
  return escaped
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function renderMarkdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let paragraphLines: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let listItems: string[] = [];
  let tableRows: string[][] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    html.push(`<p>${renderInlineMarkdown(paragraphLines.join(" "))}</p>`);
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listType || listItems.length === 0) return;
    const items = listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("");
    html.push(`<${listType}>${items}</${listType}>`);
    listType = null;
    listItems = [];
  };

  const flushTable = () => {
    if (tableRows.length === 0) return;

    const isSeparatorRow = (row: string[]) =>
      row.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, "")));

    const hasHeaderSeparator = tableRows.length >= 2 && isSeparatorRow(tableRows[1]);
    const headers = tableRows[0] ?? [];
    const bodyRows = hasHeaderSeparator ? tableRows.slice(2) : tableRows.slice(1);

    const thead =
      headers.length > 0
        ? `<thead><tr>${headers
            .map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`)
            .join("")}</tr></thead>`
        : "";

    const tbody =
      bodyRows.length > 0
        ? `<tbody>${bodyRows
            .map(
              (row) =>
                `<tr>${row
                  .map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`)
                  .join("")}</tr>`
            )
            .join("")}</tbody>`
        : "";

    html.push(`<table>${thead}${tbody}</table>`);
    tableRows = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      flushTable();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      flushTable();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    if (/^\|.*\|$/.test(trimmed)) {
      flushParagraph();
      flushList();
      const cells = trimmed
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim());
      tableRows.push(cells);
      continue;
    }

    if (tableRows.length > 0) {
      flushTable();
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph();
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listItems.push(unorderedMatch[1]);
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listItems.push(orderedMatch[1]);
      continue;
    }

    const quoteMatch = trimmed.match(/^>\s?(.+)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      flushTable();
      html.push(`<blockquote>${renderInlineMarkdown(quoteMatch[1])}</blockquote>`);
      continue;
    }

    flushList();
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();
  flushTable();

  return html.join("\n");
}

interface EventDetails {
  scale: string | null;
  type: string | null;
  topic: string | null;
  selectedIdea: string | null;
}

interface EventReport {
  markdown: string;
}

interface EventSpeaker {
  id: string;
  name: string;
  title: string | null;
  sessionFocus: string | null;
}

interface EventSponsor {
  id: string;
  name: string;
  type: string | null;
  specificContribution: string | null;
}

interface EventBuilding {
  id: string;
  name: string;
  why: string | null;
}

interface FragmentData {
  eventDetails: EventDetails | null;
  eventReport: EventReport | null;
  eventSpeakers: EventSpeaker[];
  eventSponsors: EventSponsor[];
  eventBuildings: EventBuilding[];
}

interface Props {
  fragment: FragmentData;
}

export default function PreviewTab({ fragment }: Props) {
  const { eventDetails, eventReport, eventSpeakers, eventSponsors, eventBuildings } = fragment;

  const isEmpty =
    !eventDetails &&
    !eventReport &&
    eventSpeakers.length === 0 &&
    eventSponsors.length === 0 &&
    eventBuildings.length === 0;

  if (isEmpty) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        No event data yet.
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      {eventDetails && (
        <section className="space-y-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Event Details
          </h3>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {eventDetails.scale && (
              <span className="text-sm">
                <span className="text-muted-foreground">Scale: </span>
                {eventDetails.scale}
              </span>
            )}
            {eventDetails.type && (
              <span className="text-sm">
                <span className="text-muted-foreground">Type: </span>
                {eventDetails.type}
              </span>
            )}
            {eventDetails.topic && (
              <span className="text-sm">
                <span className="text-muted-foreground">Topic: </span>
                {eventDetails.topic}
              </span>
            )}
          </div>
          {eventDetails.selectedIdea && (
            <blockquote className="mt-2 rounded-md border-l-2 bg-muted/40 px-3 py-2 text-sm italic text-muted-foreground">
              "{eventDetails.selectedIdea}"
            </blockquote>
          )}
        </section>
      )}

      {eventReport && (
        <>
          {eventDetails && <Separator />}
          <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Event Report
            </h3>
            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm leading-relaxed">
              <article
                className="space-y-2 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_p]:leading-relaxed [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_td]:border [&_td]:border-muted-foreground/20 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-muted-foreground/30 [&_th]:bg-muted/40 [&_th]:px-2 [&_th]:py-1 [&_ul]:list-disc [&_ul]:space-y-1"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdownToHtml(eventReport.markdown),
                }}
              />
            </div>
          </section>
        </>
      )}

      {eventSpeakers.length > 0 && (
        <>
          <Separator />
          <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Speakers ({eventSpeakers.length})
            </h3>
            <ul className="space-y-2">
              {eventSpeakers.map((s) => (
                <li key={s.id} className="text-sm">
                  <span className="font-medium">{s.name}</span>
                  {s.title && (
                    <span className="text-muted-foreground"> — {s.title}</span>
                  )}
                  {s.sessionFocus && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {s.sessionFocus}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {eventSponsors.length > 0 && (
        <>
          <Separator />
          <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sponsors ({eventSponsors.length})
            </h3>
            <ul className="space-y-2">
              {eventSponsors.map((s) => (
                <li key={s.id} className="text-sm">
                  <span className="font-medium">{s.name}</span>
                  {s.type && (
                    <span className="text-muted-foreground"> ({s.type})</span>
                  )}
                  {s.specificContribution && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {s.specificContribution}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {eventBuildings.length > 0 && (
        <>
          <Separator />
          <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Venues ({eventBuildings.length})
            </h3>
            <ul className="space-y-2">
              {eventBuildings.map((b) => (
                <li key={b.id} className="text-sm">
                  <span className="font-medium">{b.name}</span>
                  {b.why && (
                    <p className="text-xs text-muted-foreground mt-0.5">{b.why}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
