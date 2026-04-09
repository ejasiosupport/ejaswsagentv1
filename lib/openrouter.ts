import OpenAI from "openai";
import SYSTEM_PROMPT from "./system-prompt";
import { getAvailableSlots, bookAppointment } from "./google-calendar";

const client = new OpenAI({
  apiKey: process.env.AI_API_KEY ?? process.env.OPENROUTER_API_KEY!,
  baseURL: process.env.AI_BASE_URL ?? "https://openrouter.ai/api/v1",
});

const AI_MODEL = process.env.AI_MODEL ?? process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_available_slots",
      description: "Get available appointment slots for a given date. Use this when a user wants to book a consultation or demo.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Date in YYYY-MM-DD format" },
        },
        required: ["date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_appointment",
      description: "Book a consultation or demo appointment on Google Calendar.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short title for the appointment" },
          date: { type: "string", description: "Date in YYYY-MM-DD format" },
          time: { type: "string", description: "Time in HH:MM 24-hour format (e.g. 14:00)" },
          guestName: { type: "string", description: "Full name of the customer" },
          guestPhone: { type: "string", description: "WhatsApp phone number of the customer" },
          type: { type: "string", enum: ["consultation", "demo"], description: "Type of appointment" },
        },
        required: ["title", "date", "time", "guestName", "guestPhone", "type"],
      },
    },
  },
];

async function handleToolCall(name: string, args: Record<string, string>): Promise<string> {
  if (name === "get_available_slots") {
    const slots = await getAvailableSlots(args.date);
    if (slots.length === 0) return `No available slots on ${args.date}.`;
    return `Available slots on ${args.date}: ${slots.join(", ")}`;
  }

  if (name === "book_appointment") {
    const result = await bookAppointment({
      title: args.title,
      date: args.date,
      time: args.time,
      guestName: args.guestName,
      guestPhone: args.guestPhone,
      type: args.type as "consultation" | "demo",
    });
    if (result.success) {
      return `Appointment booked successfully! Event ID: ${result.eventId}`;
    }
    return `Failed to book appointment: ${result.error}`;
  }

  return "Unknown tool";
}

export async function getAIResponse(
  messages: { role: "user" | "assistant"; content: string }[],
  caller?: { phone: string; name: string | null }
): Promise<string> {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
  const todayDisplay = new Date().toLocaleDateString("ms-MY", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Kuala_Lumpur" });

  const callerInfo = caller
    ? `\n\n## Maklumat Pelanggan\nNombor WhatsApp: ${caller.phone}\nNama: ${caller.name ?? "Tidak diketahui"}\nGuna maklumat ini secara automatik untuk tempahan — JANGAN tanya nombor telefon pelanggan lagi.`
    : "";

  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: `${SYSTEM_PROMPT}\n\n## Tarikh Semasa\nHari ini: ${todayDisplay} (${today})${callerInfo}` },
    ...messages,
  ];

  // Agentic loop — handle tool calls
  for (let i = 0; i < 5; i++) {
    const completion = await client.chat.completions.create({
      model: AI_MODEL,
      messages: chatMessages,
      tools,
      tool_choice: "auto",
    });

    const choice = completion.choices[0];
    const msg = choice.message;

    if (choice.finish_reason === "tool_calls" && msg.tool_calls) {
      chatMessages.push(msg);
      for (const tc of msg.tool_calls) {
        const args = JSON.parse(tc.function.arguments) as Record<string, string>;
        const result = await handleToolCall(tc.function.name, args);
        chatMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        });
      }
      continue;
    }

    return msg.content ?? "";
  }

  return "Sorry, I'm having trouble processing your request right now.";
}
