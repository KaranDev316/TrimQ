import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { serverSupabaseOptions } from "./realtimeTransport.js";

function createRouteHandlerClient(cookieStore) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
    (
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    )?.trim(),
    {
      ...serverSupabaseOptions,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // `setAll` throws in Server Components; safe to ignore here since
            // this client is only used inside route handlers.
          }
        },
      },
    }
  );
}

// Returns the authenticated Supabase Auth user, or null if there is no valid
// session. Called at the top of every /app/api/barber/** route handler.
// There is exactly one barber account (no signup UI), so no role/permission
// distinction beyond "is there a logged-in user" is needed.
export async function requireBarberSession(request) {
  const cookieStore = await cookies();

  const supabase = createRouteHandlerClient(cookieStore);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}
