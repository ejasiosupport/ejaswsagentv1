import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

// POST /api/conversations/[id]/send — send a manual message from dashboard
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { message } = (await req.json()) as { message: string };

  if (!message?.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  // Get the conversation to find the phone number
  const { data: conversation, error: convError } = await supabaseAdmin
    .from("conversations")
    .select("phone")
    .eq("id", id)
    .single();

  if (convError || !conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  // Send via WhatsApp
  const waResult = await sendWhatsAppMessage(conversation.phone, message);
  if (waResult.error) {
    return NextResponse.json(
      { error: "Failed to send WhatsApp message", detail: waResult.error },
      { status: 502 }
    );
  }

  // Store in DB as assistant message
  const { data: storedMessage, error: msgError } = await supabaseAdmin
    .from("messages")
    .insert({
      conversation_id: id,
      role: "assistant",
      content: message,
    })
    .select()
    .single();

  if (msgError) {
    return NextResponse.json({ error: msgError.message }, { status: 500 });
  }

  // Update conversation timestamp
  await supabaseAdmin
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json(storedMessage);
}
