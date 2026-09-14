"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CalendarClock, Contact, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { DetailRow, Surface, SurfaceHeader } from "@/components/ui/surface";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { getCustomer } from "@/features/customers/api";
import type { CustomerDetail } from "@/types/customer";
import type { OrderStatus } from "@/types/order";
import type { ReservationStatus } from "@/types/reservation";

/**
 * One customer, and what they have done here.
 *
 * The two histories are why a customer record is worth keeping at all, so they are the
 * body of the page rather than a tab behind it. Both are read-only: an order belongs to
 * the ordering system and a booking to the reservation board, and neither is editable
 * from a customer record.
 */
export default function CustomerDetailPage() {
  return (
    <RequireAuth roles={["RestaurantManager"]}>
      <CustomerView />
    </RequireAuth>
  );
}

function CustomerView() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await getCustomer(id);

        if (!cancelled) {
          setDetail(loaded);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load this customer.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const customer = detail?.customer;

  return (
    <>
      <PageHeader
        title={customer?.name ?? "Customer"}
        description={
          customer === undefined
            ? undefined
            : customer.orderCount === 0 && customer.reservationCount === 0
              ? "No history yet. Nothing has been ordered or booked under this name."
              : `${describeCount(customer.orderCount, "visit", "visits")} · ${describeCount(
                  customer.reservationCount,
                  "booking",
                  "bookings",
                )}`
        }
        crumb={customer?.name}
        actions={
          <LinkButton href="/settings/customers" variant="secondary">
            All customers
          </LinkButton>
        }
      />

      <PageBody>
        {error !== null && (
          <Surface>
            <ErrorState
              message={error}
              onRetry={() => setReloadKey((key) => key + 1)}
            />
          </Surface>
        )}

        {detail === null && error === null && (
          <Surface>
            <TableSkeleton rows={4} columns={3} />
          </Surface>
        )}

        {detail !== null && customer !== undefined && (
          <>
            <Surface>
              <SurfaceHeader
                title="Details"
                actions={
                  customer.isActive ? (
                    <Badge tone="success" dot>
                      On the books
                    </Badge>
                  ) : (
                    <Badge tone="neutral" dot>
                      Archived
                    </Badge>
                  )
                }
              />
              <dl className="divide-y divide-border">
                <DetailRow label="Name">{customer.name}</DetailRow>
                <DetailRow label="Phone">{customer.phone ?? "Not given"}</DetailRow>
                <DetailRow label="Email">{customer.email ?? "Not given"}</DetailRow>
                <DetailRow label="Notes">
                  {customer.notes ?? "Nothing recorded"}
                </DetailRow>
                <DetailRow label="Last in">
                  {customer.lastVisitAtUtc === null
                    ? "Never"
                    : formatDateTime(customer.lastVisitAtUtc)}
                </DetailRow>
                <DetailRow label="First recorded">
                  {formatDateTime(customer.createdAtUtc)}
                </DetailRow>
              </dl>
            </Surface>

            <Surface>
              <SurfaceHeader
                title="Bookings"
                description="Newest first. Managed from the reservation board."
                actions={
                  <LinkButton href="/reservations" variant="secondary" size="sm">
                    Reservations
                  </LinkButton>
                }
              />

              {detail.reservations.length === 0 ? (
                <EmptyState
                  icon={<CalendarClock />}
                  title="No bookings"
                  description="Nothing has been booked under this name."
                />
              ) : (
                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Expected</Th>
                        <Th className="text-right">Guests</Th>
                        <Th>Table</Th>
                        <Th>Status</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.reservations.map((reservation) => (
                        <Tr key={reservation.id}>
                          <Td className="whitespace-nowrap">
                            {formatDateTime(reservation.reservedForUtc)}
                          </Td>
                          <Td className="text-right tabular text-muted">
                            {reservation.guestCount}
                          </Td>
                          <Td className="text-muted">
                            {reservation.tableName ?? "Not decided"}
                          </Td>
                          <Td>
                            <Badge tone={reservationTone(reservation.status)} dot>
                              {reservation.status}
                            </Badge>
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </Surface>

            <Surface>
              <SurfaceHeader
                title="Visits"
                description="Orders raised against this customer, newest first."
              />

              {detail.orders.length === 0 ? (
                <EmptyState
                  icon={<ReceiptText />}
                  title="No visits yet"
                  description="Nothing has been ordered under this name."
                />
              ) : (
                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Order</Th>
                        <Th>Table</Th>
                        <Th className="text-right">Items</Th>
                        <Th className="text-right">Total</Th>
                        <Th>Status</Th>
                        <Th className="text-right">When</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.orders.map((order) => (
                        <Tr key={order.id}>
                          <Td className="font-medium text-text tabular">
                            #{order.orderNumber}
                          </Td>
                          <Td className="text-muted">{order.tableName}</Td>
                          <Td className="text-right tabular text-muted">
                            {order.itemCount}
                          </Td>
                          <Td className="text-right tabular">
                            {order.subtotal.toFixed(2)}
                          </Td>
                          <Td>
                            <Badge tone={orderTone(order.status)} dot>
                              {order.status}
                            </Badge>
                          </Td>
                          <Td className="text-right whitespace-nowrap text-muted">
                            {formatDateTime(order.createdAtUtc)}
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </Surface>
          </>
        )}

        {detail !== null && customer === undefined && (
          <Surface>
            <EmptyState
              icon={<Contact />}
              title="Customer not found"
              description="This record may have been deleted."
            />
          </Surface>
        )}
      </PageBody>
    </>
  );
}

function describeCount(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function orderTone(status: OrderStatus): "success" | "warning" | "neutral" {
  switch (status) {
    case "Completed":
      return "success";
    case "Open":
      return "warning";
    default:
      return "neutral";
  }
}

function reservationTone(
  status: ReservationStatus,
): "primary" | "success" | "warning" | "neutral" {
  switch (status) {
    case "Seated":
      return "primary";
    case "Confirmed":
      return "success";
    case "Pending":
      return "warning";
    default:
      return "neutral";
  }
}

function formatDateTime(isoString: string): string {
  const parsed = new Date(isoString);

  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}
