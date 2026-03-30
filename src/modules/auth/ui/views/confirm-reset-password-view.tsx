"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { KeyRound, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/modules/auth/lib/supabase-client";
import { toast } from "sonner";

export function ConfirmResetPasswordView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const handleConfirmReset = async () => {
    if (!tokenHash || !type) {
      setError("Missing reset parameters. Please use the link from your email.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const supabase = createClient();

      // Verify the password reset token
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as any,
      });

      if (verifyError) {
        throw new Error(verifyError.message);
      }

      if (!data.session) {
        throw new Error("Failed to establish reset session");
      }

      toast.success("Link verified! Redirecting to password reset...");

      // Redirect to the actual reset password page
      // The session is now established, so the reset page will work
      setTimeout(() => {
        router.push("/reset-password");
      }, 1000);
    } catch (err: any) {
      console.error("Reset verification error:", err);
      const errorMessage = err.message || "Failed to verify reset link. The link may have expired.";
      setError(errorMessage);
      toast.error("Verification failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <KeyRound className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle>Reset Your Password</CardTitle>
          <CardDescription>
            Click the button below to confirm and proceed with resetting your password.
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
            onClick={handleConfirmReset}
            disabled={isProcessing || !tokenHash || !type}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <KeyRound className="mr-2 h-4 w-4" />
                Confirm Password Reset
              </>
            )}
          </Button>

          <div className="text-center text-sm text-muted-foreground space-y-2">
            <p className="text-xs">
              Only click this button if you requested a password reset for your AUB Clubs account.
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
