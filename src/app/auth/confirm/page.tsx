import { Suspense } from "react";
import { ConfirmEmailView } from "@/modules/auth/ui/views/confirm-email-view";

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <ConfirmEmailView />
    </Suspense>
  );
}
