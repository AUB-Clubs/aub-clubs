import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** @deprecated Use `/api/integrations/microsoft/callback` in new Azure redirect URIs. */
export async function GET(request: NextRequest) {
  const u = request.nextUrl.clone();
  u.pathname = "/api/integrations/microsoft/callback";
  return NextResponse.redirect(u);
}
