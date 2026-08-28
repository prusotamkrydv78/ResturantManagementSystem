import { apiFetch } from "@/lib/api/client";
import type {
  CreateReservationPayload,
  Reservation,
  ReservationBoard,
  UpdateReservationPayload,
} from "@/types/reservation";

/**
 * Reservation calls for a restaurant manager.
 *
 * None of these send a restaurant id. Nothing here changes table occupancy either,
 * including seating: an order is what occupies a table, and the reservation board is
 * not a second opinion about it.
 */

/** The bookings a manager is looking at, with the counts that matter today. */
export function getReservationBoard(options?: {
  /** A day in the restaurant own calendar, as yyyy-mm-dd. */
  onDate?: string;
  includeClosed?: boolean;
}): Promise<ReservationBoard> {
  const query = new URLSearchParams();

  if (options?.onDate !== undefined && options.onDate !== "") {
    query.set("onDate", options.onDate);
  }

  if (options?.includeClosed === true) {
    query.set("includeClosed", "true");
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return apiFetch<ReservationBoard>(`/api/reservations${suffix}`);
}

/** Load one booking. */
export function getReservation(id: string): Promise<Reservation> {
  return apiFetch<Reservation>(`/api/reservations/${id}`);
}

/** Take a booking. */
export function createReservation(
  payload: CreateReservationPayload,
): Promise<Reservation> {
  return apiFetch<Reservation>("/api/reservations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Change a booking. */
export function updateReservation(
  id: string,
  payload: UpdateReservationPayload,
): Promise<Reservation> {
  return apiFetch<Reservation>(`/api/reservations/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/** Agree a pending booking with the guest. */
export function confirmReservation(id: string): Promise<Reservation> {
  return apiFetch<Reservation>(`/api/reservations/${id}/confirm`, {
    method: "POST",
  });
}

/**
 * Show the guests to their table.
 *
 * Takes a table so a party moved on arrival is recorded where they actually sat. Does
 * not occupy the table; the waiter opening an order does that.
 */
export function seatReservation(
  id: string,
  tableId?: string | null,
): Promise<Reservation> {
  return apiFetch<Reservation>(`/api/reservations/${id}/seat`, {
    method: "POST",
    body: JSON.stringify({ tableId: tableId ?? null }),
  });
}

/** Mark a sitting as over, releasing the hold for later bookings. */
export function completeReservation(id: string): Promise<Reservation> {
  return apiFetch<Reservation>(`/api/reservations/${id}/complete`, {
    method: "POST",
  });
}

/** Call a booking off, freeing the table it was holding. */
export function cancelReservation(
  id: string,
  reason?: string | null,
): Promise<Reservation> {
  return apiFetch<Reservation>(`/api/reservations/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason: reason ?? null }),
  });
}
