"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  MessageSquareQuote,
  RefreshCw,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/filter-chip";
import { Select } from "@/components/ui/select";
import { Surface, SurfaceHeader } from "@/components/ui/surface";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { listReviews } from "@/features/reviews/api";
import { sinceLabel, useNow } from "@/lib/time/since";
import { cn } from "@/lib/utils/cn";
import type { RestaurantReview, ReviewSummary } from "@/types/review";

/**
 * What tables thought of their visits.
 *
 * Manager only. A waiter can see a table's order and take its money; how the restaurant
 * is being scored is a different question, and one a manager acts on rather than the
 * person being scored.
 *
 * The page is built around the two things a mean cannot say. The first is shape: four
 * point zero is every table saying four, or half of them delighted and half of them
 * furious, and those are different restaurants with the same headline figure. The second
 * is direction: a lifetime average barely moves once a few hundred reviews are in, so a
 * restaurant can be getting worse for a month without the number on the page admitting
 * it. The distribution answers the first; the last thirty days read against the thirty
 * before them answer the second.
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

/**
 * How many reviews the list holds.
 *
 * Deliberately more than fits on a screen. The headline figures are worked out over
 * every review by the server, so this number only decides how far back the list and the
 * filters below reach - and a manager narrowing to one-star reviews wants more than a
 * fortnight of them.
 */
const PAGE_SIZE = 100;

function Reviews() {
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const [sort, setSort] = useState<Sort>("newest");

  const now = useNow(60_000);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await listReviews(PAGE_SIZE);

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

  const reviews = useMemo(() => summary?.reviews ?? [], [summary]);

  // Over the loaded list rather than over every review, which is what the chips then
  // have to say out loud. The server counts the whole history for the figures at the
  // top; it does not count it by filter, and a chip promising a number the list could
  // not then produce would be worse than one that admits its scope.
  const counts = useMemo(
    () => ({
      all: reviews.length,
      commented: reviews.filter((review) => review.comment !== null).length,
      poor: reviews.filter((review) => review.rating <= POOR_AT_OR_BELOW).length,
    }),
    [reviews],
  );

  const shown = useMemo(() => {
    const kept = reviews.filter((review) => matches(review, filter));

    // Copied before sorting: the array behind it belongs to the loaded summary, and
    // sorting in place would reorder the thing every other reading here derives from.
    return [...kept].sort(COMPARE[sort]);
  }, [reviews, filter, sort]);

  return (
    <>
      <PageHeader
        title="Reviews"
        description="What tables said after they paid. Every one comes from a settled bill."
        actions={
          <div className="flex items-center gap-2">
            {summary !== null && summary.averageRating !== null && (
              <Badge tone={summary.averageRating >= 4 ? "success" : "warning"} dot>
                {summary.averageRating.toFixed(1)} from {summary.count}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw />}
              onClick={() => setReloadKey((key) => key + 1)}
            >
              Refresh
            </Button>
          </div>
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((cell) => (
                <Surface key={cell} className="flex flex-col gap-2 p-4">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-7 w-24" />
                </Surface>
              ))}
            </div>

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
            {/* The four figures together, because they answer different questions. A
                single overall score says something is wrong; the split between food and
                service says where to look; the last thirty days say whether it is
                happening now, or happened once a year ago and has been dragging the
                lifetime mean down ever since. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Average
                label="Overall"
                value={summary.averageRating}
                hint="Every review, since the day this opened."
              />
              <Average
                label="Food"
                value={summary.averageFoodRating}
                hint="Over the tables that rated it separately."
              />
              <Average
                label="Service"
                value={summary.averageServiceRating}
                hint="Over the tables that rated it separately."
              />
              <Lately recent={summary.recent} previous={summary.previous} />
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
              {/* The shape behind the mean, and a way into the list. Clicking a row is
                  the question a manager actually has - show me the ones who said one -
                  and it was a lot of scrolling and squinting before. */}
              <div className="xl:col-span-3">
                <Distribution
                  summary={summary}
                  filter={filter}
                  onPick={(score) =>
                    setFilter((current) =>
                      current.kind === "score" && current.score === score
                        ? { kind: "all" }
                        : { kind: "score", score },
                    )
                  }
                />
              </div>

              <div className="xl:col-span-2">
                <Servers rows={summary.byServer} />
              </div>
            </div>

            <Surface>
              <SurfaceHeader
                title="The reviews"
                description={
                  summary.reviews.length < summary.count
                    ? `The ${summary.reviews.length} most recent of ${summary.count}. Everything below filters within those.`
                    : `All ${summary.count}, newest first.`
                }
                actions={
                  <Select
                    aria-label="Sort reviews"
                    value={sort}
                    onChange={(value) => setSort(value as Sort)}
                    options={SORTS}
                    className="w-44"
                  />
                }
              />

              <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-3">
                <FilterChip
                  active={filter.kind === "all"}
                  count={counts.all}
                  tone="neutral"
                  onClick={() => setFilter({ kind: "all" })}
                >
                  Everything
                </FilterChip>

                <FilterChip
                  active={filter.kind === "commented"}
                  count={counts.commented}
                  tone="neutral"
                  onClick={() => setFilter({ kind: "commented" })}
                >
                  Said something
                </FilterChip>

                <FilterChip
                  active={filter.kind === "poor"}
                  count={counts.poor}
                  tone="danger"
                  onClick={() => setFilter({ kind: "poor" })}
                >
                  Needs a look
                </FilterChip>

                {/* Only while it is the chosen one: a row in the band above put it
                    there, and a permanent chip per score would be five more controls
                    saying what the band already says better. */}
                {filter.kind === "score" && (
                  <FilterChip
                    active
                    count={shown.length}
                    tone="neutral"
                    onClick={() => setFilter({ kind: "all" })}
                  >
                    {filter.score} star{filter.score === 1 ? "" : "s"}
                  </FilterChip>
                )}
              </div>

              {shown.length === 0 ? (
                <EmptyState
                  icon={<MessageSquareQuote />}
                  title="Nothing in this bucket"
                  description={emptyFor(filter, summary.reviews.length)}
                />
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {shown.map((review) => (
                    <li key={review.id}>
                      <ReviewRow review={review} now={now} />
                    </li>
                  ))}
                </ul>
              )}
            </Surface>
          </>
        )}
      </PageBody>
    </>
  );
}

