import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  email: string;
  /** Manages the shared catalog. Set as app_metadata.role = "admin" (pnpm catalog:seed --make-admin). */
  isAdmin: boolean;
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
  const role = (claims.app_metadata as { role?: unknown } | undefined)?.role;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : "", isAdmin: role === "admin" };
});

/**
 * The signed-in admin, or a 404 for everyone else (admin pages don't reveal that they exist).
 * The database checks the same role (public.is_admin()), so this is the friendly half.
 */
export const requireAdmin = cache(async (): Promise<CurrentUser> => {
  const user = await requireUser();
  if (!user.isAdmin) notFound();
  return user;
});
