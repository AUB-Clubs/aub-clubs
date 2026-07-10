import "server-only";

import { prisma } from "@/lib/prisma";
import { encryptSecret } from "./token-crypto";

const TOKEN_PATH = "/oauth2/v2.0/token";
export const MICROSOFT_OAUTH_SCOPES = "offline_access openid profile User.Read Calendars.Read";

function tenantSegment(): string {
  return process.env.MICROSOFT_TENANT ?? process.env.MICROSOFT_TENANT_ID ?? "common";
}

function tokenUrl(): string {
  return `https://login.microsoftonline.com/${tenantSegment()}${TOKEN_PATH}`;
}

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
};

export async function exchangeAuthorizationCode(
  code: string,
  codeVerifier: string
): Promise<TokenResponse> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Microsoft OAuth env vars are not configured");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    scope: MICROSOFT_OAUTH_SCOPES,
  });

  const res = await fetch(tokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = (await res.json()) as TokenResponse & { error?: string; error_description?: string };
  if (!res.ok) {
    throw new Error(json.error_description ?? json.error ?? "Token exchange failed");
  }
  return json;
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Microsoft OAuth env vars are not configured");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(tokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = (await res.json()) as TokenResponse & { error?: string; error_description?: string };
  if (!res.ok) {
    throw new Error(json.error_description ?? json.error ?? "Refresh token failed");
  }
  return json;
}

export type MicrosoftProfile = {
  id: string;
  mail?: string | null;
  userPrincipalName?: string | null;
};

export async function fetchGraphMe(accessToken: string): Promise<MicrosoftProfile> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Graph /me failed: ${res.status} ${t}`);
  }
  return res.json() as Promise<MicrosoftProfile>;
}

export async function persistTokensForUser(params: {
  userId: string;
  tokens: TokenResponse;
  profile?: MicrosoftProfile | null;
}): Promise<void> {
  const { tokens, profile, userId } = params;
  const existingLink = await prisma.userMicrosoftCalendarLink.findUnique({
    where: { userId },
    select: { encryptedRefreshToken: true },
  });
  const encryptedRefresh = tokens.refresh_token
    ? encryptSecret(tokens.refresh_token)
    : existingLink?.encryptedRefreshToken;
  if (!encryptedRefresh) {
    throw new Error("Microsoft did not return a refresh token. Reconnect and accept consent.");
  }
  const expiresAt = new Date(Date.now() + Math.max(0, tokens.expires_in - 60) * 1000);
  const scopes = tokens.scope ?? MICROSOFT_OAUTH_SCOPES;

  await prisma.userMicrosoftCalendarLink.upsert({
    where: { userId },
    create: {
      userId,
      msUserId: profile?.id ?? null,
      accountEmail: profile?.mail ?? profile?.userPrincipalName ?? null,
      encryptedRefreshToken: encryptedRefresh,
      tokenExpiresAt: expiresAt,
      scopes,
    },
    update: {
      msUserId: profile?.id ?? null,
      accountEmail: profile?.mail ?? profile?.userPrincipalName ?? null,
      encryptedRefreshToken: encryptedRefresh,
      tokenExpiresAt: expiresAt,
      scopes,
    },
  });
}
