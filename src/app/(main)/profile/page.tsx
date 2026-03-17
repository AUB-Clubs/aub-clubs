import { Metadata } from "next";
import StudentPage from "@/modules/students/ui/StudentPage";

export const metadata: Metadata = {
  title: "My Profile",
  description: "View and manage your student profile.",
};

export default function ProfilePage() {
  return <StudentPage />;
}
