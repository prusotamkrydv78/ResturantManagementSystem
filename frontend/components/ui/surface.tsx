import { cn } from "@/lib/utils/cn";

/**
 * A bordered panel. The one container in the product, so panels cannot drift
 * into a dozen different card treatments. Elevation stays flat by default.
 */
export function Surface({
  className,
  children,
  ...divProps
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface",
        className,
      )}
      {...divProps}
    >
      {children}
    </div>
  );
}

/** Header strip inside a Surface: title on the left, actions on the right. */
export function SurfaceHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="text-lg font-semibold text-text">{title}</h2>
        {description !== undefined && (
          <p className="text-xs text-muted">{description}</p>
        )}
      </div>
      {actions !== undefined && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

/** A label/value row, used for detail views. */
export function DetailRow({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-40 shrink-0 text-xs font-medium tracking-wide text-muted uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "min-w-0 break-words text-base text-text",
          mono && "font-mono text-sm",
        )}
      >
        {children}
      </dd>
    </div>
  );
}
