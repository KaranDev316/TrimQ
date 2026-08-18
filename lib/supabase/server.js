import { createClient } from "@supabase/supabase-js";
import { serverSupabaseOptions } from "./realtimeTransport.js";

// Server-only helper: never import this file into a client component.
export const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
  (
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  )?.trim(),
  serverSupabaseOptions
);
