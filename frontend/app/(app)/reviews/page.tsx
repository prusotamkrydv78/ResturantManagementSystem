"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquareQuote, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Surface } from "@/components/ui/surface";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { listReviews } from "@/features/reviews/api";
import { cn } from "@/lib/utils/cn";
import type { RestaurantReview, ReviewSummary } from "@/types/review";

/**
 * What tables thought of their visits.
 *
 * Manager only. A waiter can see a table's order and take its money; how the restaurant
 * is being scored is a different question, and one a manager acts on rather than the
 * person being scored.
 *
 * Every review carries the order it came from, so a poor score is not just a number - it
 * leads to what that table ate and who served them, which is the difference between
 * knowing something went wrong and being able to do anything about it.
 */
export default function ReviewsPage() {
  return (
    <RequireAuth roles={["RestaurantManager"]}>
      <Reviews />
    </RequireAuth>
  );
}

function Reviews() {
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await listReviews();

        if (!cancelled) {
          setSummary(loaded);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load reviews.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <>
      <PageHeader
        title="Reviews"
        description="What tables said after they paid. Every one comes from a settled bill."
        crumbs={[{ label: "Workspace", href: "/dashboard" }, { label: "Reviews" }]}
        actions={
          summary !== null && summary.averageRating !== null ? (
            <Badge tone={summary.averageRating >= 4 ? "success" : "warning"} dot>
              {summary.averageRating.toFixed(1)} from {summary.count}
            </Badge>
          ) : undefined
        }
      />

      <PageBody>
        {error !== null ? (
          <Surface>
            <ErrorState
              message={error}
              onRetry={() => setReloadKey((key) => key + 1)}
            />
          </Surface>
        ) : summary === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((row) => (
              <Surface key={row} className="flex flex-col gap-2 p-4">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-64" />
              </Surface>
            ))}
          </div>
        ) : summary.count === 0 ? (
          <Surface>
            <EmptyState
              icon={<MessageSquareQuote />}
              title="No reviews yet"
              description="A guest is asked how it went once their bill is settled, and what they say appears here."
            />
          </Surface>
        ) : (
          <>
            {/* The three averages together, because they answer different questions. A
                single overall figure tells a manager something is wrong; the split
                between food and service tells them where to look. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Average label="Overall" value={summary.averageRating} />
              <Average label="Food" value={summary.averageFoodRating} />
              <Average label="Service" value={summary.averageServiceRating} />
            </div>

            <ul className="flex flex-col gap-3">
              {summary.reviews.map((review) => (
                <li key={review.id}>
                  <ReviewCard review={review} />
                </li>
              ))}
            </ul>

            {summary.reviews.length < summary.count && (
              <p className="text-center text-2xs text-subtle">
                Showing the {summary.reviews.length} most recent of {summary.count}.
              </p>
            )}
          </>
        )}
      </PageBody>
    </>
  );
}

/** One of the three headline figures. */
function Average({ label, value }: { label: string; value: number | null }) {
  return (
    <Surface className="flex flex-col gap-1 p-4">
      <span className="text-2xs font-medium tracking-wide text-muted uppercase">
        {label}
      </span>

      {value === null ? (
        // Not a zero. Nobody has rated this restaurant nothing, and showing 0.0 would
        // read as the worst possible score rather than as an unanswered question.
        <span className="text-sm text-subtle">Not rated yet</span>
      ) : (
        <span className="flex items-baseline gap-2">
          <span className="tabular text-2xl font-semibold text-text">
            {value.toFixed(1)}
          </span>
          <Stars value={Math.round(value)} />
        </span>
      )}
    </Surface>
  );
}

function ReviewCard({ review }: { review: RestaurantReview }) {
  return (
    <Surface className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Stars value={review.rating} />
          <span className="text-2xs text-subtle">
            {review.tableName} · order #{review.orderNumber}
            {review.servedByName !== null && ` · served by ${review.servedByName}`}
          </span>
        </div>

        <span className="shrink-0 text-2xs text-subtle">
          {formatWhen(review.submittedAtUtc)}
        </span>
      </div>

      {review.comment !== null && (
        <p className="text-sm text-text">“{review.comment}”</p>
      )}

      {(review.foodRating !== null || review.serviceRating !== null) && (
        <div className="flex flex-wrap gap-4 border-t border-border pt-2">
          {review.foodRating !== null && (
            <span className="flex items-center gap-1.5 text-2xs text-muted">
              Food <Stars value={review.foodRating} small />
            </span>
          )}
          {review.serviceRating !== null && (
            <span className="flex items-center gap-1.5 text-2xs text-muted">
              Service <Stars value={review.serviceRating} small />
            </span>
          )}
        </div>
      )}

      <Link
        href={`/billing/${review.orderId}`}
        className="text-2xs font-medium text-primary hover:underline"
      >
        See what they were served →
      </Link>
    </Surface>
  );
}

/** Five stars, of which the score is lit. */
function Stars({ value, small = false }: { value: number; small?: boolean }) {
  return (
    <span
      className="flex items-center gap-0.5"
      role="img"
      aria-label={`${value} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((score) => (
        <Star
          key={score}
          aria-hidden="true"
          className={cn(
            small ? "size-3" : "size-4",
            score <= value ? "fill-warning text-warning" : "text-subtle",
          )}
        />
      ))}
    </span>
  );
}

/** When it was left, in the terms somebody reading a list of them thinks in. */
function formatWhen(isoString: string): string {
  const at = new Date(isoString);

  if (Number.isNaN(at.getTime())) {
    return "—";
  }

  return at.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
