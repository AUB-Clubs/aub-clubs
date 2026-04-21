import type { NextRequest } from "next/server";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

export const E2E_AUTH_SECRET_HEADER = "x-e2e-auth-secret";
export const E2E_AUTH_USER_ID_HEADER = "x-e2e-auth-user-id";
export const E2E_AUTH_SECRET_COOKIE = "e2e_auth_secret";
export const E2E_AUTH_USER_ID_COOKIE = "e2e_auth_user_id";
export const DEFAULT_E2E_USER_ID = "00000000-0000-4000-8000-000000000001";

function isE2eTestMode() {
  return process.env.E2E_TEST_MODE === "true";
}

function isSecretValid(secret: string | undefined) {
  if (!isE2eTestMode()) {
    return false;
  }

  const expected = process.env.E2E_AUTH_SECRET;
  if (!expected) {
    return false;
  }

  return secret === expected;
}

export function getBypassUserIdFromRequest(request: NextRequest) {
  const headerSecret = request.headers.get(E2E_AUTH_SECRET_HEADER) ?? undefined;
  const cookieSecret = request.cookies.get(E2E_AUTH_SECRET_COOKIE)?.value;

  const secret = headerSecret ?? cookieSecret;
  if (!isSecretValid(secret)) {
    return null;
  }

  return (
    request.headers.get(E2E_AUTH_USER_ID_HEADER) ??
    request.cookies.get(E2E_AUTH_USER_ID_COOKIE)?.value ??
    DEFAULT_E2E_USER_ID
  );
}

export function getBypassUserIdFromCookies(cookieStore: ReadonlyRequestCookies) {
  const secret = cookieStore.get(E2E_AUTH_SECRET_COOKIE)?.value;
  if (!isSecretValid(secret)) {
    return null;
  }

  return cookieStore.get(E2E_AUTH_USER_ID_COOKIE)?.value ?? DEFAULT_E2E_USER_ID;
}
