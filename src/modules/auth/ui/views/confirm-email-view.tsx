"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MailCheck, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/modules/auth/lib/supabase-client";
import { toast } from "sonner";
import { trpc } from "@/trpc/client";

export function ConfirmEmailView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const markVerifiedMutation = trpc.auth.markEmailVerified.useMutation();

  const handleVerification = async () => {
    if (!tokenHash || !type) {
      setError("Missing verification parameters. Please use the link from your email.");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const supabase = createClient();

      // Verify the OTP token hash with Supabase
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as any,
      });

      if (verifyError) {
        throw new Error(verifyError.message);
      }

      if (!data.user) {
        throw new Error("Verification failed - no user returned");
      }

      // Update our database to mark email as verified
      await markVerifiedMutation.mutateAsync();

      setSuccess(true);
      toast.success("Email verified successfully!");

      // Redirect to onboarding after a brief delay
      setTimeout(() => {
        router.push("/onboarding");
      }, 1500);
    } catch (err: any) {
      console.error("Verification error:", err);
      const errorMessage = err.message || "Failed to verify email. The link may have expired.";
      setError(errorMessage);
      toast.error("Verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <CardTitle>Email Verified!</CardTitle>
            <CardDescription>
              Your email has been successfully verified. Redirecting you to complete your profile...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <MailCheck className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle>Confirm Your Email</CardTitle>
          <CardDescription>
            Click the button below to verify your email address and activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleVerification}
            disabled={isVerifying || !tokenHash || !type}
            className="w-full"
            size="lg"
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <MailCheck className="mr-2 h-4 w-4" />
                Verify My Email
              </>
            )}
          </Button>

          <div className="text-center text-sm text-muted-foreground space-y-2">
            <p className="text-xs">
              Only click this button if you just signed up for an AUB Clubs account.
            </p>
          </div>

          <div className="text-center pt-2">
            <Button variant="link" asChild>
              <a href="/auth">Back to Sign In</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
