import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { requireBoardMember } from "../_auth";

/**
 * POST /api/event-generator/scale-response
 * Body: { clubId: string, projectId: string, scale: string }
 */
export async function POST(req: NextRequest) {
  const { clubId, projectId, scale } = await req.json();

  if (!clubId || !projectId || !scale) {
    return NextResponse.json(
      { error: "clubId, projectId and scale are required" },
      { status: 400 }
    );
  }

  const auth = await requireBoardMember(clubId);
  if ("error" in auth) return auth.error;

  await inngest.send({
    name: "event-generator/scale-response",
    data: { clubId, projectId, scale },
  });

  return NextResponse.json({ ok: true });
}
