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
  /** The period of the same length immediately before this one. */
  previous: ReportPeriod;
  /** Every day in the range, oldest first, present even at zero. */
  days: ReportDay[];
  /** The range summed into seven weekdays. */
  byWeekday: ReportWeekday[];
  /** Why orders were called off, heaviest first by value. */
  cancellations: ReportCancellation[];
  completed: ReportOrder[];
  cancelled: ReportOrder[];
}

/**
 * One service day inside a report range.
 *
 * The spine of the screen. A report over ninety days used to arrive as four totals and
 * two lists, and no arithmetic on four totals says which day something changed.
 */
export interface ReportDay {
  localDate: string;
  bills: number;
  takings: number;
  cancelled: number;
  cancelledValue: number;
}

/** What one weekday carried across the whole range. */
export interface ReportWeekday {
  weekday:
    | "Sunday"
    | "Monday"
    | "Tuesday"
    | "Wednesday"
    | "Thursday"
    | "Friday"
    | "Saturday";
  bills: number;
  takings: number;
}

/** Why orders were called off, and what they were worth. */
export interface ReportCancellation {
  reason: string;
  count: number;
  /** What those orders would have come to. Never revenue. */
  value: number;
}

/** The totals for a period, thin, so one period can be read against another. */
export interface ReportPeriod {
  fromLocalDate: string;
  toLocalDate: string;
  completedCount: number;
  cancelledCount: number;
  cancelledValue: number;
  paymentTotal: number;
  paymentCount: number;
  averageOrderValue: number;
}

/** The longest range the API will cover in one request. */
export const MAX_REPORT_DAYS = 92;
