import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";

/**
 * POST /api/event-generator/topic-response
 * Body: { clubId: string, projectId: string, topic: string }
 */
export async function POST(req: NextRequest) {
  const { clubId, projectId, topic } = await req.json();

  if (!clubId || !projectId || !topic) {
    return NextResponse.json(
      { error: "clubId, projectId and topic are required" },
      { status: 400 }
    );
  }

  await inngest.send({
    name: "event-generator/topic-response",
    data: { clubId, projectId, topic },
  });

  return NextResponse.json({ ok: true });
}
