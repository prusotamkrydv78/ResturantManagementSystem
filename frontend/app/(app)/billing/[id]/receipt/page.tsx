"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { getReceipt } from "@/features/billing/api";
import type { Receipt } from "@/types/receipt";

/**
 * The receipt for a settled order.
 *
 * Two audiences on one page. On screen it is a normal panel inside the app shell; on
 * paper the shell disappears and only the document is left, which is why the receipt
 * itself is marked as printable and everything around it is not. That keeps one source
 * of truth rather than a screen and a separate print template that could drift.
 *
 * Nothing here is editable and nothing is created by visiting: the document is
 * assembled by the server from the order and its payment, so printing it twice
 * produces the same paper.
 */
export default function ReceiptPage() {
  return (
    <RequireAuth roles={["RestaurantManager", "Staff"]} staffRoles={["Waiter"]}>
      <ReceiptView />
    </RequireAuth>
  );
}

function ReceiptView() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await getReceipt(orderId);
        if (!cancelled) {
          setReceipt(loaded);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load this receipt.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [orderId, reloadKey]);

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Receipt"
          description="A record of money already taken. Nothing here can be changed."
          actions={
            <div className="flex items-center gap-2">
              <LinkButton
                href={`/billing/${orderId}`}
                variant="secondary"
                icon={<ArrowLeft />}
              >
                The order
              </LinkButton>
              <Button
                onClick={() => window.print()}
                disabled={receipt === null}
                icon={<Printer />}
              >
                Print
              </Button>
            </div>
          }
        />
      </div>

      <PageBody>
        {error !== null ? (
          <div className="print:hidden">
            <Surface>
              <ErrorState
                message={error}
                onRetry={() => setReloadKey((key) => key + 1)}
              />
            </Surface>
            <div className="mt-4">
              <LinkButton href="/billing/history" variant="secondary">
                Back to history
              </LinkButton>
            </div>
          </div>
        ) : receipt === null ? (
          <Surface className="flex flex-col gap-3 p-6 print:hidden">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/4" />
          </Surface>
        ) : (
          <Surface className="receipt mx-auto w-full max-w-md p-6">
            {/* Who took the money. Only the profile fields that are actually set. */}
            <header className="flex flex-col items-center gap-1 border-b border-dashed border-border pb-4 text-center">
              <h2 className="text-lg font-semibold text-text">
                {receipt.restaurantName}
              </h2>
              {addressOf(receipt) !== null && (
                <p className="text-2xs text-muted">{addressOf(receipt)}</p>
              )}
              {receipt.restaurantContactPhone !== null && (
                <p className="text-2xs text-muted">{receipt.restaurantContactPhone}</p>
              )}
              {receipt.restaurantContactEmail !== null && (
                <p className="text-2xs text-muted">{receipt.restaurantContactEmail}</p>
              )}
            </header>

            <dl className="flex flex-col gap-1 border-b border-dashed border-border py-3 text-xs">
              <Row label="Order" value={`#${receipt.orderNumber}`} />
              <Row label="Table" value={receipt.tableName} />
              <Row label="Served by" value={receipt.placedByName} />
              <Row label="Opened" value={formatDateTime(receipt.openedAtUtc)} />
              <Row label="Closed" value={formatDateTime(receipt.closedAtUtc)} />
            </dl>

            {/* The lines, at the prices they were charged at. */}
            <ul className="flex flex-col gap-2 border-b border-dashed border-border py-3">
              {receipt.lines.map((line, position) => (
                <li key={`${receipt.orderNumber}-${position}`} className="text-xs">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-text">
                      <span className="tabular font-semibold">{line.quantity}</span>
                      {" × "}
                      {line.itemName}
                    </span>
                    <span className="tabular font-semibold text-text">
                      {line.lineTotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 text-2xs text-muted">
                    <span>{line.unitPrice.toFixed(2)} each</span>
                  </div>
                  {line.note !== null && line.note.trim() !== "" && (
                    <p className="text-2xs text-muted italic">{line.note}</p>
                  )}
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-1 border-b border-dashed border-border py-3">
              <div className="flex items-baseline justify-between text-xs text-muted">
                <span>
                  {receipt.itemCount} {receipt.itemCount === 1 ? "item" : "items"}
                </span>
                <span className="tabular">{receipt.total.toFixed(2)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-text">Total</span>
                <span className="tabular text-xl font-semibold text-text">
                  {receipt.amountPaid.toFixed(2)}
                </span>
              </div>
            </div>

            <dl className="flex flex-col gap-1 py-3 text-xs">
              <Row label="Paid by" value={receipt.paymentMethod} />
              <Row label="Recorded" value={formatDateTime(receipt.paidAtUtc)} />
              <Row label="Taken by" value={receipt.recordedByName} />
            </dl>

            <p className="border-t border-dashed border-border pt-3 text-center text-2xs text-subtle">
              Payment recorded at the counter. This is not a tax invoice.
            </p>
          </Surface>
        )}
      </PageBody>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-text">{value}</dd>
    </div>
  );
}

/** The address from whichever profile fields are set, and nothing if none are. */
function addressOf(receipt: Receipt): string | null {
  const parts = [
    receipt.restaurantAddressLine,
    receipt.restaurantCity,
    receipt.restaurantCountry,
  ].filter((part): part is string => part !== null && part.trim() !== "");

  return parts.length === 0 ? null : parts.join(", ");
}

function formatDateTime(isoString: string): string {
  const parsed = new Date(isoString);

  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}
