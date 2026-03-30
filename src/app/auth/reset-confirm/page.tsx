import { Suspense } from "react";
import { ConfirmResetPasswordView } from "@/modules/auth/ui/views/confirm-reset-password-view";

export default function ConfirmResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <ConfirmResetPasswordView />
    </Suspense>
  );
}
