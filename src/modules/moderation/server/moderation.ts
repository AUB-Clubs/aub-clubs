/**
 * Content Moderation Helper Functions
 * 
 * Provides utilities for moderating text and image content using the in-house inference service.
 */

import { TRPCError } from "@trpc/server";

const INFERENCE_URL = process.env.INFERENCE_URL || "http://localhost:8080";

/**
 * Label definitions for text moderation
 * Based on KoalaAI/Text-Moderation model
 */
export const TEXT_MODERATION_LABELS = {
  OK: "OK",
  S: "sexual content",
  H: "hate speech",
  V: "violence",
  HR: "harassment",
  SH: "self-harm promotion",
  S3: "sexual content involving minors",
  H2: "threatening hate speech",
  V2: "graphic violence",
} as const;

/**
 * Label definitions for image moderation
 * Based on OwenElliott/image-safety-classifier-s model
 */
export const IMAGE_MODERATION_LABELS = {
  SFW: "Safe for work",
  NSFW: "Not safe for work",
  NSFL: "Not safe for life",
} as const;

export interface TextFlag {
  label: string;
  score: number;
}

export interface ImageFlag {
  label: string;
  score: number;
}

export interface ModerationResult {
  text_flags?: TextFlag[];
  image_flags?: ImageFlag[];
}

export interface ModerationOptions {
  /**
   * Threshold for text moderation (0-1)
   * If any unsafe label scores above this threshold, content is rejected
   * @default 0.05
   */
  textThreshold?: number;

  /**
   * Threshold for image moderation (0-1)
   * If NSFW/NSFL scores above this threshold, content is rejected
   * @default 0.3
   */
  imageThreshold?: number;

  /**
   * Whether to throw an error if content is flagged as unsafe
   * @default true
   */
  throwOnUnsafe?: boolean;

  /**
   * Timeout for the moderation request in milliseconds
   * @default 30000
   */
  timeout?: number;
}

/**
 * Helper to strip data URI prefix from base64 images
 */
const cleanBase64 = (base64: string): string => {
  return base64.replace(/^data:image\/[a-z]+;base64,/, "");
};

/**
 * Call the in-house inference service
 */
const callInferenceService = async (payload: {
  text?: string;
  image?: string;
  timeout?: number;
}): Promise<ModerationResult> => {
  try {
    const response = await fetch(`${INFERENCE_URL}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: payload.text,
        image: payload.image,
      }),
      signal: AbortSignal.timeout(payload.timeout || 30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Inference service returned ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.warn("Moderation service unavailable:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Moderation service is currently unavailable",
      cause: error,
    });
  }
};

/**
 * Check if text moderation flags indicate unsafe content
 */
const isTextUnsafe = (flags: TextFlag[], threshold: number = 0.05): { isUnsafe: boolean; reason?: string; label?: string } => {
  const unsafeLabels = ["S", "H", "V", "HR", "SH", "S3", "H2", "V2"];
  
  // Find the highest scoring flag
  const topFlag = flags.reduce((prev, current) => 
    (current.score > prev.score) ? current : prev
  );

  // If OK is the top result but confidence is low, check for unsafe labels
  if (topFlag.label === "OK" && topFlag.score < 0.95) {
    const unsafeFlag = flags.find(flag => 
      unsafeLabels.includes(flag.label) && flag.score > threshold
    );
    
    if (unsafeFlag) {
      return {
        isUnsafe: true,
        label: unsafeFlag.label,
        reason: TEXT_MODERATION_LABELS[unsafeFlag.label as keyof typeof TEXT_MODERATION_LABELS] || "inappropriate language",
      };
    }
  }

  // If an unsafe label is the top result and above threshold
  if (unsafeLabels.includes(topFlag.label) && topFlag.score > threshold) {
    return {
      isUnsafe: true,
      label: topFlag.label,
      reason: TEXT_MODERATION_LABELS[topFlag.label as keyof typeof TEXT_MODERATION_LABELS] || "inappropriate language",
    };
  }

  return { isUnsafe: false };
};

/**
 * Check if image moderation flags indicate unsafe content
 */
const isImageUnsafe = (flags: ImageFlag[], threshold: number = 0.3): { isUnsafe: boolean; reason?: string; label?: string } => {
  // Find NSFW or NSFL flags
  const nsflFlag = flags.find(flag => flag.label === "NSFL");
  const nsfwFlag = flags.find(flag => flag.label === "NSFW");

  // NSFL is the most serious - reject if above threshold
  if (nsflFlag && nsflFlag.score > threshold) {
    return {
      isUnsafe: true,
      label: "NSFL",
      reason: "extremely graphic or disturbing content",
    };
  }

  // NSFW is moderately serious - reject if above threshold
  if (nsfwFlag && nsfwFlag.score > threshold) {
    return {
      isUnsafe: true,
      label: "NSFW",
      reason: "inappropriate or explicit content",
    };
  }

  return { isUnsafe: false };
};

/**
 * Moderate text content only
 * 
 * @param text - The text content to moderate
 * @param options - Moderation options
 * @returns Moderation result with text flags
 * @throws TRPCError if content is flagged as unsafe (when throwOnUnsafe is true)
 */
export async function moderateText(
  text: string,
  options: ModerationOptions = {}
): Promise<ModerationResult> {
  const { textThreshold = 0.05, throwOnUnsafe = true, timeout = 30000 } = options;

  const result = await callInferenceService({ text, timeout });

  if (result.text_flags && throwOnUnsafe) {
    const check = isTextUnsafe(result.text_flags, textThreshold);
    
    if (check.isUnsafe) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Your content violates community guidelines and contains ${check.reason}. Please revise it.`,
      });
    }
  }

  return result;
}

