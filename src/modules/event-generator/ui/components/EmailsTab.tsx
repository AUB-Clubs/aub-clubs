import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail } from "lucide-react";

interface EventEmail {
  id: string;
  name: string;
  content: string;
}

interface Props {
  emails: EventEmail[];
}

function parseEmail(content: string): { subject: string; body: string } {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\\n/g, "\n").trim();
  const lines = normalized.split("\n");
  const subjectLineIndex = lines.findIndex((line) => /^subject\s*:/i.test(line));

  if (subjectLineIndex === -1) {
    return {
      subject: lines[0]?.trim() || "No subject",
      body: normalized,
    };
  }

  const subjectLine = lines[subjectLineIndex] ?? "";
  const subject = subjectLine.replace(/^subject\s*:/i, "").trim() || "No subject";
  const body = lines
    .filter((_, index) => index !== subjectLineIndex)
    .join("\n")
    .trim();

  return { subject, body };
}

export default function EmailsTab({ emails }: Props) {
  if (emails.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        No emails generated yet.
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {emails.map((email) => {
        const parsed = parseEmail(email.content);
        return (
          <Card key={email.id} className="overflow-hidden">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-sm font-medium">{email.name}</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Subject: {parsed.subject}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <pre className="whitespace-pre-wrap break-words text-xs font-sans leading-relaxed text-muted-foreground">
                {parsed.body || parsed.subject}
              </pre>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
