"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SignInForm } from "./sign-in-form";
import { SignUpForm } from "./sign-up-form";

interface AuthTabsProps {
  defaultTab?: "sign-in" | "sign-up";
}

export function AuthTabs({ defaultTab = "sign-in" }: AuthTabsProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const router = useRouter();

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="sign-in">Sign In</TabsTrigger>
        <TabsTrigger value="sign-up">Sign Up</TabsTrigger>
      </TabsList>
      <TabsContent value="sign-in" className="mt-6">
        <SignInForm />
      </TabsContent>
      <TabsContent value="sign-up" className="mt-6">
        <SignUpForm onSuccess={(email) => router.push(`/auth?verify=true&email=${encodeURIComponent(email)}`)} />
      </TabsContent>
    </Tabs>
  );
}
