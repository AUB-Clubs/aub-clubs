import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";

/**
 * POST /api/event-generator/type-response
 * Body: { clubId: string, projectId: string, type: string }
 */
export async function POST(req: NextRequest) {
  const { clubId, projectId, type } = await req.json();

  if (!clubId || !projectId || !type) {
    return NextResponse.json(
      { error: "clubId, projectId and type are required" },
      { status: 400 }
    );
  }

  await inngest.send({
    name: "event-generator/type-response",
    data: { clubId, projectId, type },
  });

  return NextResponse.json({ ok: true });
}