/* ------------------------------------------------------------------ filtering --- */

/** At or below this, somebody had a bad evening and a manager should know whose. */
const POOR_AT_OR_BELOW = 2;

/**
 * Which reviews the list is showing.
 *
 * One value rather than a set of independent toggles: these are four answers to a
 * single question, and two of them at once - one star, and also five - is a state
 * nobody asks for and that every arrangement of checkboxes offers.
 */
type Filter =
  | { kind: "all" }
  | { kind: "commented" }
  | { kind: "poor" }
  | { kind: "score"; score: number };

function matches(review: RestaurantReview, filter: Filter): boolean {
  switch (filter.kind) {
    case "commented":
      return review.comment !== null;
    case "poor":
      return review.rating <= POOR_AT_OR_BELOW;
    case "score":
      return review.rating === filter.score;
    default:
      return true;
  }
}

/** Said in terms of what is loaded, because that is what was actually searched. */
function emptyFor(filter: Filter, loaded: number): string {
  switch (filter.kind) {
    case "commented":
      return `None of the ${loaded} most recent reviews left words, only scores.`;
    case "poor":
      return `Nothing at ${POOR_AT_OR_BELOW} stars or below in the ${loaded} most recent. That is the good outcome.`;
    case "score":
      return `None of the ${loaded} most recent reviews scored ${filter.score}.`;
    default:
      return "There is nothing to show.";
  }
}

type Sort = "newest" | "lowest" | "highest";

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "lowest", label: "Lowest score first" },
  { value: "highest", label: "Highest score first" },
] as const;

/**
 * How the list is ordered.
 *
 * Both score orderings fall back to time, so a screenful of fours keeps a stable order
 * instead of shuffling itself whenever the list is rebuilt.
 */
const COMPARE: Record<Sort, (a: RestaurantReview, b: RestaurantReview) => number> = {
  newest: (a, b) => b.submittedAtUtc.localeCompare(a.submittedAtUtc),
  lowest: (a, b) =>
    a.rating - b.rating || b.submittedAtUtc.localeCompare(a.submittedAtUtc),
  highest: (a, b) =>
    b.rating - a.rating || b.submittedAtUtc.localeCompare(a.submittedAtUtc),
};

