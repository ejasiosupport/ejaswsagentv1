import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabase-admin";

export interface TenantSession {
  userId: string;
  tenantId: string;
  tenantName: string;
  whatsappPhoneNumberId: string;
  whatsappAccessToken: string;
}

export async function getSessionTenant(): Promise<TenantSession | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabaseAdmin
      .from("tenant_users")
      .select("tenant_id, tenants(id, name, whatsapp_phone_number_id, whatsapp_access_token)")
      .eq("user_id", user.id)
      .single();

    if (!data?.tenants) return null;

    const tenant = data.tenants as {
      id: string;
      name: string;
      whatsapp_phone_number_id: string;
      whatsapp_access_token: string;
    };

    return {
      userId: user.id,
      tenantId: tenant.id,
      tenantName: tenant.name,
      whatsappPhoneNumberId: tenant.whatsapp_phone_number_id,
      whatsappAccessToken: tenant.whatsapp_access_token,
    };
  } catch {
    return null;
  }
}

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// Super admin = logged-in user with no tenant assignment
export async function isSessionAdmin(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data } = await supabaseAdmin
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    return data === null;
  } catch {
    return false;
  }
}
