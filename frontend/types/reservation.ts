/**
 * Tables held for people at times.
 *
 * A booking says a table is intended for somebody later. Whether it is in use now is
 * decided by whether an order is running on it, and nothing here changes that: seating
 * a party records that they arrived, not that the table became busy.
 */

/** Where a booking sits in its lifecycle. */
export type ReservationStatus =
  | "Pending"
  | "Confirmed"
  | "Seated"
  | "Completed"
  | "Cancelled";

/** Bounds the API accepts, mirrored so a form can stop before a round trip. */
export const RESERVATION_LIMITS = {
  guests: { min: 1, max: 200 },
  duration: { min: 15, max: 480, default: 90 },
  notes: 500,
} as const;

/**
 * A booking.
 *
 * The `can…` flags are answers, not rules: the server decides what may happen next and
 * says so, which is why the screen never has to combine a status with a table with a
 * time to work out whether a button belongs.
 */
export interface Reservation {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  reservedForUtc: string;
  durationMinutes: number;
  endsAtUtc: string;
  guestCount: number;
  tableId: string | null;
  tableName: string | null;
  tableCapacity: number | null;
  status: ReservationStatus;
  notes: string | null;
  cancellationReason: string | null;
  canConfirm: boolean;
  canSeat: boolean;
  canComplete: boolean;
  canCancel: boolean;
  isEditable: boolean;
  createdAtUtc: string;
}

/** The bookings a manager is looking at, with the counts that matter today. */
export interface ReservationBoard {
  reservations: Reservation[];
  todayCount: number;
  upcomingCount: number;
  seatedCount: number;
  todayGuestCount: number;
}

/**
 * Payload for taking a booking. There is no restaurant field: the booking is taken for
 * the restaurant of the signed-in manager, and both the customer and the table must be
 * that restaurant own.
 */
export interface CreateReservationPayload {
  customerId: string;
  reservedForUtc: string;
  guestCount: number;
  durationMinutes?: number;
  tableId?: string | null;
  notes?: string | null;
}

/**
 * Payload for changing a booking. The customer is not among the fields: moving a
 * booking to a different person is a different booking.
 */
export interface UpdateReservationPayload {
  reservedForUtc: string;
  guestCount: number;
  durationMinutes?: number;
  tableId?: string | null;
  notes?: string | null;
}
