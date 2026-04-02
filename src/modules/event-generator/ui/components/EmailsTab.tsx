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

function extractSubject(content: string): string {
  const match = content.match(/subject[:\s]+([^\n]+)/i);
  return match ? match[1].trim() : content.split("\n")[0].trim().slice(0, 60);
}

function extractPreview(content: string): string {
  return content.replace(/subject[:\s]+[^\n]+\n?/i, "").trim().slice(0, 120);
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
      {emails.map((email) => (
        <Card key={email.id} className="overflow-hidden">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <CardTitle className="text-sm font-medium">{email.name}</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground truncate">
                  {extractSubject(email.content)}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
              {extractPreview(email.content)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
