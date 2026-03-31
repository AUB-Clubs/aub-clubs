import OpenAI from "openai";
import { extractedSchedulePayloadSchema, type ExtractedScheduleItem } from "./validations";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function extractJsonBlock(raw: string): string {
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();
  return raw.trim();
}

export async function inferScheduleFromImage(params: {
  base64Image: string;
  mimeType: string;
}): Promise<ExtractedScheduleItem[]> {
  const dataUrl = `data:${params.mimeType};base64,${params.base64Image}`;

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-5.4",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You extract weekly university schedules from images. Return strict JSON only, no markdown.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              "Extract weekly classes from this image. Return JSON object with this shape: {\"items\":[{\"courseCode\":\"CMPS 270\",\"dayOfWeek\":\"MONDAY\",\"startTime\":\"10:00\",\"endTime\":\"11:15\",\"location\":\"optional\"}]}. Use 24-hour HH:MM. Only values MONDAY..SUNDAY.",
          },
          {
            type: "input_image",
            image_url: dataUrl,
            detail: "auto",
          },
        ],
      },
    ],
  });

  const rawText = response.output_text;
  const parsed = JSON.parse(extractJsonBlock(rawText));
  const validated = extractedSchedulePayloadSchema.parse(parsed);
  return validated.items;
}
