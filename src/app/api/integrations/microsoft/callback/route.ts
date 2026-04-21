import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/modules/auth/server/utils/supabase-server";
import {
  exchangeAuthorizationCode,
  fetchGraphMe,
  persistTokensForUser,
} from "@/modules/calendar/server/microsoft-oauth";

function appOrigin(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!base) {
    throw new Error("NEXT_PUBLIC_APP_URL is not set");
  }
  return base;
}

export async function GET(request: NextRequest) {
  const origin = appOrigin();
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  const errDesc = url.searchParams.get("error_description");

  const clearPkce = (res: NextResponse) => {
    res.cookies.delete("ms_cal_state");
    res.cookies.delete("ms_cal_verifier");
    return res;
  };

  if (err) {
    const msg = encodeURIComponent(errDesc ?? err);
    return clearPkce(NextResponse.redirect(new URL(`/calendar?ms_error=${msg}`, origin)));
  }

  const cookieState = request.cookies.get("ms_cal_state")?.value;
  const verifier = request.cookies.get("ms_cal_verifier")?.value;

  if (!code || !state || !cookieState || !verifier || state !== cookieState) {
    return clearPkce(NextResponse.redirect(new URL("/calendar?ms_error=oauth_state", origin)));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return clearPkce(NextResponse.redirect(new URL("/auth", origin)));
  }

  try {
    const tokens = await exchangeAuthorizationCode(code, verifier);
    const profile = await fetchGraphMe(tokens.access_token);
    await persistTokensForUser({ userId: user.id, tokens, profile });
    return clearPkce(NextResponse.redirect(new URL("/calendar?ms_connected=1", origin)));
  } catch {
    return clearPkce(NextResponse.redirect(new URL("/calendar?ms_error=token", origin)));
  }
}
