import { Skeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils/cn";

/**
 * The grid every list in the product is laid out on.
 *
 * A table answers "compare this column down the page"; a card answers "what is this
 * one thing". Most of these lists are the second question - a manager is looking for
 * a dish, a table, a person - and a row of five columns spends the whole width of a
 * modern screen on alignment nobody is reading down.
 *
 * One component rather than a grid class copied into five pages, so the column counts
 * and the gap cannot drift apart, and so the loading state below is always the shape
 * of what is about to replace it.
 *
 * Five across at the top end. The application is used on wide screens in an office
 * and on a laptop at the pass, and the ladder is chosen so a card never gets narrower
 * than about 15rem - past that a name starts wrapping and the grid stops being
 * scannable, which is the only thing it was for.
 */
const COLUMNS = "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

export function CardGrid({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-4 p-4", COLUMNS, className)}>{children}</div>
  );
}

/**
 * One card. The shell only - what goes inside is the caller's business.
 *
 * `flex-col` with the content free to grow is what lets a caller push a footer down
 * with `mt-auto`, so the buttons across a row line up however long the text above
 * them runs.
 */
export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-border bg-surface-2",
        className,
      )}
    >
      {children}
    </article>
  );
}

/**
 * Placeholders while a grid loads.
 *
 * Shaped like the cards they stand in for, so the page does not rearrange itself the
 * moment the data lands. `hasMedia` because some of these lists carry a photograph
 * and some are text only, and a grey rectangle where no picture is coming would be a
 * promise the real card does not keep.
 */
export function CardGridSkeleton({
  count = 10,
  hasMedia = false,
}: {
  count?: number;
  hasMedia?: boolean;
}) {
  return (
    <CardGrid>
      {Array.from({ length: count }, (_, index) => (
        <Card key={index}>
          {hasMedia && <Skeleton className="aspect-4/3 w-full rounded-none" />}
          <div className="flex flex-col gap-2 p-3.5">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-8 w-24 self-end" />
          </div>
        </Card>
      ))}
    </CardGrid>
  );
}
