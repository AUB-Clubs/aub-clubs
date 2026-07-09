import { redirect } from "next/navigation";
import { createClient } from "@/modules/auth/server/utils/supabase-server";
import { LandingPageView } from "@/modules/landing/ui/views/landing-page-view";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/discover");
  }

  return <LandingPageView />;
}
