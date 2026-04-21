import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { getSubscriptionToken } from "@inngest/realtime";
import { requireBoardMember } from "../_auth";

/**
 * GET /api/event-generator/subscribe-token?clubId=...&projectId=...
 * Returns a short-lived Inngest realtime subscription token for the frontend.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const clubId = searchParams.get("clubId");
  const projectId = searchParams.get("projectId");

  if (!clubId || !projectId) {
    return NextResponse.json(
      { error: "clubId and projectId are required" },
      { status: 400 }
    );
  }

  const auth = await requireBoardMember(clubId);
  if ("error" in auth) return auth.error;

  const token = await getSubscriptionToken(inngest, {
    channel: `club:${clubId}:project:${projectId}`,
    topics: ["ai"],
  });

  return NextResponse.json({ token });
}
