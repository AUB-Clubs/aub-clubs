import { redirect } from "next/navigation";
import { createClient } from "@/modules/auth/server/utils/supabase-server";
import { prisma } from "@/lib/prisma";
import { MainLayoutClient } from "./layout-client";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Not authenticated → redirect to /auth
  if (!session) {
    redirect("/auth");
  }

  // Get user from DB
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      emailVerified: true,
      onboardingCompleted: true,
    },
  });

  // User not found → redirect to /auth
  if (!user) {
    redirect("/auth");
  }

  // Email not verified → redirect to /auth with verify param
  if (!user.emailVerified) {
    redirect("/auth?verify=true");
  }

  // Onboarding not completed → redirect to /onboarding
  if (!user.onboardingCompleted) {
    redirect("/onboarding");
  }

  // All checks passed, render the main layout
  return <MainLayoutClient>{children}</MainLayoutClient>;
}
