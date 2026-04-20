import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionTenant } from "@/lib/session";

// GET /api/conversations — list conversations for the current tenant
export async function GET() {
  const session = await getSessionTenant();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("conversations")
    .select(`id, phone, name, mode, updated_at, created_at, messages(content, role, created_at)`)
    .eq("tenant_id", session.tenantId)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const conversations = (data ?? []).map((conv) => {
    const msgs = (conv.messages as Array<{ content: string; role: string; created_at: string }>) ?? [];
    msgs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return {
      id: conv.id,
      phone: conv.phone,
      name: conv.name,
      mode: conv.mode,
      updated_at: conv.updated_at,
      created_at: conv.created_at,
      lastMessage: msgs[0] ?? null,
    };
  });

  return NextResponse.json(conversations);
}
