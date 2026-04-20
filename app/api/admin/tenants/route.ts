import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isSessionAdmin } from "@/lib/session";
import SYSTEM_PROMPT from "@/lib/system-prompt";

// GET /api/admin/tenants — list all tenants
export async function GET() {
  if (!(await isSessionAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("tenants")
    .select("id, name, whatsapp_phone_number_id, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/admin/tenants — create a new tenant
export async function POST(req: NextRequest) {
  if (!(await isSessionAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    name: string;
    whatsapp_phone_number_id: string;
    whatsapp_access_token: string;
    user_email?: string;
  };

  if (!body.name || !body.whatsapp_phone_number_id || !body.whatsapp_access_token) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Create tenant
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from("tenants")
    .insert({
      name: body.name,
      whatsapp_phone_number_id: body.whatsapp_phone_number_id,
      whatsapp_access_token: body.whatsapp_access_token,
    })
    .select()
    .single();

  if (tenantError || !tenant) {
    return NextResponse.json({ error: tenantError?.message ?? "Failed to create tenant" }, { status: 500 });
  }

  // Create default bot_config for this tenant
  await supabaseAdmin.from("bot_config").insert({
    tenant_id: tenant.id,
    bot_name: "Assistant",
    system_prompt: SYSTEM_PROMPT,
  });

  // Optionally assign a user by email
  if (body.user_email) {
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const user = users?.users?.find((u) => u.email === body.user_email);
    if (user) {
      await supabaseAdmin.from("tenant_users").insert({
        user_id: user.id,
        tenant_id: tenant.id,
      });
    }
  }

  return NextResponse.json(tenant, { status: 201 });
}
