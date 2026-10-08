import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

/** Paths that don't need a signed-in user. */
const PUBLIC_PATHS = ["/login", "/auth"];

/**
 * Runs before every matched request (see proxy.ts):
 * 1. refreshes the Supabase session and writes the new cookies to the response;
 * 2. sends signed-out visitors to /login, and signed-in users away from /login.
 *
 * The redirect is only a convenience. Real protection is RLS plus the checks in lib/auth.ts.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          // Stops CDNs from caching a response that carries someone's session cookie.
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Don't put any code between createServerClient and getClaims(): getClaims() is what refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!signedIn && !isPublic) {
    return redirectKeepingCookies(request, response, "/login", pathname + search);
  }
  if (signedIn && pathname === "/login") {
    return redirectKeepingCookies(request, response, "/");
  }

  // Return this exact response object so the refreshed cookies reach the browser.
  return response;
}

function redirectKeepingCookies(request: NextRequest, from: NextResponse, to: string, next?: string) {
  const url = request.nextUrl.clone();
  url.pathname = to;
  url.search = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  from.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") redirect.headers.set(key, value);
  });
  return redirect;
}
