import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { requireBoardMember } from "../_auth";

/**
 * POST /api/event-generator/idea-response
 * Body: { clubId: string, projectId: string, selectedIdea: string }
 */
export async function POST(req: NextRequest) {
  const { clubId, projectId, selectedIdea } = await req.json();

  if (!clubId || !projectId || !selectedIdea) {
    return NextResponse.json(
      { error: "clubId, projectId and selectedIdea are required" },
      { status: 400 }
    );
  }

  const auth = await requireBoardMember(clubId);
  if ("error" in auth) return auth.error;

  await inngest.send({
    name: "event-generator/idea-response",
    data: { clubId, projectId, selectedIdea },
  });

  return NextResponse.json({ ok: true });
}
