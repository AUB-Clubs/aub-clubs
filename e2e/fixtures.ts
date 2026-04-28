import { test as base } from "@playwright/test";

const E2E_AUTH_SECRET_COOKIE = "e2e_auth_secret";
const E2E_AUTH_USER_ID_COOKIE = "e2e_auth_user_id";
const E2E_AUTH_SECRET_HEADER = "x-e2e-auth-secret";
const E2E_AUTH_USER_ID_HEADER = "x-e2e-auth-user-id";
const DEFAULT_E2E_USER_ID = "00000000-0000-4000-8000-000000000001";

const secret = process.env.E2E_AUTH_SECRET ?? "local-e2e-secret";
const userId = process.env.E2E_AUTH_USER_ID ?? DEFAULT_E2E_USER_ID;

export const test = base.extend({
  context: async ({ context, baseURL }, runFixture) => {
    if (!baseURL) {
      throw new Error("baseURL is required for E2E cookie setup");
    }

    await context.setExtraHTTPHeaders({
      [E2E_AUTH_SECRET_HEADER]: secret,
      [E2E_AUTH_USER_ID_HEADER]: userId,
    });

    await context.addCookies([
      {
        name: E2E_AUTH_SECRET_COOKIE,
        value: secret,
        url: baseURL,
        httpOnly: true,
        sameSite: "Lax",
      },
      {
        name: E2E_AUTH_USER_ID_COOKIE,
        value: userId,
        url: baseURL,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await runFixture(context);
  },
});

export { expect } from "@playwright/test";