/**
 * Moderate image content only
 * 
 * @param base64Image - The base64-encoded image to moderate (with or without data URI prefix)
 * @param options - Moderation options
 * @returns Moderation result with image flags
 * @throws TRPCError if content is flagged as unsafe (when throwOnUnsafe is true)
 */
export async function moderateImage(
  base64Image: string,
  options: ModerationOptions = {}
): Promise<ModerationResult> {
  const { imageThreshold = 0.3, throwOnUnsafe = true, timeout = 30000 } = options;

  const cleanedBase64 = cleanBase64(base64Image);
  const result = await callInferenceService({ image: cleanedBase64, timeout });

  if (result.image_flags && throwOnUnsafe) {
    const check = isImageUnsafe(result.image_flags, imageThreshold);
    
    if (check.isUnsafe) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Your image violates community guidelines and contains ${check.reason}. Please remove or replace it.`,
      });
    }
  }

  return result;
}

/**
 * Moderate both text and image content
 * 
 * @param text - The text content to moderate
 * @param base64Image - The base64-encoded image to moderate (with or without data URI prefix)
 * @param options - Moderation options
 * @returns Moderation result with both text and image flags
 * @throws TRPCError if content is flagged as unsafe (when throwOnUnsafe is true)
 */
export async function moderateBoth(
  text: string,
  base64Image: string,
  options: ModerationOptions = {}
): Promise<ModerationResult> {
  const {
    textThreshold = 0.05,
    imageThreshold = 0.3,
    throwOnUnsafe = true,
    timeout = 30000,
  } = options;

  const cleanedBase64 = cleanBase64(base64Image);
  const result = await callInferenceService({ text, image: cleanedBase64, timeout });

  if (throwOnUnsafe) {
    // Check text flags
    if (result.text_flags) {
      const textCheck = isTextUnsafe(result.text_flags, textThreshold);
      
      if (textCheck.isUnsafe) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Your content violates community guidelines and contains ${textCheck.reason}. Please revise it.`,
        });
      }
    }

    // Check image flags
    if (result.image_flags) {
      const imageCheck = isImageUnsafe(result.image_flags, imageThreshold);
      
      if (imageCheck.isUnsafe) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Your image violates community guidelines and contains ${imageCheck.reason}. Please remove or replace it.`,
        });
      }
    }
  }

  return result;
}

/**
 * Moderate content with automatic detection of content type
 * Always rejects content if moderation service is unavailable (fail-safe approach)
 * 
 * @param payload - Content to moderate
 * @param options - Moderation options
 * @returns Moderation result
 * @throws TRPCError if content is unsafe or service is unavailable
 */
export async function moderateContent(
  payload: { text?: string; image?: string },
  options: ModerationOptions = {}
): Promise<ModerationResult> {
  if (payload.text && payload.image) {
    return await moderateBoth(payload.text, payload.image, options);
  } else if (payload.text) {
    return await moderateText(payload.text, options);
  } else if (payload.image) {
    return await moderateImage(payload.image, options);
  }
  
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "No content provided for moderation",
  });
}
