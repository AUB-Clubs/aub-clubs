import { NextResponse } from "next/server";
import { createClient } from "@/modules/auth/server/utils/supabase-server";
import { prisma } from "@/lib/prisma";

const BOARD_ROLES = ["BOARD", "VICE_PRESIDENT", "PRESIDENT"] as const;

type BoardRole = (typeof BOARD_ROLES)[number];

/**
 * Verifies the request comes from an authenticated user who is an active
 * board member (BOARD / VICE_PRESIDENT / PRESIDENT) of the given club.
 *
 * Returns `{ error: NextResponse }` on failure, `{ userId: string }` on success.
 */
export async function requireBoardMember(
  clubId: string
): Promise<{ error: NextResponse } | { userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_clubId: { userId: user.id, clubId } },
    select: { role: true, status: true },
  });

  if (
    !membership ||
    membership.status !== "ACCEPTED" ||
    !BOARD_ROLES.includes(membership.role as BoardRole)
  ) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { userId: user.id };
}