/* -------------------------------------------------------------------- figures --- */

/** One of the three lifetime figures. */
function Average({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | null;
  hint: string;
}) {
  return (
    <Surface className="flex flex-col gap-1 p-4">
      <span className="text-2xs font-semibold tracking-wider text-subtle uppercase">
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

      <span className="text-xs text-muted">{hint}</span>
    </Surface>
  );
}

/**
 * The last thirty days, against the thirty before them.
 *
 * The card this page was missing. A lifetime average is a very heavy object: once a few
 * hundred reviews are in, a fortnight of angry tables moves it by a tenth, and the page
 * goes on reporting 4.4 while the dining room is on fire. This is the same restaurant
 * measured twice in a row, which is the only way a number on a screen gets to say
 * "getting worse".
 */
function Lately({
  recent,
  previous,
}: {
  recent: ReviewSummary["recent"];
  previous: ReviewSummary["previous"];
}) {
  return (
    <Surface className="flex flex-col gap-1 p-4">
      <span className="text-2xs font-semibold tracking-wider text-subtle uppercase">
        Last 30 days
      </span>

      {recent.averageRating === null ? (
        <span className="text-sm text-subtle">Nobody reviewed</span>
      ) : (
        <span className="flex items-baseline gap-2">
          <span className="tabular text-2xl font-semibold text-text">
            {recent.averageRating.toFixed(1)}
          </span>
          <Movement
            current={recent.averageRating}
            previous={previous.averageRating}
          />
        </span>
      )}

      <span className="text-xs text-muted">
        {recent.count} review{recent.count === 1 ? "" : "s"}
        {previous.count > 0 ? `, against ${previous.count} the month before` : ""}.
      </span>
    </Surface>
  );
}

/**
 * The change, in stars rather than in percent.
 *
 * A rating is not a quantity, so "down 7%" is arithmetic on a scale that does not carry
 * it. Ratings are talked about in tenths of a star, and that is what this shows. Silent
 * where there is nothing to compare against: an invented direction is worse than an
 * absent one.
 */
function Movement({
  current,
  previous,
}: {
  current: number;
  previous: number | null;
}) {
  if (previous === null) {
    return null;
  }

  const change = Math.round((current - previous) * 10) / 10;

  if (change === 0) {
    return <span className="text-xs text-muted">level</span>;
  }

  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-0.5 text-xs font-medium",
        change > 0 ? "text-success" : "text-danger",
      )}
    >
      {change > 0 ? (
        <ArrowUp className="size-3" aria-hidden="true" />
      ) : (
        <ArrowDown className="size-3" aria-hidden="true" />
      )}
      {Math.abs(change).toFixed(1)}
    </span>
  );
}

/* --------------------------------------------------------------- distribution --- */

/** The five scores as a band, over every review rather than over the loaded page. */
function Distribution({
  summary,
  filter,
  onPick,
}: {
  summary: ReviewSummary;
  filter: Filter;
  onPick: (score: number) => void;
}) {
  // Scaled against the busiest row, not against the total: at 4.6 overall the one- and
  // two-star rows are a pixel each when scaled to the whole, and they are exactly the
  // handful of reviews this card exists to make visible.
  const busiest = Math.max(...summary.distribution.map((bucket) => bucket.count), 1);

  return (
    <Surface className="flex h-full flex-col">
      <SurfaceHeader
        title="How the scores fall"
        description={`All ${summary.count} reviews. ${summary.withCommentCount} of them wrote something as well.`}
      />

      <div className="flex flex-1 flex-col justify-center gap-1.5 p-4">
        {[...summary.distribution].reverse().map((bucket) => {
          const active = filter.kind === "score" && filter.score === bucket.rating;
          const share = summary.count === 0 ? 0 : bucket.count / summary.count;

          return (
            <button
              key={bucket.rating}
              type="button"
              onClick={() => onPick(bucket.rating)}
              aria-pressed={active}
              className={cn(
                "flex items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                active ? "bg-surface-3" : "hover:bg-surface-2",
              )}
            >
              <span className="tabular flex w-10 shrink-0 items-center gap-1 text-xs font-medium text-muted">
                {bucket.rating}
                <Star
                  className="size-3 fill-warning text-warning"
                  aria-hidden="true"
                />
              </span>

              <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                <span
                  className={cn(
                    "block h-full rounded-full",
                    BAR[toneOf(bucket.rating)],
                  )}
                  style={{
                    width: `${Math.round((bucket.count / busiest) * 100)}%`,
                  }}
                />
              </span>

              <span className="tabular w-20 shrink-0 text-right text-xs text-muted">
                {bucket.count}
                <span className="text-subtle"> ({Math.round(share * 100)}%)</span>
              </span>
            </button>
          );
        })}
      </div>
    </Surface>
  );
}

