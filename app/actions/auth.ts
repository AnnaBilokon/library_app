"use server";

// Server Actions: functions that run on the server but can be called from a form or a Client
// Component like a normal function. Each one is a public HTTP endpoint, so validate the input.

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const signInSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

export interface SignInState {
  error?: string;
  email?: string;
}

/** Only allow redirects to paths on this site (no "//evil.com" or absolute URLs). */
function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return {
      error: error.code === "invalid_credentials" ? "Wrong email or password." : `Couldn't sign in: ${error.message}`,
      email,
    };
  }

  redirect(safeNext(parsed.data.next));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
