import { createBrowserClient } from "@supabase/ssr";

// Publishable-key (anon) client for anything browser-facing. Uses @supabase/ssr's
// browser client so the auth session is persisted to cookies, which the barber
// API routes read via /lib/supabase/authCheck.js.
export const supabaseClient = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
  (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )?.trim()
);
