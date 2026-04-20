import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { getSessionTenant } from "@/lib/session";

// POST /api/conversations/[id]/send — send a manual message from dashboard
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionTenant();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { message } = (await req.json()) as { message: string };

  if (!message?.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  // Verify conversation belongs to this tenant
  const { data: conversation, error: convError } = await supabaseAdmin
    .from("conversations")
    .select("phone")
    .eq("id", id)
    .eq("tenant_id", session.tenantId)
    .single();

  if (convError || !conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const waResult = await sendWhatsAppMessage(
    conversation.phone,
    message,
    session.whatsappPhoneNumberId,
    session.whatsappAccessToken
  );

  if (waResult.error) {
    return NextResponse.json(
      { error: "Failed to send WhatsApp message", detail: waResult.error },
      { status: 502 }
    );
  }

  const { data: storedMessage, error: msgError } = await supabaseAdmin
    .from("messages")
    .insert({ conversation_id: id, role: "assistant", content: message })
    .select()
    .single();

  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });

  await supabaseAdmin
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json(storedMessage);
}
