import type { OrderStatus } from "@/types/order";
import type { ReservationStatus } from "@/types/reservation";

/**
 * The people a restaurant knows.
 *
 * Deliberately not accounts. Nobody signs in as a customer anywhere in this product,
 * so there is no password, no verification and no self-service: this is a name a
 * manager writes down, with enough beside it to recognise them next time.
 */

/** Field lengths the API accepts, mirrored so a form can stop before a round trip. */
export const CUSTOMER_LIMITS = {
  name: 120,
  phone: 32,
  email: 256,
  notes: 500,
} as const;

/** A customer, as their restaurant sees them. */
export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  isActive: boolean;
  /** How many orders they have been on. */
  orderCount: number;
  /** How many bookings they have made. */
  reservationCount: number;
  /** When they were last in, or null if never. */
  lastVisitAtUtc: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

/** One of a customer past orders, as their history shows it. */
export interface CustomerOrder {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  tableName: string;
  subtotal: number;
  itemCount: number;
  createdAtUtc: string;
}

/** One of a customer bookings, as their history shows it. */
export interface CustomerReservation {
  id: string;
  reservedForUtc: string;
  guestCount: number;
  tableName: string | null;
  status: ReservationStatus;
}

/** A customer with what they have done. */
export interface CustomerDetail {
  customer: Customer;
  orders: CustomerOrder[];
  reservations: CustomerReservation[];
}

/**
 * Payload for recording a customer. There is no restaurant field: the backend puts
 * them in the restaurant of the signed-in manager.
 */
export interface CreateCustomerPayload {
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

/** Payload for editing a customer. Active status has its own call. */
export type UpdateCustomerPayload = CreateCustomerPayload;
