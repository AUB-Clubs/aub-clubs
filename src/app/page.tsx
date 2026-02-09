import { Metadata } from "next";
import LandingPage from "@/modules/Landing-Page/LandingPage";

export const metadata: Metadata = {
  title: "Welcome",
  description: "The central hub for all student clubs and activities at AUB.",
};

export default function Home() {
  return (
    <LandingPage/>
  )
}
