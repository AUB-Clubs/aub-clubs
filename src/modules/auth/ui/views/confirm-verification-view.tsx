"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MailCheck, Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/modules/auth/lib/supabase-client";
import { toast } from "sonner";
import { trpc } from "@/trpc/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ConfirmVerificationView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasParams, setHasParams] = useState(false);

  const markVerifiedMutation = trpc.auth.markEmailVerified.useMutation();

  useEffect(() => {
    // Check if we have the necessary verification parameters
    const queryParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));

    const code = queryParams.get("code");
    const tokenHash = queryParams.get("token_hash");
    const accessToken = hashParams.get("access_token");

    if (code || tokenHash || accessToken) {
      setHasParams(true);
    } else {
      setError("No verification parameters found. Please use the link from your email.");
    }
  }, []);

  const handleVerifyClick = async () => {
    setIsVerifying(true);
    setError(null);

    try {
      const supabase = createClient();

      const queryParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));

      const code = queryParams.get("code");
      const tokenHash = queryParams.get("token_hash");
      const otpType = queryParams.get("type") as "signup" | "email_change" | null;
      const accessToken = hashParams.get("access_token");
      const hashType = hashParams.get("type");

      // Handle PKCE code exchange
      if (code) {
        const { error: codeError } = await supabase.auth.exchangeCodeForSession(code);
        
        if (codeError) {
          // Check if it's a code verifier mismatch (opened in different browser)
          if (codeError.message?.includes("code verifier")) {
            toast.info("Please verify in the same browser where you signed up.");
            router.push("/auth/verified");
            return;
          }
          throw codeError;
        }
      }

      // Handle OTP token hash verification
      if (tokenHash && otpType) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType,
        });
        
        if (otpError) throw otpError;
      }

      // Handle hash-based access token (older method)
      if (accessToken && hashType === "signup") {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: hashParams.get("refresh_token") || "",
        });
        
        if (sessionError) throw sessionError;
      }

      // Verify the user is now authenticated and email is confirmed
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        throw new Error("User not found after verification");
      }

      if (!user.email_confirmed_at) {
        throw new Error("Email not yet confirmed. Please try again.");
      }

      // Update our database to mark email as verified
      await markVerifiedMutation.mutateAsync();

      toast.success("Email verified successfully!");
      
      // Redirect to onboarding or dashboard
      router.push("/onboarding");
    } catch (err: any) {
      console.error("Verification error:", err);
      setError(err.message || "Failed to verify email. Please try again or contact support.");
      toast.error("Verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <MailCheck className="h-12 w-12 text-primary" />
          </div>
          <CardTitle>Confirm Email Verification</CardTitle>
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
            onClick={handleVerifyClick}
            disabled={isVerifying || !hasParams}
            className="w-full"
            size="lg"
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify My Email"
            )}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            <p>This extra step helps prevent automated email scanners from accidentally verifying your account.</p>
          </div>

          <div className="text-center">
            <Button variant="link" asChild>
              <a href="/auth">Back to Sign In</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
