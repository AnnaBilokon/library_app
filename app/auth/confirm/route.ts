import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

/**
 * Where the links in sign-up and password-reset emails land. It signs the visitor in, then opens
 * ?next= (the home page, or /reset-password to choose a new password).
 *
 * Supabase's default emails arrive with ?code=, which only works in the browser the form was sent
 * from (it holds the other half of the code in a cookie). Emails edited to link here with
 * ?token_hash=…&type=… work on any device; see the README.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : { error: new Error("The link is missing its code.") };

  // Expired, already used, or opened in another browser.
  if (error) redirect("/login?error=link");
  redirect(safeNext(searchParams.get("next")));
}
