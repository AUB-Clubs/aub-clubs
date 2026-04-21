import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY for event generator");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }

  return openaiClient;
}

export async function generateTextWithOpenAI(params: {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
}): Promise<string> {
  const response = await getOpenAIClient().responses.create({
    model: params.model ?? process.env.OPENAI_MODEL ?? "gpt-5.4",
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: params.systemPrompt }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: params.userPrompt }],
      },
    ],
  });

  return response.output_text.trim();
}
