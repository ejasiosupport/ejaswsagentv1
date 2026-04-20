import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isSessionAdmin } from "@/lib/session";

export interface TenantStat {
  id: string;
  name: string;
  whatsapp_phone_number_id: string;
  created_at: string;
  total_conversations: number;
  messages_today: number;
  last_message_at: string | null;
}

export async function GET() {
  if (!(await isSessionAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: tenants } = await supabaseAdmin
    .from("tenants")
    .select("id, name, whatsapp_phone_number_id, created_at")
    .order("created_at", { ascending: true });

  if (!tenants) return NextResponse.json([]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const stats: TenantStat[] = await Promise.all(
    tenants.map(async (tenant) => {
      // Total conversations
      const { count: totalConvs } = await supabaseAdmin
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id);

      // Messages sent today
      const { count: msgsToday } = await supabaseAdmin
        .from("messages")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayStart.toISOString())
        .in(
          "conversation_id",
          (
            await supabaseAdmin
              .from("conversations")
              .select("id")
              .eq("tenant_id", tenant.id)
          ).data?.map((c) => c.id) ?? []
        );

      // Last message timestamp
      const { data: lastMsgRow } = await supabaseAdmin
        .from("conversations")
        .select("updated_at")
        .eq("tenant_id", tenant.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      return {
        id: tenant.id,
        name: tenant.name,
        whatsapp_phone_number_id: tenant.whatsapp_phone_number_id,
        created_at: tenant.created_at,
        total_conversations: totalConvs ?? 0,
        messages_today: msgsToday ?? 0,
        last_message_at: lastMsgRow?.updated_at ?? null,
      };
    })
  );

  return NextResponse.json(stats);
}
