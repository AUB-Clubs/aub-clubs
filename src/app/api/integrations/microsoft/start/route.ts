import { randomBytes, createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { createClient } from "@/modules/auth/server/utils/supabase-server";
import { MICROSOFT_OAUTH_SCOPES } from "@/modules/calendar/server/microsoft-oauth";

function appOrigin(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!base) {
    throw new Error("NEXT_PUBLIC_APP_URL is not set");
  }
  return base;
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/auth", appOrigin()));
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      return NextResponse.redirect(
        new URL("/calendar?ms_error=config", appOrigin())
      );
    }

    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const state = randomBytes(24).toString("hex");

    const tenant = process.env.MICROSOFT_TENANT ?? process.env.MICROSOFT_TENANT_ID ?? "common";
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      response_mode: "query",
      scope: MICROSOFT_OAUTH_SCOPES,
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "consent",
    });

    const authorizeUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
    const res = NextResponse.redirect(authorizeUrl);
    const maxAge = 600;
    res.cookies.set("ms_cal_state", state, cookieOptions(maxAge));
    res.cookies.set("ms_cal_verifier", verifier, cookieOptions(maxAge));
    return res;
  } catch {
    const fallback = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
    return NextResponse.redirect(new URL("/calendar?ms_error=start", fallback));
  }
}
