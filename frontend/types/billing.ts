import type { KitchenTicketStatus, OrderStatus } from "@/types/order";

/**
 * How a bill was settled.
 *
 * A label on something that already happened at the counter, not an instruction to
 * charge anybody. Nothing in this product talks to a payment provider.
 */
export type PaymentMethod = "Cash" | "Card" | "Digital";

/** The three methods, in the order they are offered. */
export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  "Cash",
  "Card",
  "Digital",
] as const;

/** What each method is called, and what it actually covers. */
export const PAYMENT_METHOD_HINTS: Record<PaymentMethod, string> = {
  Cash: "Notes and coins",
  Card: "Card at the terminal",
  Digital: "Wallet or bank transfer",
};

/** One line of a bill, at the price it was ordered at. */
export interface BillingOrderItem {
  itemName: string;
  unitPrice: number;
  quantity: number;
  note: string | null;
  lineTotal: number;
  isSubmittedToKitchen: boolean;
  kitchenTicketNumber: number | null;
}

/** A kitchen ticket, as billing needs to see it. */
export interface BillingKitchenTicket {
  ticketNumber: number;
  status: KitchenTicketStatus;
  itemCount: number;
  createdAtUtc: string;
}

/**
 * The record that an order was paid for. No provider, reference or outcome:
 * nothing was processed, so there is nothing to report the state of.
 */
export interface Payment {
  id: string;
  /** What was taken, from the server order total. */
  amount: number;
  method: PaymentMethod;
  recordedByName: string;
  recordedAtUtc: string;
}

/**
 * How and why an order was called off.
 *
 * A record rather than an absence: the order, its lines and any kitchen tickets it
 * raised all remain, and this explains why no money was taken against them.
 */
export interface Cancellation {
  reason: string;
  cancelledByName: string;
  cancelledAtUtc: string;
}

/** One order in the billing queue, without its lines. */
export interface BillingOrderSummary {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  tableName: string;
  subtotal: number;
  /** Money taken off, in currency. Zero when there is none. */
  discountAmount: number;
  /** The service charge, calculated on the discounted food. */
  serviceChargeAmount: number;
  /** Tax, calculated on the food plus the service charge. */
  vatAmount: number;
  /**
   * What the table owes. The figure to show and the figure a payment is checked
   * against; the subtotal is only what the food cost.
   */
  total: number;
  /** Taken so far, across every payment against this order. */
  amountPaid: number;
  /** Still owed. Zero once the bill is settled. */
  amountOutstanding: number;
  itemCount: number;
  placedByName: string;
  createdAtUtc: string;
  completedAtUtc: string | null;
  kitchenTicketCount: number;
  /** Tickets not yet at the pass. Zero is what closing requires. */
  unfinishedKitchenTicketCount: number;
  /** Lines the kitchen was never told about. Must be zero before a bill can be settled. */
  unsentItemCount: number;
  /** Whether it may be paid for and closed now. Decided by the server. */
  /** Whether money may be taken against it now. */
  canSettle: boolean;
  /**
   * When the table asked to pay, or null.
   *
   * What the bill queue sorts and colours by: a table that has asked has already
   * decided to leave, and is now only waiting on us.
   */
  billRequestedAtUtc: string | null;
  /** Every payment taken against it, oldest first. A split bill has more than one. */
  payments: Payment[];
  cancellation: Cancellation | null;
}

/** One order in full, as the manager reviews it before settling. */
export interface BillingOrder {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  tableName: string;
  tableCapacity: number;
  /** Sum of the lines, and the amount due. Calculated by the server. */
  subtotal: number;
  /** Money taken off, in currency. Zero when there is none. */
  discountAmount: number;
  /** The service charge, calculated on the discounted food. */
  serviceChargeAmount: number;
  /** Tax, calculated on the food plus the service charge. */
  vatAmount: number;
  /**
   * What the table owes. The figure to show and the figure a payment is checked
   * against; the subtotal is only what the food cost.
   */
  total: number;
  /** Taken so far, across every payment against this order. */
  amountPaid: number;
  /** Still owed. Zero once the bill is settled. */
  amountOutstanding: number;
  itemCount: number;
  placedByName: string;
  createdAtUtc: string;
  completedAtUtc: string | null;
  unfinishedKitchenTicketCount: number;
  /**
   * Units the waiter never sent to the kitchen. Shown for information only: an
   * order of just drinks legitimately has no ticket, so this does not block
   * closing.
   */
  unsubmittedItemCount: number;
  /**
   * Tickets the kitchen has already picked up or finished. Does not stop a
   * cancellation; it is what tells the manager what calling the order off throws
   * away.
   */
  startedKitchenTicketCount: number;
  /** Whether money may be taken against it now. */
  canSettle: boolean;
  /**
   * When the table asked to pay, or null.
   *
   * What the bill queue sorts and colours by: a table that has asked has already
   * decided to leave, and is now only waiting on us.
   */
  billRequestedAtUtc: string | null;
  /** Whether it may be called off now. Decided by the server. */
  canCancel: boolean;
  /** Every payment taken against it, oldest first. A split bill has more than one. */
  payments: Payment[];
  cancellation: Cancellation | null;
  items: BillingOrderItem[];
  kitchenTickets: BillingKitchenTicket[];
}

/**
 * Payload for settling an order.
 *
 * The method and nothing else. There is deliberately no amount: the server takes
 * the total from the order it already stored.
 */
export interface RecordPaymentPayload {
  method: PaymentMethod;
  /**
   * How much arrived, or omitted to settle whatever is still outstanding.
   *
   * The only amount a client may name, and the server bounds it on both sides: more
   * than zero, and no more than the bill still owes. It cannot invent a total.
   */
  amount?: number;
}

/** The result of settling an order. */
export interface RecordPaymentResult {
  payment: Payment;
  order: BillingOrder;
}

/**
 * Payload for calling an order off.
 *
 * The reason and nothing else. A cancellation cannot be silent: an order that
 * produced no money and carries no explanation is the gap this state exists to
 * prevent.
 */
export interface CancelOrderPayload {
  reason: string;
}

/** Bounds the API applies to a cancellation reason. */
export const CANCELLATION_LIMITS = {
  minReasonLength: 3,
  maxReasonLength: 200,
} as const;

/**
 * One closed order in the history list.
 *
 * Flat and deliberately not aggregated: this answers what happened to a table, one
 * row at a time. It is not a report and carries no totals of its own.
 */
export interface OrderHistoryEntry {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  tableName: string;
  /** What the order came to, whether or not it was ever paid. */
  subtotal: number;
  /** Money taken off, in currency. Zero when there is none. */
  discountAmount: number;
  /** The service charge, calculated on the discounted food. */
  serviceChargeAmount: number;
  /** Tax, calculated on the food plus the service charge. */
  vatAmount: number;
  /**
   * What the table owes. The figure to show and the figure a payment is checked
   * against; the subtotal is only what the food cost.
   */
  total: number;
  /** Taken so far, across every payment against this order. */
  amountPaid: number;
  /** Still owed. Zero once the bill is settled. */
  amountOutstanding: number;
  itemCount: number;
  placedByName: string;
  createdAtUtc: string;
  /** When it ended, whichever way it ended, so one field sorts the history. */
  closedAtUtc: string;
  kitchenTicketCount: number;
  /** Every payment taken against it, oldest first. A split bill has more than one. */
  payments: Payment[];
  cancellation: Cancellation | null;
}
