import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  email: string;
}

/**
 * The verified signed-in user, or a redirect to /login.
 * Call this at the start of every data function and Server Action: proxy.ts only redirects,
 * it doesn't protect anything on its own.
 *
 * React's `cache()` (not the same as Next's caching) dedupes calls within one request,
 * so many components can call this and the session is only checked once.
 */
export const requireUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : "" };
});
