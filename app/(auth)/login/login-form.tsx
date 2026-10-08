"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { signIn, type SignInState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const next = useSearchParams().get("next") ?? "/";
  // useActionState wires a Server Action to a form: `state` is whatever the action returned
  // last time (here, an error message), and `pending` is true while it runs.
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signIn, {});

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm">
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          aria-invalid={Boolean(state.error) || undefined}
          className="h-10"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state.error) || undefined}
          aria-describedby={state.error ? "login-error" : undefined}
          className="h-10"
        />
      </div>
      {state.error && (
        <p id="login-error" role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" className="h-10" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Sign in
      </Button>
    </form>
  );
}
