"use server";

// Server Actions: functions that run on the server but can be called from a form or a Client
// Component like a normal function. Each one is a public HTTP endpoint, so validate the input.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

const email = z.email("Enter a valid email address.");
// Supabase stops reading a password after 72 bytes, so a longer one would be silently cut.
const newPassword = z.string().min(8, "Use at least 8 characters.").max(72, "Use at most 72 characters.");

const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});
const signUpSchema = z.object({ email, password: newPassword });
const resetSchema = z.object({ email });
const updatePasswordSchema = z.object({ password: newPassword });

export interface SignInState {
  error?: string;
  email?: string;
}

/** `sent`: the email went out, so the form shows "check your inbox" instead. */
export interface EmailFormState {
  error?: string;
  email?: string;
  sent?: boolean;
}

export interface PasswordState {
  error?: string;
}

/**
 * Where an email link should land: /auth/confirm on the site the form was sent from, which signs
 * the visitor in and then opens `next`. Supabase only follows it if the URL is listed under
 * Authentication → URL Configuration → Redirect URLs (otherwise it falls back to the Site URL).
 */
async function confirmUrl(next: string) {
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  return `${origin}/auth/confirm?next=${encodeURIComponent(next)}`;
}

/** Supabase's error codes, in words. */
function authError(error: { code?: string; message: string }, action: string): string {
  switch (error.code) {
    case "weak_password":
      return "That password is too easy to guess. Try a longer one.";
    case "same_password":
      return "That's your current password. Pick a new one.";
    case "user_already_exists":
    case "email_exists":
      return "There's already an account with this email. Sign in instead.";
    case "signup_disabled":
      return "New accounts can't be created right now.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many emails for now. Try again in a little while.";
    default:
      return `Couldn't ${action}: ${error.message}`;
  }
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
      error:
        error.code === "invalid_credentials"
          ? "Wrong email or password."
          : error.code === "email_not_confirmed"
            ? "Open the link we emailed you first, then sign in."
            : `Couldn't sign in: ${error.message}`,
      email,
    };
  }

  redirect(safeNext(parsed.data.next));
}

export async function signUp(_prev: EmailFormState, formData: FormData): Promise<EmailFormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: await confirmUrl("/") },
  });
  if (error) return { error: authError(error, "create your account"), email };

  // With email confirmation on (Supabase's default) there's no session until the link is opened.
  // Supabase answers the same way for an email that already has an account, so nobody can use
  // this form to find out who has one.
  if (!data.session) return { sent: true, email };
  redirect("/");
}

export async function requestPasswordReset(_prev: EmailFormState, formData: FormData): Promise<EmailFormState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: await confirmUrl("/reset-password"),
  });
  // An unknown email isn't an error either, for the same reason as above.
  if (error) return { error: authError(error, "send the email"), email };
  return { sent: true, email };
}

/** The new password, for a user signed in by a reset link (or already signed in). */
export async function updatePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const parsed = updatePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: authError(error, "change your password") };
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
