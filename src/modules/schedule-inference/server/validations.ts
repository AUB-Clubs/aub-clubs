import { z } from "zod";

export const dayOfWeekSchema = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);

export const extractedScheduleItemSchema = z.object({
  courseCode: z.string().min(1).max(80),
  dayOfWeek: dayOfWeekSchema,
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  location: z.string().max(200).optional().nullable(),
});

export const extractedSchedulePayloadSchema = z.object({
  items: z.array(extractedScheduleItemSchema).max(80),
});

export type ExtractedScheduleItem = z.infer<typeof extractedScheduleItemSchema>;
