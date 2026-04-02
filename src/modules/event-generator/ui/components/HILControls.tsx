"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export type HilState =
  | { type: "scale" }
  | { type: "type" }
  | { type: "topic" }
  | { type: "idea"; ideas: string[] }
  | { type: "event_approval" }
  | { type: "email_approval" };

interface Props {
  clubId: string;
  projectId: string;
  hilState: HilState;
}

const SCALE_OPTIONS = ["Small", "Medium", "Large"];
const TYPE_OPTIONS = [
  "Workshop",
  "Conference",
  "Seminar",
  "Social Gathering",
  "Hackathon",
  "Panel Discussion",
];

export default function HILControls({ clubId, projectId, hilState }: Props) {
  const [selected, setSelected] = useState("");
  const [custom, setCustom] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [showEditNotes, setShowEditNotes] = useState(false);
  const [loading, setLoading] = useState(false);

  const post = async (path: string, body: Record<string, unknown>) => {
    setLoading(true);
    try {
      await fetch(`/api/event-generator/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubId, projectId, ...body }),
      });
    } finally {
      setLoading(false);
    }
  };

  const resolvedValue = selected === "custom" ? custom.trim() : selected;

  // ── Scale ─────────────────────────────────────────────────────────────────

  if (hilState.type === "scale") {
    return (
      <HILCard label="Select event scale:">
        <RadioGroup value={selected} onValueChange={setSelected} className="space-y-1.5">
          {SCALE_OPTIONS.map((o) => (
            <div key={o} className="flex items-center gap-2">
              <RadioGroupItem value={o} id={`scale-${o}`} />
              <Label htmlFor={`scale-${o}`} className="font-normal cursor-pointer">
                {o}
              </Label>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <RadioGroupItem value="custom" id="scale-custom" />
            <Label htmlFor="scale-custom" className="font-normal cursor-pointer">
              Custom:
            </Label>
            <Input
              className="h-7 w-44 text-sm"
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
                setSelected("custom");
              }}
              placeholder="Describe scale…"
            />
          </div>
        </RadioGroup>
        <Button
          size="sm"
          disabled={!resolvedValue || loading}
          onClick={() => post("scale-response", { scale: resolvedValue })}
        >
          Confirm
        </Button>
      </HILCard>
    );
  }

  // ── Type ──────────────────────────────────────────────────────────────────

  if (hilState.type === "type") {
    return (
      <HILCard label="Select event type:">
        <RadioGroup value={selected} onValueChange={setSelected} className="space-y-1.5">
          {TYPE_OPTIONS.map((o) => (
            <div key={o} className="flex items-center gap-2">
              <RadioGroupItem value={o} id={`type-${o}`} />
              <Label htmlFor={`type-${o}`} className="font-normal cursor-pointer">
                {o}
              </Label>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <RadioGroupItem value="custom" id="type-custom" />
            <Label htmlFor="type-custom" className="font-normal cursor-pointer">
              Custom:
            </Label>
            <Input
              className="h-7 w-48 text-sm"
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
                setSelected("custom");
              }}
              placeholder="Describe type…"
            />
          </div>
        </RadioGroup>
        <Button
          size="sm"
          disabled={!resolvedValue || loading}
          onClick={() => post("type-response", { type: resolvedValue })}
        >
          Confirm
        </Button>
      </HILCard>
    );
  }

  // ── Topic ─────────────────────────────────────────────────────────────────

  if (hilState.type === "topic") {
    return (
      <HILCard label="What is the event topic?">
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="e.g. Machine Learning, Web Development…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && custom.trim() && !loading) {
              post("topic-response", { topic: custom.trim() });
            }
          }}
        />
        <Button
          size="sm"
          disabled={!custom.trim() || loading}
          onClick={() => post("topic-response", { topic: custom.trim() })}
        >
          Confirm
        </Button>
      </HILCard>
    );
  }

  // ── Idea selection ────────────────────────────────────────────────────────

  if (hilState.type === "idea") {
    return (
      <HILCard label="Select an event idea:">
        <RadioGroup value={selected} onValueChange={setSelected} className="space-y-2">
          {hilState.ideas.map((idea, i) => (
            <div key={i} className="flex items-start gap-2">
              <RadioGroupItem value={idea} id={`idea-${i}`} className="mt-0.5" />
              <Label
                htmlFor={`idea-${i}`}
                className="font-normal leading-snug cursor-pointer"
              >
                {idea}
              </Label>
            </div>
          ))}
          <div className="flex items-start gap-2">
            <RadioGroupItem value="custom" id="idea-custom" className="mt-0.5" />
            <div className="flex-1">
              <Label htmlFor="idea-custom" className="font-normal cursor-pointer">
                Custom idea:
              </Label>
              <Textarea
                className="mt-1 text-sm"
                rows={2}
                value={custom}
                onChange={(e) => {
                  setCustom(e.target.value);
                  setSelected("custom");
                }}
                placeholder="Describe your own event idea…"
              />
            </div>
          </div>
        </RadioGroup>
        <Button
          size="sm"
          disabled={!resolvedValue || loading}
          onClick={() =>
            post("idea-response", { selectedIdea: resolvedValue })
          }
        >
          Confirm
        </Button>
      </HILCard>
    );
  }

  // ── Event approval ────────────────────────────────────────────────────────

  if (hilState.type === "event_approval") {
    return (
      <HILCard label="Review the event report. Approve or request edits?">
        {showEditNotes && (
          <Textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            placeholder="Describe what changes you want…"
            rows={3}
          />
        )}
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={loading}
            onClick={() =>
              post("event-approval", { approved: true, editNotes: "" })
            }
          >
            Approve
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => {
              if (!showEditNotes) {
                setShowEditNotes(true);
                return;
              }
              post("event-approval", { approved: false, editNotes });
            }}
          >
            {showEditNotes ? "Submit Edits" : "Request Edits"}
          </Button>
        </div>
      </HILCard>
    );
  }

  // ── Email approval ────────────────────────────────────────────────────────

  if (hilState.type === "email_approval") {
    return (
      <HILCard label="Review the emails. Approve all or request edits?">
        {showEditNotes && (
          <Textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            placeholder="Describe what changes you want…"
            rows={3}
          />
        )}
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={loading}
            onClick={() =>
              post("email-approval", { approved: true, editNotes: "" })
            }
          >
            Approve All
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => {
              if (!showEditNotes) {
                setShowEditNotes(true);
                return;
              }
              post("email-approval", { approved: false, editNotes });
            }}
          >
            {showEditNotes ? "Submit Edits" : "Request Edits"}
          </Button>
        </div>
      </HILCard>
    );
  }

  return null;
}

// ── Shared wrapper ────────────────────────────────────────────────────────────

function HILCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-background p-4 space-y-3 shadow-sm">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}
