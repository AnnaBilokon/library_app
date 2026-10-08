import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@/lib/database.types";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * It acts as the signed-in user (via the session cookie), so RLS applies to every query.
 * Create one per request; never share it between requests.
 */
export async function createClient() {
  const cookieStore = await cookies();
  // Session checks compare token expiry with the current time. connection() tells Next.js this
  // work happens per request, so it is never prerendered (and never served from a cache).
  await connection();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Components can't set cookies. That's fine: proxy.ts refreshes the session.
          }
        },
      },
    },
  );
}
