import { z } from "zod";

/**
 * Validates if email is from AUB domain
 */
export function isAubEmail(email: string): boolean {
  return email.endsWith("@mail.aub.edu");
}

/**
 * Validates password requirements
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Must contain at least one lowercase letter");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Must contain at least one special character");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
