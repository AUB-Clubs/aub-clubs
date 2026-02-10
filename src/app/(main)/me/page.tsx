import { Metadata } from "next";
import ForYouPage from "@/modules/Students/ui/ForYouPage";

export const metadata: Metadata = {
  title: "For You",
  description: "Personalized updates and content from your clubs.",
};

export default function MePage() {
  return (
    <ForYouPage/>
  )
}
