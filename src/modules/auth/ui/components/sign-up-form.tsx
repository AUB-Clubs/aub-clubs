"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { signUpSchema, type SignUpInput } from "../../lib/validations";
import { trpc } from "@/trpc/client";

interface SignUpFormProps {
  onSuccess: (email: string) => void;
}

export function SignUpForm({ onSuccess }: SignUpFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const signUpMutation = trpc.auth.signUp.useMutation();

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: SignUpInput) {
    setIsLoading(true);
    try {
      await signUpMutation.mutateAsync(values);
      // Success - immediately redirect and show toast
      toast.success("Account created! Please check your email to verify your account.");
      // Store email in sessionStorage as a fallback
      if (typeof window !== "undefined") {
        sessionStorage.setItem("verification_email", values.email);
      }
      onSuccess(values.email);
    } catch (error) {
      // Error is already shown by tRPC's error handling
      toast.error(error instanceof Error ? error.message : "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  }

  const password = form.watch("password");
  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="yourname@mail.aub.edu"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Must be an AUB email address (@mail.aub.edu)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Create a password" {...field} />
              </FormControl>
              <div className="mt-2 space-y-1 text-xs">
                <p className={passwordChecks.length ? "text-green-600" : "text-muted-foreground"}>
                  {passwordChecks.length ? "✓" : "○"} At least 8 characters
                </p>
                <p className={passwordChecks.uppercase ? "text-green-600" : "text-muted-foreground"}>
                  {passwordChecks.uppercase ? "✓" : "○"} At least one uppercase letter
                </p>
                <p className={passwordChecks.lowercase ? "text-green-600" : "text-muted-foreground"}>
                  {passwordChecks.lowercase ? "✓" : "○"} At least one lowercase letter
                </p>
                <p className={passwordChecks.special ? "text-green-600" : "text-muted-foreground"}>
                  {passwordChecks.special ? "✓" : "○"} At least one special character
                </p>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? <Spinner className="mr-2 size-4" /> : null}
          Create Account
        </Button>
      </form>
    </Form>
  );
}
