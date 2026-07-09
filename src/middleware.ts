import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getBypassUserIdFromRequest } from "@/modules/auth/server/utils/e2e-auth-bypass";

/**
 * Next.js Middleware for Route Protection
 *
 * Route Guards:
 * | Route              | Auth | Email Verified | Onboarding Complete |
 * |--------------------|------|----------------|---------------------|
 * | `/`                | ❌   | ❌             | ❌                  |
 * | `/auth`            | ❌   | ❌             | ❌                  |
 * | `/reset-password`  | ❌   | ❌             | ❌                  |
 * | `/onboarding`      | ✅   | ✅             | ❌                  |
 * | `/(main)/*`        | ✅   | ✅             | ✅                  |
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Create a response that we can modify
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // ─────────────────────────────────────────────────────────────────────
  // PUBLIC ROUTES: Allow without authentication
  // ─────────────────────────────────────────────────────────────────────
  if (
    pathname === "/" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/reset-password")
  ) {
    return response;
  }

  const bypassUserId = getBypassUserIdFromRequest(request);
  if (bypassUserId) {
    return response;
  }

  // Create Supabase client for middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_API_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ─────────────────────────────────────────────────────────────────────
  // PROTECTED ROUTES: Require authentication
  // ─────────────────────────────────────────────────────────────────────

  // Not authenticated → redirect to /auth
  if (!user) {
    const redirectUrl = new URL("/auth", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // ─────────────────────────────────────────────────────────────────────
  // ONBOARDING ROUTE: Requires auth + email verified
  // ─────────────────────────────────────────────────────────────────────
  if (pathname.startsWith("/onboarding")) {
    // User is authenticated, allow access to onboarding
    // The onboarding page itself will check if onboarding is already complete
    // and redirect to /me if so
    return response;
  }

  // ─────────────────────────────────────────────────────────────────────
  // MAIN APP ROUTES: Requires auth + email verified + onboarding complete
  // Note: Detailed checks are handled by tRPC middleware and page components
  // The middleware ensures basic authentication, pages handle the rest
  // ─────────────────────────────────────────────────────────────────────

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/trpc (tRPC API routes)
     * - api/inngest (Inngest API routes)
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|api/trpc|api/inngest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
