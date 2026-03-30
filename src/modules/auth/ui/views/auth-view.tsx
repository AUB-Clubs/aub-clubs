"use client";

import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthTabs } from "../components/auth-tabs";
import { EmailVerificationNotice } from "../components/email-verification-notice";

export function AuthView() {
  const searchParams = useSearchParams();
  const showVerification = searchParams.get("verify") === "true";

  if (showVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <EmailVerificationNotice />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to AUB Clubs</CardTitle>
          <CardDescription>
            Sign in to your account or create a new one
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthTabs />
        </CardContent>
      </Card>
    </div>
  );
}
