/** Editorial page title: a small eyebrow line above a large serif heading. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-2">
        {eyebrow && <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">{eyebrow}</p>}
        <h1 className="font-heading text-4xl font-semibold tracking-tight text-heading md:text-6xl">{title}</h1>
        {description && <p className="max-w-prose text-muted-foreground md:text-lg">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
