import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { getAIResponse } from "@/lib/openrouter";

// Rate limiter: max 10 messages per phone per 5 minutes
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 5 * 60 * 1000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(phone: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(phone);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(phone, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // skip in dev
  if (!signatureHeader) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

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
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

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
    (contacts?.[0]?.profile as Record<string, string> | undefined)?.name ?? null;

  // Identify tenant by the WhatsApp phone_number_id in the webhook metadata
  const metadata = value.metadata as Record<string, string> | undefined;
  const incomingPhoneNumberId = metadata?.phone_number_id;

  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("id, whatsapp_phone_number_id, whatsapp_access_token")
    .eq("whatsapp_phone_number_id", incomingPhoneNumberId)
    .single();

  if (!tenant) {
    console.error("No tenant found for phone_number_id:", incomingPhoneNumberId);
    return "ignored";
  }

  // Check for existing conversation (inactivity reset)
  const { data: existingConv } = await supabaseAdmin
    .from("conversations")
    .select("id, updated_at")
    .eq("phone", phone)
    .eq("tenant_id", tenant.id)
    .single();

  const RESET_AFTER_MS = 14 * 24 * 60 * 60 * 1000;
  const isStaleConversation =
    existingConv != null &&
    Date.now() - new Date(existingConv.updated_at).getTime() > RESET_AFTER_MS;

  // Upsert conversation scoped to this tenant
  const { data: conversation, error: convError } = await supabaseAdmin
    .from("conversations")
    .upsert(
      { phone, name: contactName, tenant_id: tenant.id, updated_at: new Date().toISOString() },
      { onConflict: "phone,tenant_id", ignoreDuplicates: false }
    )
    .select()
    .single();

  if (convError || !conversation) {
    console.error("Failed to upsert conversation:", convError);
    return "error";
  }

  // Deduplicate
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

  if (conversation.mode === "human") return "stored_for_human";

  if (isRateLimited(phone)) {
    await sendWhatsAppMessage(
      phone,
      "Anda telah menghantar terlalu banyak mesej. Sila tunggu sebentar sebelum menghantar mesej lagi. 🙏",
      tenant.whatsapp_phone_number_id,
      tenant.whatsapp_access_token
    );
    return "rate_limited";
  }

  // Fetch history (skip if stale)
  let aiMessages: { role: "user" | "assistant"; content: string }[] = [];
  if (!isStaleConversation) {
    const { data: history } = await supabaseAdmin
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .limit(20);

    aiMessages = (history ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content as string,
    }));
  }

  // Get AI response using this tenant's bot config
  let aiReply: string;
  try {
    aiReply = await getAIResponse(aiMessages, { phone, name: contactName }, tenant.id);
    if (!aiReply) throw new Error("Empty AI response");
    aiReply = aiReply
      .replace(/\*\*([^*]+)\*\*/g, "*$1*")
      .replace(/_{1,2}([^_]+)_{1,2}/g, "$1")
      .replace(/^#{1,6}\s/gm, "");
    const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
    const emojis = aiReply.match(emojiRegex) ?? [];
    if (emojis.length > 1) {
      let found = 0;
      aiReply = aiReply.replace(emojiRegex, (e) => { found++; return found === 1 ? e : ""; });
    }
  } catch (err) {
    console.error("AI error:", err);
    aiReply = "Sorry, I'm having trouble responding right now. Please try again.";
  }

  await sendWhatsAppMessage(
    phone,
    aiReply,
    tenant.whatsapp_phone_number_id,
    tenant.whatsapp_access_token
  );

  await supabaseAdmin.from("messages").insert({
    conversation_id: conversation.id,
    role: "assistant",
    content: aiReply,
  });

  await supabaseAdmin
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversation.id);

  return "replied";
}
