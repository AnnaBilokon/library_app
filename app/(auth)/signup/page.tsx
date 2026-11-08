import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, authLinkClass } from "../auth-shell";
import { SignUpForm } from "./signup-form";

export const metadata: Metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <AuthShell subtitle="Create an account for your own library.">
      <SignUpForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className={authLinkClass}>
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
