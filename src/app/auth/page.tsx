import { Suspense } from "react";
import { AuthView } from "@/modules/auth/ui/views/auth-view";
import { Spinner } from "@/components/ui/spinner";

export const metadata = {
  title: "Sign In",
};

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Spinner className="size-8" />
        </div>
      }
    >
      <AuthView />
    </Suspense>
  );
}
