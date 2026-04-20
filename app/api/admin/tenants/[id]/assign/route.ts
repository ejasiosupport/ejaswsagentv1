import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isSessionAdmin } from "@/lib/session";

// POST /api/admin/tenants/[id]/assign — assign a user email to a tenant
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isSessionAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: tenantId } = await params;
  const { email } = (await req.json()) as { email: string };

  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  const user = users?.users?.find((u) => u.email === email);

  if (!user) {
    return NextResponse.json({ error: "No user found with that email" }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("tenant_users")
    .upsert({ user_id: user.id, tenant_id: tenantId });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
