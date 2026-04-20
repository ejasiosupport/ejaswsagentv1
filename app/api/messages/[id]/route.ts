import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionTenant } from "@/lib/session";

// DELETE /api/messages/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionTenant();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify message belongs to a conversation owned by this tenant
  const { data: msg } = await supabaseAdmin
    .from("messages")
    .select("id, conversations!inner(tenant_id)")
    .eq("id", id)
    .single();

  const tenantId = (msg?.conversations as unknown as { tenant_id: string } | null)?.tenant_id;
  if (!msg || tenantId !== session.tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await supabaseAdmin.from("messages").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
