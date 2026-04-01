import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// GET /api/conversations — list all conversations with last message
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("conversations")
    .select(
      `
      id, phone, name, mode, updated_at, created_at,
      messages(content, role, created_at)
    `
    )
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Attach last message to each conversation
  const conversations = (data ?? []).map((conv) => {
    const msgs = (conv.messages as Array<{ content: string; role: string; created_at: string }>) ?? [];
    msgs.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const lastMessage = msgs[0] ?? null;
    return {
      id: conv.id,
      phone: conv.phone,
      name: conv.name,
      mode: conv.mode,
      updated_at: conv.updated_at,
      created_at: conv.created_at,
      lastMessage,
    };
  });

  return NextResponse.json(conversations);
}