/** Green at the top, amber in the middle, red where somebody had a bad evening. */
function toneOf(rating: number): "good" | "middling" | "bad" {
  if (rating >= 4) {
    return "good";
  }

  return rating === 3 ? "middling" : "bad";
}

const BAR: Record<"good" | "middling" | "bad", string> = {
  good: "bg-success",
  middling: "bg-warning",
  bad: "bg-danger",
};

/* -------------------------------------------------------------------- servers --- */

/**
 * How the tables each member of staff took have scored.
 *
 * This is the reason the order carries the staff member: a run of poor scores on one
 * section is the thing a manager can act on, and no single review ever shows it. Orders
 * a customer placed themselves have nobody to name and are simply absent, rather than
 * pooled under a stand-in that would read as one very unlucky waiter.
 */
function Servers({ rows }: { rows: ReviewSummary["byServer"] }) {
  if (rows.length === 0) {
    return (
      <Surface className="flex h-full flex-col">
        <SurfaceHeader title="By who served" />
        <EmptyState
          title="Nobody to name yet"
          description="Every reviewed order so far was placed by the table itself."
        />
      </Surface>
    );
  }

  return (
    <Surface className="flex h-full flex-col">
      <SurfaceHeader
        title="By who served"
        description="The busiest first, over every review they carried."
      />

      <TableWrap>
        <Table className="min-w-[20rem]">
          <thead>
            <tr>
              <Th>Server</Th>
              <Th className="text-right">Reviews</Th>
              <Th className="text-right">Average</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Tr key={row.staffId}>
                <Td className="font-medium text-text">{row.name}</Td>
                <Td className="tabular text-right text-muted">{row.count}</Td>
                <Td className="text-right">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className={cn(
                        "tabular font-medium",
                        row.averageRating >= 4
                          ? "text-success"
                          : row.averageRating >= 3
                            ? "text-warning"
                            : "text-danger",
                      )}
                    >
                      {row.averageRating.toFixed(1)}
                    </span>
                    <Stars value={Math.round(row.averageRating)} small />
                  </span>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
    </Surface>
  );
}

/* ----------------------------------------------------------------- the review --- */

function ReviewRow({
  review,
  now,
}: {
  review: RestaurantReview;
  now: number | null;
}) {
  const poor = review.rating <= POOR_AT_OR_BELOW;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 px-4 py-3",
        // A left edge rather than a tinted card: the row still reads as one of a list,
        // and the eye finds the bad evenings while scrolling past the good ones.
        poor && "border-l-2 border-l-danger",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Stars value={review.rating} />

          <span className="text-2xs text-subtle">
            {review.tableName} · order #{review.orderNumber}
            {review.servedByName !== null && ` · served by ${review.servedByName}`}
          </span>
        </div>

        {/* Rough on the row, exact on hover. Scanning a list is a question about order
            and recency; the minute it landed matters only once one review is in hand. */}
        <span
          className="shrink-0 text-2xs text-subtle"
          title={formatWhen(review.submittedAtUtc)}
        >
          {sinceLabel(review.submittedAtUtc, now)}
        </span>
      </div>

      {review.comment !== null && (
        <p className="text-sm text-text">“{review.comment}”</p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
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

        <Link
          href={`/billing/${review.orderId}`}
          className="ml-auto text-2xs font-medium text-primary hover:underline"
        >
          See what they were served →
        </Link>
      </div>
    </div>
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

/** The exact moment, kept for the tooltip behind the rough one on the row. */
function formatWhen(isoString: string): string {
  const at = new Date(isoString);

  if (Number.isNaN(at.getTime())) {
    return "—";
  }

  return at.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
