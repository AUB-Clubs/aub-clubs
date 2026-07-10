import { redirect } from "next/navigation";
import { createClient } from "@/modules/auth/server/utils/supabase-server";
import { LandingPageView } from "@/modules/landing/ui/views/landing-page-view";

export const dynamic = "force-dynamic";

export default async function Home() {
  let isAuthenticated = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    isAuthenticated = Boolean(user);
  } catch (error) {
    console.error("Failed to check home page auth state", error);
  }

  if (isAuthenticated) {
    redirect("/discover");
  }

  return <LandingPageView />;
}
