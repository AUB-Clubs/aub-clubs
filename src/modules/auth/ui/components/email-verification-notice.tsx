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

export function EmailVerificationNotice() {
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
      const { data: { user } } = await supabase.auth.getUser();

      if (!user?.email) {
        toast.error("No email found");
        return;
      }

      const { error } = await supabase.auth.resend({
        type: "signup",
        email: user.email,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Verification email sent!");
    } catch (error) {
      toast.error("Failed to resend verification email");
    } finally {
      setIsResending(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    await utils.invalidate();
    router.push("/");
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
