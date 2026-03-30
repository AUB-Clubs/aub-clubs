"use client";

import { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut, ArrowLeft, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { OnboardingProgress } from "../components/onboarding-progress";
import { PersonalInfoStep } from "../components/personal-info-step";
import { AcademicInfoStep } from "../components/academic-info-step";
import { ProfileStep } from "../components/profile-step";
import {
  onboardingSchema,
  personalInfoSchema,
  academicInfoSchema,
  profileStepSchema,
  type OnboardingInput,
} from "../../lib/validations";
import { createClient } from "@/modules/auth/lib/supabase-client";
import { trpc } from "@/trpc/client";

const TOTAL_STEPS = 3;

interface OnboardingViewProps {
  userId: string;
  initialData?: Partial<OnboardingInput>;
}

export function OnboardingView({ userId, initialData }: OnboardingViewProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const utils = trpc.useUtils();

  const completeMutation = trpc.onboarding.complete.useMutation({
    onSuccess: () => {
      toast.success("Onboarding completed! Welcome to AUB Clubs!");
      utils.invalidate();
      router.push("/me");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const form = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      firstName: initialData?.firstName || "",
      lastName: initialData?.lastName || "",
      dob: initialData?.dob || undefined,
      aubnetId: initialData?.aubnetId || undefined,
      major: initialData?.major || "",
      year: initialData?.year || undefined,
      bio: initialData?.bio || "",
      avatarUrl: initialData?.avatarUrl || null,
    },
    mode: "onChange",
  });

  // Validation schemas for each step
  const stepSchemas = [personalInfoSchema, academicInfoSchema, profileStepSchema];

  async function handleNext() {
    // Validate current step
    const currentSchema = stepSchemas[step - 1];
    const currentFields = Object.keys(currentSchema.shape) as (keyof OnboardingInput)[];
    
    const isValid = await form.trigger(currentFields);
    
    if (!isValid) {
      return;
    }

    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    }
  }

  function handleBack() {
    if (step > 1) {
      setStep(step - 1);
    }
  }

  async function onSubmit(values: OnboardingInput) {
    setIsSubmitting(true);
    try {
      await completeMutation.mutateAsync(values);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    await utils.invalidate();
    router.push("/");
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header with logout */}
      <header className="border-b">
        <div className="container flex h-14 items-center justify-between px-4">
          <h1 className="text-lg font-semibold">AUB Clubs</h1>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-2 size-4" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 container max-w-2xl mx-auto py-8 px-4">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
            <CardDescription>
              Tell us a bit about yourself to get started with AUB Clubs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Progress indicator */}
            <OnboardingProgress currentStep={step} totalSteps={TOTAL_STEPS} />

            {/* Form */}
            <FormProvider {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Step content */}
                <div className="min-h-[280px]">
                  {step === 1 && <PersonalInfoStep />}
                  {step === 2 && <AcademicInfoStep />}
                  {step === 3 && <ProfileStep userId={userId} />}
                </div>

                {/* Navigation buttons */}
                <div className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    disabled={step === 1}
                  >
                    <ArrowLeft className="mr-2 size-4" />
                    Back
                  </Button>

                  {step < TOTAL_STEPS ? (
                    <Button type="button" onClick={handleNext}>
                      Next
                      <ArrowRight className="ml-2 size-4" />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <Spinner className="mr-2 size-4" />
                      ) : null}
                      Complete Setup
                    </Button>
                  )}
                </div>
              </form>
            </FormProvider>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
