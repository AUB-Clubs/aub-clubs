"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { resetPasswordEmailSchema, type ResetPasswordEmailInput } from "../../lib/validations";
import { createClient } from "../../lib/supabase-client";

export function ForgotPasswordDialog() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const form = useForm<ResetPasswordEmailInput>({
    resolver: zodResolver(resetPasswordEmailSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: ResetPasswordEmailInput, event?: React.BaseSyntheticEvent) {
    // Prevent event from bubbling to parent form (sign-in form)
    event?.preventDefault();
    event?.stopPropagation();
    
    setIsLoading(true);
    try {
      const supabase = createClient();
      // Email template will handle the redirect URL
      const { error } = await supabase.auth.resetPasswordForEmail(values.email);

      if (error) {
        toast.error(error.message);
        return;
      }

      setEmailSent(true);
      toast.success("Password reset email sent!");
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  function handleOpenChange(newOpen: boolean) {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset state when dialog closes
      setEmailSent(false);
      form.reset();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="link" className="h-auto p-0 text-sm">
          Forgot password?
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            {emailSent
              ? "Check your email for the password reset link."
              : "Enter your AUB email address and we'll send you a link to reset your password."}
          </DialogDescription>
        </DialogHeader>

        {emailSent ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground text-sm">
              If an account exists with that email, you will receive a password reset link shortly.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Close
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit(onSubmit)(e);
              }} 
              className="space-y-4"
            >
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? <Spinner className="mr-2 size-4" /> : null}
                  Send Reset Link
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
