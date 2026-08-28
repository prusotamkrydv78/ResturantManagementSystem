import type { PaymentMethod } from "@/types/billing";

/**
 * A kind of thing that happened in the restaurant.
 *
 * Each one is a timestamp that already existed on an order or a kitchen ticket.
 * Nothing is written to produce the feed.
 */
export type ActivityKind =
  | "OrderPlaced"
  | "SentToKitchen"
  | "KitchenStarted"
  | "KitchenReady"
  | "OrderCompleted"
  | "OrderCancelled";

/**
 * One thing that happened, with the facts behind it.
 *
 * Carries no sentence to display: the wording is composed on this side from the
 * kind and these fields, the same way every other response hands over facts
 * rather than copy.
 */
export interface ActivityEntry {
  kind: ActivityKind;
  atUtc: string;
  orderId: string;
  orderNumber: number;
  tableName: string;
  /** The kitchen ticket, for the three kitchen kinds. */
  ticketNumber: number | null;
  /** What was taken, for a completed order. */
  amount: number | null;
  /** How it was paid, for a completed order. */
  method: PaymentMethod | null;
  /** Why, for a cancelled order. */
  reason: string | null;
}

/** What came in by one tender, today. */
export interface PaymentMethodTotal {
  method: PaymentMethod;
  count: number;
  total: number;
}

/** Order activity right now. */
export interface OrderActivity {
  openCount: number;
  /** Open orders whose kitchen work is finished, so they can be closed now. */
  readyToSettleCount: number;
  /** What the open orders come to, unpaid and outstanding. */
  openValue: number;
  openItemCount: number;
  /** When the longest-running open order was placed. Null when nothing is open. */
  oldestOpenAtUtc: string | null;
}

/**
 * The floor right now.
 *
 * Occupancy and being in service are separate: a table out of service is neither
 * occupied nor available.
 */
export interface Floor {
  totalCount: number;
  inServiceCount: number;
  occupiedCount: number;
  availableCount: number;
  outOfServiceCount: number;
  seatsInService: number;
}

/** The kitchen right now, read from ticket status. */
export interface KitchenLoad {
  pendingCount: number;
  preparingCount: number;
  /** Units on open orders no waiter has sent yet: the workload about to arrive. */
  unsubmittedItemCount: number;
  oldestPendingAtUtc: string | null;
}

/**
 * What the restaurant has done today.
 *
 * Counts and sums for the shift in progress. No range, no comparison, no trend.
 */
export interface Today {
  /** The instant the day was taken to begin, so the screen can name the day. */
  startedAtUtc: string;
  completedCount: number;
  cancelledCount: number;
  /** What the cancelled orders would have come to. Not revenue lost. */
  cancelledValue: number;
  paymentTotal: number;
  paymentCount: number;
  /** Every method, listed even at zero, so the breakdown keeps its shape. */
  byMethod: PaymentMethodTotal[];
}

/** Whether the restaurant is set up enough to trade. */
export interface Readiness {
  availableMenuItemCount: number;
  canTakeOrders: boolean;
}

/**
 * The manager operational overview.
 *
 * One response for the whole screen, because a dashboard assembled from eight
 * requests shows eight different moments.
 */
export interface ManagerDashboard {
  /** When the server answered, so the screen can say how fresh it is. */
  generatedAtUtc: string;
  orders: OrderActivity;
  floor: Floor;
  kitchen: KitchenLoad;
  today: Today;
  readiness: Readiness;
  activity: ActivityEntry[];
}
