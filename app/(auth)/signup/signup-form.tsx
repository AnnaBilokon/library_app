"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { signUp, type EmailFormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmailSent } from "../email-sent";

export function SignUpForm() {
  const [state, formAction, pending] = useActionState<EmailFormState, FormData>(signUp, {});

  if (state.sent) {
    return (
      <EmailSent>
        We sent a link to <strong className="font-medium text-foreground">{state.email}</strong>. Open it to finish
        creating your account.
      </EmailSent>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm">
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
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          aria-invalid={Boolean(state.error) || undefined}
          aria-describedby={state.error ? "signup-error password-hint" : "password-hint"}
          className="h-10"
        />
        <p id="password-hint" className="text-xs text-muted-foreground">
          At least 8 characters.
        </p>
      </div>
      {state.error && (
        <p id="signup-error" role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" className="h-10" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Create account
      </Button>
    </form>
  );
}
