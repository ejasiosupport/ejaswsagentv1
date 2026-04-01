import { createBrowserClient } from "@supabase/ssr";

// Client-side (cookie-based session for auth)
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
