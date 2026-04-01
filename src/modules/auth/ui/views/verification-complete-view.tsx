"use client";

import Link from "next/link";
import { MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function VerificationCompleteView() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <MailCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Email Verified</CardTitle>
          <CardDescription>
            Your account has been verified. You can close this tab now.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <Button className="w-full" onClick={() => window.close()}>
              Close Tab
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/auth">Back to Sign In</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
