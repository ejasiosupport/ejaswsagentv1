import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { getAIResponse } from "@/lib/openrouter";

// GET /api/webhook — Meta webhook verification
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// POST /api/webhook — Receive incoming WhatsApp messages
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.object !== "whatsapp_business_account") {
    return NextResponse.json({ status: "ignored" });
  }

  try {
    const status = await processWebhook(body);
    return NextResponse.json({ status });
  } catch (err) {
    console.error("processWebhook error:", err);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

async function processWebhook(body: Record<string, unknown>): Promise<string> {
  const entry = (body.entry as Array<Record<string, unknown>>)?.[0];
  const change = (entry?.changes as Array<Record<string, unknown>>)?.[0];
  const value = change?.value as Record<string, unknown> | undefined;

  if (!value) return "ignored";

  const messages = value.messages as Array<Record<string, unknown>> | undefined;
  if (!messages || messages.length === 0) return "ignored";

  const message = messages[0];
  if (message.type !== "text") return "ignored";

  const phone = message.from as string;
  const text = (message.text as Record<string, string>).body;
  const whatsappMsgId = message.id as string;
  const timestamp = message.timestamp as string;

  const contacts = value.contacts as Array<Record<string, unknown>> | undefined;
  const contactName =
    (contacts?.[0]?.profile as Record<string, string> | undefined)?.name ??
    null;

  // Upsert conversation
  const { data: conversation, error: convError } = await supabaseAdmin
    .from("conversations")
    .upsert(
      { phone, name: contactName, updated_at: new Date().toISOString() },
      { onConflict: "phone", ignoreDuplicates: false }
    )
    .select()
    .single();

  if (convError || !conversation) {
    console.error("Failed to upsert conversation:", convError);
    return "error";
  }

  // Deduplicate: skip if we've already processed this message
  const { data: existing } = await supabaseAdmin
    .from("messages")
    .select("id")
    .eq("whatsapp_msg_id", whatsappMsgId)
    .single();

  if (existing) return "duplicate";

  // Store user message
  await supabaseAdmin.from("messages").insert({
    conversation_id: conversation.id,
    role: "user",
    content: text,
    whatsapp_msg_id: whatsappMsgId,
    created_at: new Date(parseInt(timestamp) * 1000).toISOString(),
  });

  // If mode is 'human', stop here — no auto-reply
  if (conversation.mode === "human") return "stored_for_human";

  // Fetch conversation history for AI context
  const { data: history } = await supabaseAdmin
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .limit(20);

  const aiMessages = (history ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content as string,
  }));

  // Get AI response
  let aiReply: string;
  try {
    aiReply = await getAIResponse(aiMessages);
    if (!aiReply) throw new Error("Empty AI response");
  } catch (err) {
    console.error("AI error:", err);
    aiReply = "Sorry, I'm having trouble responding right now. Please try again.";
  }

  // Send reply via WhatsApp
  await sendWhatsAppMessage(phone, aiReply);

  // Store AI response
  await supabaseAdmin.from("messages").insert({
    conversation_id: conversation.id,
    role: "assistant",
    content: aiReply,
  });

  // Update conversation timestamp
  await supabaseAdmin
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversation.id);

  return "replied";
}
