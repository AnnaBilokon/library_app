import type { Metadata } from "next";
import { AuthShell } from "../auth-shell";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

/** Opened from a reset email via /auth/confirm, which has already signed you in. */
export default function ResetPasswordPage() {
  return (
    <AuthShell subtitle="Choose a new password.">
      <ResetPasswordForm />
    </AuthShell>
  );
}
