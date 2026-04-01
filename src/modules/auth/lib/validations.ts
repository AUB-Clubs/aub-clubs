import { z } from "zod";

/**
 * Email validation schema - enforces @mail.aub.edu domain
 */
export const aubEmailSchema = z
  .string()
  .email("Invalid email address")
  .refine(
    (email) => email.endsWith("@mail.aub.edu"),
    "Must be an AUB email address (@mail.aub.edu)"
  );

/**
 * Password validation schema
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one special character
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[a-z]/, "Must contain at least one lowercase letter")
  .regex(/[^A-Za-z0-9]/, "Must contain at least one special character");

/**
 * Sign up input schema
 */
export const signUpSchema = z.object({
  email: aubEmailSchema,
  password: passwordSchema,
});

/**
 * Sign in input schema
 */
export const signInSchema = z.object({
  email: aubEmailSchema,
  password: z.string().min(1, "Password is required"),
});

/**
 * Reset password email input schema
 */
export const resetPasswordEmailSchema = z.object({
  email: aubEmailSchema,
});

/**
 * Reset password input schema
 */
export const resetPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: passwordSchema,
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Type exports
export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ResetPasswordEmailInput = z.infer<typeof resetPasswordEmailSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
