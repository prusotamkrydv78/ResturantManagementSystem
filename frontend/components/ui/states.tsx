import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Grey placeholder block used while real content loads. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-surface-3", className)}
      aria-hidden="true"
    />
  );
}

/**
 * Placeholder rows shaped like the table they replace, so the layout does not
 * jump when data arrives.
 */
export function TableSkeleton({
  rows = 4,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex items-center gap-4 border-b border-border px-4 py-3"
        >
          {Array.from({ length: columns }, (_, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={cn("h-4", columnIndex === 0 ? "w-1/3" : "w-1/6")}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Inline spinner with an accessible label. */
export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-muted">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      {label}
    </span>
  );
}

/**
 * Shown when a collection is legitimately empty. Always says what the thing is
 * and offers the action that would fill it.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      {icon !== undefined && (
        <span
          className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface-2 text-muted [&_svg]:size-4.5"
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <div className="flex flex-col gap-1">
        <p className="text-base font-medium text-text">{title}</p>
        {description !== undefined && (
          <p className="mx-auto max-w-sm text-sm text-muted">{description}</p>
        )}
      </div>
      {action !== undefined && <div className="mt-1">{action}</div>}
    </div>
  );
}

/**
 * Shown when a request failed. Explains what did not work and offers a retry
 * rather than apologising.
 */
export function ErrorState({
  title = "Could not load this",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 px-4 py-6 sm:flex-row sm:items-center"
    >
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-md border border-danger-border bg-danger-soft text-danger"
        aria-hidden="true"
      >
        <AlertTriangle className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-base font-medium text-text">{title}</p>
        <p className="text-sm text-muted">{message}</p>
      </div>
      {onRetry !== undefined && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm font-medium text-text transition-colors hover:bg-surface-3"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/** Compact inline form error, styled to match ErrorState. */
export function FormError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md border border-danger-border bg-danger-soft px-2.5 py-2 text-sm text-danger"
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0">{message}</span>
    </p>
  );
}

/** Compact inline success confirmation, the counterpart to FormError. */
export function FormSuccess({ message }: { message: string }) {
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-md border border-success-border bg-success-soft px-2.5 py-2 text-sm text-success"
    >
      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0">{message}</span>
    </p>
  );
}
