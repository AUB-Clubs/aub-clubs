import { redirect } from "next/navigation";
import { OnboardingView } from "@/modules/onboarding/ui/views/onboarding-view";
import { createClient } from "@/modules/auth/server/utils/supabase-server";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Complete Your Profile",
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  // Redirect to auth if not logged in
  if (!session) {
    redirect("/auth");
  }

  // Get user from DB
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      emailVerified: true,
      onboardingCompleted: true,
      firstName: true,
      lastName: true,
      dob: true,
      aubnetId: true,
      major: true,
      year: true,
      bio: true,
      avatarUrl: true,
    },
  });

  // Redirect if user not found or email not verified
  if (!user) {
    redirect("/auth");
  }

  if (!user.emailVerified) {
    redirect("/auth?verify=true");
  }

  // Redirect to main app if already onboarded
  if (user.onboardingCompleted) {
    redirect("/me");
  }

  return (
    <OnboardingView
      userId={user.id}
      initialData={{
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        dob: user.dob || undefined,
        aubnetId: user.aubnetId || undefined,
        major: user.major || "",
        year: user.year || undefined,
        bio: user.bio || "",
        avatarUrl: user.avatarUrl,
      }}
    />
  );
}
