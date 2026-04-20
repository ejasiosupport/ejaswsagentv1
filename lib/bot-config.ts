import { supabaseAdmin } from "./supabase-admin";
import SYSTEM_PROMPT from "./system-prompt";

interface BotConfig {
  bot_name: string;
  system_prompt: string;
}

const cache = new Map<string, BotConfig & { fetchedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getBotConfig(tenantId: string): Promise<BotConfig> {
  const cached = cache.get(tenantId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { bot_name: cached.bot_name, system_prompt: cached.system_prompt };
  }

  const { data } = await supabaseAdmin
    .from("bot_config")
    .select("bot_name, system_prompt")
    .eq("tenant_id", tenantId)
    .single();

  if (data) {
    cache.set(tenantId, { ...data, fetchedAt: Date.now() });
    return data;
  }

  return { bot_name: "Assistant", system_prompt: SYSTEM_PROMPT };
}

export function invalidateBotConfigCache(tenantId: string) {
  cache.delete(tenantId);
}
