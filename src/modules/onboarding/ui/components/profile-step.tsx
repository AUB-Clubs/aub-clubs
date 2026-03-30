"use client";

import { useFormContext } from "react-hook-form";

import { Textarea } from "@/components/ui/textarea";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ProfileImageUpload } from "./profile-image-upload";
import type { OnboardingInput } from "../../lib/validations";

interface ProfileStepProps {
  userId: string;
}

export function ProfileStep({ userId }: ProfileStepProps) {
  const form = useFormContext<OnboardingInput>();
  const bio = form.watch("bio") || "";

  return (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="avatarUrl"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Profile Picture (Optional)</FormLabel>
            <FormControl>
              <ProfileImageUpload
                userId={userId}
                currentImageUrl={field.value}
                onUploadComplete={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="bio"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Bio</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Tell us a bit about yourself, your interests, and what clubs you're looking for..."
                className="min-h-[120px] resize-none"
                {...field}
              />
            </FormControl>
            <FormDescription className="flex justify-between">
              <span>Write a short bio about yourself</span>
              <span className={bio.length > 1000 ? "text-destructive" : ""}>
                {bio.length}/1000
              </span>
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
