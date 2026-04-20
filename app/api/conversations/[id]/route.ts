import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionTenant } from "@/lib/session";

// DELETE /api/conversations/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionTenant();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify conversation belongs to this tenant
  const { data: conv } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", session.tenantId)
    .single();

  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await supabaseAdmin.from("messages").delete().eq("conversation_id", id);
  const { error } = await supabaseAdmin.from("conversations").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// PATCH /api/conversations/[id] — update mode
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionTenant();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { mode } = (await req.json()) as { mode: "agent" | "human" };

  if (!["agent", "human"].includes(mode)) {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("conversations")
    .update({ mode })
    .eq("id", id)
    .eq("tenant_id", session.tenantId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
