import { Metadata } from "next";
import LandingPage from "@/modules/landing-page/LandingPage";

export const metadata: Metadata = {
  title: "Welcome: AUB Clubs",
  description: "The central hub for all student clubs and activities at AUB.",
};

export default function Home() {
  return (
    <LandingPage/>
  )
}
