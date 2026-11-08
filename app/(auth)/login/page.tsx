import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell, authLinkClass } from "../auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthShell subtitle="Sign in to see your books.">
      {/* The form reads ?next= and ?error= from the URL, which are only known at request time. */}
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        No account yet?{" "}
        <Link href="/signup" className={authLinkClass}>
          Create one
        </Link>
      </p>
    </AuthShell>
  );
}
