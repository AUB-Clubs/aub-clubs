"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MailCheck, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "../../lib/supabase-client";
import { trpc } from "@/trpc/client";

export function EmailVerificationNotice({ email }: { email?: string | null }) {
  const router = useRouter();
  const [isResending, setIsResending] = useState(false);
  const utils = trpc.useUtils();
  const markVerifiedMutation = trpc.auth.markEmailVerified.useMutation();

  useEffect(() => {
    const supabase = createClient();

    // Listen for auth state changes (email verification)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user.email_confirmed_at) {
        // Update our DB
        try {
          await markVerifiedMutation.mutateAsync();
          await utils.invalidate();
          toast.success("Email verified successfully!");
          router.push("/onboarding");
        } catch (error) {
          toast.error("Failed to verify email. Please try again.");
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, markVerifiedMutation, utils]);

  async function handleResendVerification() {
    setIsResending(true);
    try {
      const supabase = createClient();
      
      // 1. First try email passed via URL prop
      let targetEmail = email;
      
      // 2. Fallback to session storage if URL prop is missing (e.g., after refresh)
      if (!targetEmail && typeof window !== "undefined") {
        targetEmail = sessionStorage.getItem("verification_email");
      }
      
      // 3. Fallback to authenticated session if available
      if (!targetEmail) {
        const { data: { user } } = await supabase.auth.getUser();
        targetEmail = user?.email;
      }

      if (!targetEmail) {
        toast.error("No email found. Please try signing up again.");
        return;
      }

      const { error } = await supabase.auth.resend({
        type: "signup",
        email: targetEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm-verification`,
        },
      });

      // Handle rate limits and errors
      if (error) {
        if (error.message.includes("rate_limit") || error.status === 429) {
          toast.error("Please wait a few minutes before requesting another email.");
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success("Verification email sent! Check your inbox.");
    } catch (error) {
      toast.error("Failed to resend verification email");
    } finally {
      setIsResending(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    // Redirect immediately for better UX
    router.push("/");
    // Sign out and invalidate in background
    supabase.auth.signOut();
    utils.invalidate();
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <MailCheck className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Verify Your Email</CardTitle>
        <CardDescription>
          We&apos;ve sent a verification link to your email address. Please check your inbox and click the link to verify your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center text-sm text-muted-foreground">
          <p>Didn&apos;t receive the email? Check your spam folder or click below to resend.</p>
        </div>
        
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            onClick={handleResendVerification}
            disabled={isResending}
            className="w-full"
          >
            {isResending ? (
              <Spinner className="mr-2 size-4" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Resend Verification Email
          </Button>
          
          <Button variant="ghost" onClick={handleSignOut} className="w-full">
            Sign Out
          </Button>
        </div>

        <div className="text-center text-xs text-muted-foreground">
          <p>This page will automatically redirect once your email is verified.</p>
        </div>
      </CardContent>
    </Card>
  );
}
