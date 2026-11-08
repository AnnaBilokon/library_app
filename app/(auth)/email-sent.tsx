import { MailCheck } from "lucide-react";

/** Takes the form's place once an email with a link has gone out. */
export function EmailSent({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center shadow-sm">
      <MailCheck className="size-8 text-primary" aria-hidden />
      <p className="font-medium">Check your inbox</p>
      <p className="text-sm text-muted-foreground">{children}</p>
      <p className="text-xs text-muted-foreground">Nothing there? Look in spam, or try again in a few minutes.</p>
    </div>
  );
}
