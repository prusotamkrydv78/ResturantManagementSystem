import type { PaymentMethod } from "@/types/billing";

/** What came in by one tender over the range asked for. */
export interface MethodTotal {
  method: PaymentMethod;
  count: number;
  total: number;
}

/** One order that ended, listed rather than aggregated. */
export interface ReportOrder {
  id: string;
  orderNumber: number;
  tableName: string;
  /**
   * What was taken for a completed order, or what a cancelled one would have come
   * to. Which it means is decided by the list the row appears in.
   */
  amount: number;
  itemCount: number;
  closedAtUtc: string;
  /** How it was paid. Null for a cancellation. */
  method: PaymentMethod | null;
  /** Why it was called off. Null for a payment. */
  reason: string | null;
}

/**
 * What a restaurant did over a range of its own days.
 *
 * The two money figures are separate on purpose: payments are money that arrived,
 * cancelled value is money that did not, and the second is never added to anything.
 */
export interface ReportSummary {
  /** First day covered, in the restaurant own calendar, as yyyy-MM-dd. */
  fromLocalDate: string;
  toLocalDate: string;
  /** The zone those dates were read in. */
  timeZoneId: string;
  /** The instant the range opened, so what was counted is auditable. */
  rangeStartUtc: string;
  /** The instant it closes, exclusive. */
  rangeEndUtc: string;
  dayCount: number;
  completedCount: number;
  cancelledCount: number;
  paymentTotal: number;
  paymentCount: number;
  /** What the cancelled orders would have come to. Never revenue. */
  cancelledValue: number;
  /** Payment total over payment count, computed by the server. */
  averageOrderValue: number;
  byMethod: MethodTotal[];
  completed: ReportOrder[];
  cancelled: ReportOrder[];
}

/** The longest range the API will cover in one request. */
export const MAX_REPORT_DAYS = 92;
