import { z } from "zod";

/**
 * Profile picture validation schema
 * Requirements:
 * - Max size: 5MB
 * - Allowed formats: jpg, png, webp
 */
export const profilePictureSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.size <= 5 * 1024 * 1024, "Max size is 5MB")
    .refine(
      (file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type),
      "Only jpg, png, and webp formats are allowed"
    ),
});

/**
 * Onboarding validation schema
 * All fields required except avatarUrl (optional)
 */
export const onboardingSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  aubnetId: z.number().int().positive("Must be a positive number"),
  dob: z.date().max(new Date(), "Cannot be in the future"),
  major: z.string().min(1, "Major is required"), // Free text
  year: z.number().int().min(1).max(4, "Must be between 1 and 4"),
  bio: z
    .string()
    .min(1, "Bio is required")
    .max(1000, "Bio cannot exceed 1000 characters"),
  avatarUrl: z.string().url().optional().nullable(),
});

/**
 * Personal info step (Step 1)
 */
export const personalInfoSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dob: z.date().max(new Date(), "Cannot be in the future"),
});

/**
 * Academic info step (Step 2)
 */
export const academicInfoSchema = z.object({
  aubnetId: z.number().int().positive("Must be a positive number"),
  major: z.string().min(1, "Major is required"),
  year: z.number().int().min(1).max(4, "Must be between 1 and 4"),
});

/**
 * Profile step (Step 3)
 */
export const profileStepSchema = z.object({
  bio: z
    .string()
    .min(1, "Bio is required")
    .max(1000, "Bio cannot exceed 1000 characters"),
  avatarUrl: z.string().url().optional().nullable(),
});

/**
 * Helper function to calculate suggested year based on date of birth
 * Assumes:
 * - 18 years old = Year 1
 * - 19 years old = Year 2
 * - 20 years old = Year 3
 * - 21+ years old = Year 4
 */
export function getSuggestedYear(dob: Date): number {
  const today = new Date();
  const age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  const dayDiff = today.getDate() - dob.getDate();

  // Adjust age if birthday hasn't occurred yet this year
  const actualAge =
    monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;

  // Map age to suggested year
  if (actualAge <= 18) return 1;
  if (actualAge === 19) return 2;
  if (actualAge === 20) return 3;
  return 4; // 21+
}

/**
 * Helper function to check if year matches age
 */
export function shouldNudgeYearChange(dob: Date, selectedYear: number): {
  shouldNudge: boolean;
  suggestedYear: number;
} {
  const suggestedYear = getSuggestedYear(dob);
  return {
    shouldNudge: suggestedYear !== selectedYear,
    suggestedYear,
  };
}

// Type exports
export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type PersonalInfoInput = z.infer<typeof personalInfoSchema>;
export type AcademicInfoInput = z.infer<typeof academicInfoSchema>;
export type ProfileStepInput = z.infer<typeof profileStepSchema>;
export type ProfilePictureInput = z.infer<typeof profilePictureSchema>;
