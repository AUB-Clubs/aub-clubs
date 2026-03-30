"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { toast } from "sonner";

import { trpc } from "@/trpc/client";
import { createClient } from "../../lib/supabase-client";

interface AuthCallbackHandlerProps {
  redirectTo?: string;
}

/**
 * AuthCallbackHandler
 *
 * Handles Supabase email verification callbacks.
 * When users click the verification link in their email, Supabase redirects
 * them with hash parameters containing the access token.
 */
export function AuthCallbackHandler({ redirectTo = "/onboarding" }: AuthCallbackHandlerProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const markVerifiedMutation = trpc.auth.markEmailVerified.useMutation();

  useEffect(() => {
    const handleAuthCallback = async () => {
      const supabase = createClient();

      const queryParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));

      const code = queryParams.get("code");
      const tokenHash = queryParams.get("token_hash");
      const otpType = queryParams.get("type") as EmailOtpType | null;
      const accessToken = hashParams.get("access_token");
      const hashType = hashParams.get("type");

      const hasCallbackParams = Boolean(
        code || accessToken || (tokenHash && otpType)
      );

      if (!hasCallbackParams) {
        return;
      }

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            // PKCE verifier not found - link opened in different tab/browser
            if (error.message?.includes("code verifier")) {
              // Redirect to verification complete page - they can close this tab
              router.push("/auth/verified");
              return;
            }
            throw error;
          }
        }

        if (tokenHash && otpType) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType,
          });

          if (error) {
            throw error;
          }
        }

        if (accessToken && hashType && !["signup", "email"].includes(hashType)) {
          return;
        }

        const { data, error } = await supabase.auth.getUser();

        if (error) {
          throw error;
        }

        if (!data.user?.email_confirmed_at) {
          toast.error("Email is not verified yet.");
          return;
        }

        await markVerifiedMutation.mutateAsync();
        await utils.invalidate();

        toast.success("Email verified successfully!");

        window.history.replaceState(null, "", window.location.pathname);
        router.push(redirectTo);
      } catch (error) {
        console.error("Email verification error:", error);
        toast.error("Failed to verify email. Please try again.");
        router.push("/auth");
      }
    };

    handleAuthCallback();
  }, [router, utils, markVerifiedMutation, redirectTo]);

  return null;
}
