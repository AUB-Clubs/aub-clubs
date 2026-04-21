import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { requireBoardMember } from "../_auth";

/**
 * POST /api/event-generator/email-approval
 * Body: { clubId: string, projectId: string, approved: boolean, editNotes?: string }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clubId, projectId, approved, editNotes = "" } = body as {
    clubId: string;
    projectId: string;
    approved: boolean;
    editNotes?: string;
  };

  if (!clubId || !projectId) {
    return NextResponse.json(
      { error: "clubId and projectId are required" },
      { status: 400 }
    );
  }

  const auth = await requireBoardMember(clubId);
  if ("error" in auth) return auth.error;

  await inngest.send({
    name: "event-generator/email-approval",
    data: { clubId, projectId, approved, editNotes },
  });

  return NextResponse.json({ ok: true });
}
