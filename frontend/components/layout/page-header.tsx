import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface Crumb {
  label: string;
  /** Omit for the current page. */
  href?: string;
}

/**
 * The top of every page inside the shell: breadcrumb, title, optional lede, and
 * a slot for page actions.
 *
 * Actions come last in the DOM on small screens so the title is read first, but
 * sit on the right at desktop width.
 *
 * Full width, with padding rather than a measure. There was a 72rem cap here, and
 * on a wide screen it left the working area floating in the middle of the window
 * with empty gutters either side — worst of all in the settings area, where a rail
 * has already taken its bite. Half the screens in the product had opted out of it
 * one at a time, which is the sign that a default is wrong rather than that those
 * screens are special. What genuinely needs a measure is prose, and prose caps
 * itself where it appears.
 */
export function PageHeader({
  title,
  description,
  crumbs,
  actions,
}: {
  title: string;
  description?: string;
  crumbs?: Crumb[];
  actions?: React.ReactNode;
}) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="flex flex-col gap-3 px-4 py-4 sm:px-6">
        {crumbs !== undefined && crumbs.length > 0 && (
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-muted">
              {crumbs.map((crumb, index) => (
                <li key={crumb.label} className="flex items-center gap-1">
                  {index > 0 && (
                    <ChevronRight
                      className="size-3 shrink-0 text-subtle"
                      aria-hidden="true"
                    />
                  )}
                  {crumb.href === undefined ? (
                    <span aria-current="page" className="text-muted">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      href={crumb.href}
                      className="rounded text-muted transition-colors hover:text-text"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-2xl font-semibold text-text">{title}</h1>
            {description !== undefined && (
              <p className="max-w-2xl text-sm text-muted">{description}</p>
            )}
          </div>
          {actions !== undefined && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          )}
        </div>
      </div>
    </header>
  );
}

/** Standard content well. Padded like the header, so their edges line up. */
export function PageBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5 px-4 py-5 sm:px-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
