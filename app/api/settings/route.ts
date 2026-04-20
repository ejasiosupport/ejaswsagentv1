import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionTenant } from "@/lib/session";
import { invalidateBotConfigCache } from "@/lib/bot-config";

export async function GET() {
  const session = await getSessionTenant();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("bot_config")
    .select("id, bot_name, system_prompt, updated_at")
    .eq("tenant_id", session.tenantId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionTenant();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { bot_name?: string; system_prompt?: string };
  const updates: Record<string, string> = { updated_at: new Date().toISOString() };
  if (body.bot_name !== undefined) updates.bot_name = body.bot_name;
  if (body.system_prompt !== undefined) updates.system_prompt = body.system_prompt;

  const { data, error } = await supabaseAdmin
    .from("bot_config")
    .update(updates)
    .eq("tenant_id", session.tenantId)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }

  invalidateBotConfigCache(session.tenantId);
  return NextResponse.json(data);
}
