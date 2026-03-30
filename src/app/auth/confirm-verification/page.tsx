import { Suspense } from "react";
import { ConfirmVerificationView } from "@/modules/auth/ui/views/confirm-verification-view";

export default function ConfirmVerificationPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <ConfirmVerificationView />
    </Suspense>
  );
}
