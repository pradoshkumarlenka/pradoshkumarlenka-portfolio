import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "./config";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Acts as the signed-in visitor (session from cookies) — every query is
 * filtered by row-level security, so it can never do more than that user may.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component (read-only cookies). The proxy refreshes the session instead.
        }
      },
    },
  });
}
