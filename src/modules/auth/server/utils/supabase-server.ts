import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getBypassUserIdFromCookies } from "./e2e-auth-bypass";

export async function createClient() {
  const cookieStore = await cookies();

  const bypassUserId = getBypassUserIdFromCookies(cookieStore);
  if (bypassUserId) {
    return {
      auth: {
        async getUser() {
          return {
            data: {
              user: {
                id: bypassUserId,
                email: "e2e-user@aub.test",
              },
            },
            error: null,
          };
        },
      },
    } as const;
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_API_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}
