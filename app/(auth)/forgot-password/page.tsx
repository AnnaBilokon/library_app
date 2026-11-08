import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, authLinkClass } from "../auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell subtitle="We'll email you a link to choose a new password.">
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className={authLinkClass}>
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
