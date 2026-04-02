// ─── Sub-Types ────────────────────────────────────────────────────────────────

export interface EventSpeakerData {
  name: string;
  title: string;
  sessionFocus: string;
  why: string;
}

export interface EventSponsorData {
  name: string;
  type: string;
  specificContribution: string;
  why: string;
}

export interface EventBuildingData {
  name: string;
  why: string;
}

export interface EventEmailData {
  name: string;
  content: string;
}

export interface EventPostData {
  platform: string;
  content: string;
}

// ─── Agent Network State ──────────────────────────────────────────────────────
// Stored in createState<AgentState>() — persists across tool calls within a run.
// Tools read from and write to this state so downstream phases always have
// the latest collected data without re-querying the DB.

export interface AgentState {
  // ── Run metadata ────────────────────────────────────────────────────────────
  projectId: string;
  fragmentId: string | null;
  club: {
    name: string;
    description: string;
    memberSize: number;
  };
  date: string;
  time: string;
  /** Set when agent outputs <task_summary>…</task_summary> — signals network to stop */
  summary: string;

  // ── Phase 1: gathered parameters ────────────────────────────────────────────
  scale: string;
  type: string;
  topic: string;
  selectedIdea: string;

  // ── Phase 2: researched stakeholders ────────────────────────────────────────
  speakers: EventSpeakerData[];
  sponsors: EventSponsorData[];
  buildings: EventBuildingData[];

  // ── Phase 3: event report ────────────────────────────────────────────────────
  report: string;

  // ── Phase 4: outreach emails ─────────────────────────────────────────────────
  emails: EventEmailData[];

  // ── Phase 5: marketing content ───────────────────────────────────────────────
  posts: EventPostData[];
  postImageUrl: string;
}
