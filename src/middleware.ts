import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  // Get authenticated user - use getUser() for security
  // This authenticates the data by contacting the Supabase Auth server
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ─────────────────────────────────────────────────────────────────────
  // PUBLIC ROUTES: Allow without authentication
  // ─────────────────────────────────────────────────────────────────────
  if (
    pathname === "/" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/reset-password")
  ) {
    // If user is fully authenticated and tries to access auth pages, redirect to /me
    if (user && pathname.startsWith("/auth")) {
      // Check if there's a verify query param - if so, let them through to see verification notice
      const verifyParam = request.nextUrl.searchParams.get("verify");
      if (!verifyParam) {
        // Fetch user status to determine where to redirect
        // We can't call tRPC here, so we'll let the auth page handle the redirect
        // This is a soft redirect - the auth page will check status and redirect if needed
      }
    }
    return response;
  }

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
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|api/trpc|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
