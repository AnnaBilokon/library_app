import type { Metadata } from "next";
import { Suspense } from "react";
import { LogoMark, Wordmark } from "@/components/layout/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <LogoMark className="size-14" />
          <h1>
            <Wordmark className="text-4xl" />
          </h1>
          <p className="text-sm text-muted-foreground">Sign in to see your books.</p>
        </div>
        {/* The form reads ?next= from the URL, which is only known at request time. */}
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
