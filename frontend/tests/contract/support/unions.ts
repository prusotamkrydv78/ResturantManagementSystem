import type { PaymentMethod } from "@/types/billing";
import type { ActivityKind } from "@/types/dashboard";
import type { KitchenTicketStatus, OrderStatus } from "@/types/order";
import type { PlatformRole } from "@/types/auth";
import type { ReservationStatus } from "@/types/reservation";
import type { StaffRole } from "@/types/staff";
import type { TableStatus } from "@/types/table";

/**
 * Every string union the frontend branches on, as runtime values.
 *
 * Written out here rather than derived, because a union type does not exist at
 * runtime and the whole point is to check what actually arrives. The `satisfies`
 * clauses tie each list back to its type, so renaming a member in the type files
 * fails to compile here instead of silently leaving a stale expectation behind.
 */

export const ORDER_STATUSES = ["Open", "Completed", "Cancelled"] as const satisfies
  readonly OrderStatus[];

export const KITCHEN_TICKET_STATUSES = [
  "Pending",
  "Preparing",
  "Ready",
] as const satisfies readonly KitchenTicketStatus[];

export const TABLE_STATUSES = [
  "Available",
  "Occupied",
  "Reserved",
] as const satisfies readonly TableStatus[];

export const RESERVATION_STATUSES = [
  "Pending",
  "Confirmed",
  "Seated",
  "Completed",
  "Cancelled",
] as const satisfies readonly ReservationStatus[];

export const PAYMENT_METHODS = ["Cash", "Card", "Digital"] as const satisfies
  readonly PaymentMethod[];

export const PLATFORM_ROLES = [
  "SuperAdmin",
  "RestaurantManager",
  "Staff",
  "User",
] as const satisfies readonly PlatformRole[];

export const STAFF_ROLES = ["Waiter", "Chef", "Cashier"] as const satisfies
  readonly StaffRole[];

export const ACTIVITY_KINDS = [
  "OrderPlaced",
  "SentToKitchen",
  "KitchenStarted",
  "KitchenReady",
  "OrderCompleted",
  "OrderCancelled",
] as const satisfies readonly ActivityKind[];
