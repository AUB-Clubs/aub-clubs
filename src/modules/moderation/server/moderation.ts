/**
 * Content Moderation Helper Functions
 * 
 * Provides utilities for moderating text and image content using the in-house inference service.
 */

import { TRPCError } from "@trpc/server";

const INFERENCE_URL = process.env.INFERENCE_URL || "http://localhost:8080";

const DEFAULT_MODERATION_TIMEOUT_MS = (() => {
  const parsed = Number(process.env.MODERATION_TIMEOUT_MS);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return 120000;
})();

const MODERATION_RETRIES = (() => {
  const parsed = Number(process.env.MODERATION_RETRIES);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return Math.floor(parsed);
  }
  return 3;
})();

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const BLOCKED_PROFANITY_REGEX =
  /\b(?:fuck|fucks|fucked|fucking|fucker|fuckers|shit|shits|shitty|bullshit|motherfucker|motherfuckers)\b/i;

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
   * @default 0.02
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
   * @default 120000
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
  let lastError: unknown;

  for (let attempt = 0; attempt <= MODERATION_RETRIES; attempt++) {
    try {
      const response = await fetch(`${INFERENCE_URL}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: payload.text,
          image: payload.image,
        }),
        signal: AbortSignal.timeout(payload.timeout ?? DEFAULT_MODERATION_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const shouldRetry =
          response.status === 408 ||
          response.status === 429 ||
          response.status >= 500;

        if (!shouldRetry || attempt === MODERATION_RETRIES) {
          throw new Error(`Inference service returned ${response.status}: ${errorText}`);
        }

        await wait(300 * (attempt + 1));
        continue;
      }

      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt === MODERATION_RETRIES) {
        break;
      }

      await wait(300 * (attempt + 1));
    }
  }

  console.warn("Moderation service unavailable:", lastError);
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Moderation service is currently unavailable",
    cause: lastError,
  });
};

/**
 * Check if text moderation flags indicate unsafe content
 */
const isTextUnsafe = (flags: TextFlag[], threshold: number = 0.02): { isUnsafe: boolean; reason?: string; label?: string } => {
  const unsafeLabels = ["S", "H", "V", "HR", "SH", "S3", "H2", "V2"];

  const unsafeFlag = flags
    .filter((flag) => unsafeLabels.includes(flag.label) && flag.score >= threshold)
    .sort((a, b) => b.score - a.score)[0];

  if (unsafeFlag) {
    return {
      isUnsafe: true,
      label: unsafeFlag.label,
      reason: TEXT_MODERATION_LABELS[unsafeFlag.label as keyof typeof TEXT_MODERATION_LABELS] || "inappropriate language",
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
  const {
    textThreshold = 0.02,
    throwOnUnsafe = true,
    timeout = DEFAULT_MODERATION_TIMEOUT_MS,
  } = options;

  if (throwOnUnsafe && BLOCKED_PROFANITY_REGEX.test(text)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Your content contains profanity that is not allowed. Please revise it.",
    });
  }

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
  const {
    imageThreshold = 0.3,
    throwOnUnsafe = true,
    timeout = DEFAULT_MODERATION_TIMEOUT_MS,
  } = options;

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
    timeout = DEFAULT_MODERATION_TIMEOUT_MS,
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
 * Validate that bio text does not contain URLs
 * 
 * @param bio - The bio text to validate
 * @throws TRPCError if bio contains URLs
 */
export function validateBioNoLinks(bio: string): void {
  // Comprehensive URL detection regex
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9][a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/gi;
  
  if (urlRegex.test(bio)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "URLs are not allowed in bios. Please remove any links.",
    });
  }
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
