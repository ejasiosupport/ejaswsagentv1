import OpenAI from "openai";
import SYSTEM_PROMPT from "./system-prompt";

const client = new OpenAI({
  apiKey: process.env.AI_API_KEY ?? process.env.OPENROUTER_API_KEY!,
  baseURL: process.env.AI_BASE_URL ?? "https://openrouter.ai/api/v1",
});

const AI_MODEL = process.env.AI_MODEL ?? process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

export async function getAIResponse(
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const completion = await client.chat.completions.create({
    model: AI_MODEL,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
  });
  return completion.choices[0].message.content ?? "";
}
