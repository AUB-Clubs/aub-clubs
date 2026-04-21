import { headers } from "next/headers";
import { NextResponse } from "next/server";

/** @deprecated Use `/api/integrations/microsoft/start` in new Azure redirect URIs. */
export async function GET() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return NextResponse.redirect(`${proto}://${host}/api/integrations/microsoft/start`);
}
