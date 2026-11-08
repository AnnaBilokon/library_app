"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { requestPasswordReset, type EmailFormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmailSent } from "../email-sent";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<EmailFormState, FormData>(requestPasswordReset, {});

  if (state.sent) {
    return (
      <EmailSent>
        If there&rsquo;s an account for <strong className="font-medium text-foreground">{state.email}</strong>, we sent
        it a link to choose a new password.
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
          aria-describedby={state.error ? "reset-error" : undefined}
          className="h-10"
        />
      </div>
      {state.error && (
        <p id="reset-error" role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" className="h-10" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Send link
      </Button>
    </form>
  );
}
