/** Only allow redirects to paths on this site (no "//evil.com" or absolute URLs). */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}
