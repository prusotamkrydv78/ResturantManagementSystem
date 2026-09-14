"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { crumbsFor } from "@/lib/navigation/breadcrumbs";
import { cn } from "@/lib/utils/cn";

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
 *
 * The breadcrumb is not passed in. It is read off the route, because the route already
 * knows: every screen used to type out its own trail, and forty-one hand-written copies
 * of the same trunk drifted exactly as far apart as you would expect. A screen supplies
 * only what the URL cannot say - the name of the record it is showing - and only when it
 * has one; until then the trail says "Order" rather than flickering or vanishing.
 */
export function PageHeader({
  title,
  description,
  crumb,
  actions,
}: {
  title: string;
  description?: string;
  /**
   * What this page calls the thing it is showing, for the last step of the trail.
   *
   * Only for a record with a name of its own: a list screen, a form, anything whose
   * label is a property of the route rather than of the data, is already named in the
   * route table and should not be named twice.
   */
  crumb?: string;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams();

  const crumbs = crumbsFor(pathname, params, crumb);

  return (
    <header className="border-b border-border bg-surface">
      <div className="flex flex-col gap-3 px-4 py-3.5">
        {crumbs.length > 0 && (
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-muted">
              {crumbs.map((step, index) => (
                // Keyed by position: the trail is derived fresh from the route every
                // render, and a record named after its own section would otherwise
                // collide with the section above it.
                <li key={index} className="flex items-center gap-1">
                  {index > 0 && (
                    <ChevronRight
                      className="size-3 shrink-0 text-subtle"
                      aria-hidden="true"
                    />
                  )}
                  {step.href === undefined ? (
                    <span aria-current="page" className="text-muted">
                      {step.label}
                    </span>
                  ) : (
                    <Link
                      href={step.href}
                      className="rounded text-muted transition-colors hover:text-text"
                    >
                      {step.label}
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

/**
 * Standard content well. Padded like the header, so their edges line up.
 *
 * One gutter at every width, rather than sixteen pixels on a phone widening to
 * twenty-four from the small breakpoint up. The wider gutter was inherited from a
 * layout that centred its content and had room to spend; this shell does not centre
 * anything, so the extra eight pixels were not breathing room between the content and
 * the edge of the window - they were a trench between the sidebar and the work, and
 * they cost the same eight on the far side of a dense table.
 */
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
        "flex flex-col gap-4 px-4 py-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
