import type { PaymentMethod } from "@/types/billing";
import type { StaffRole } from "@/types/staff";

/**
 * What a platform administrator sees across every restaurant.
 *
 * The one part of this product that is not scoped to a single restaurant, because the
 * account it serves owns none.
 *
 * One thing to know before reading any figure here: each restaurant range is read in
 * that restaurant own timezone and service day, so the platform total is the sum of
 * exactly what each manager sees on their own report. Two rows can therefore cover
 * slightly different absolute windows, which is why every row carries the window it was
 * measured over.
 */

/** What came in by one tender, across the platform. */
export interface PlatformMethodTotal {
  method: PaymentMethod;
  count: number;
  total: number;
}

/** What one restaurant did over the range. */
export interface PlatformRestaurantRow {
  id: string;
  name: string;
  slug: string;
  /** Who runs it, or null while nobody has been assigned. */
  managerName: string | null;
  completedCount: number;
  cancelledCount: number;
  paymentTotal: number;
  /** What it took over the period of the same length immediately before this one. */
  previousPaymentTotal: number;
  averageOrderValue: number;
}

/**
 * One service day inside a report range.
 *
 * The spine of the whole screen. Without it a ninety-day report is four numbers and a
 * table, and no arithmetic on four numbers says which day something broke.
 */
export interface PlatformReportDay {
  localDate: string;
  bills: number;
  takings: number;
  cancelled: number;
  cancelledValue: number;
}

/** One day of the week, summed across the range. */
export type Weekday =
  | "Sunday"
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday";

/** What one weekday carried across the whole range. */
export interface PlatformWeekday {
  weekday: Weekday;
  bills: number;
  takings: number;
}

/** Why orders were called off, and what they were worth. */
export interface PlatformCancellationReason {
  reason: string;
  count: number;
  /** What those orders would have come to. Never revenue. */
  value: number;
}

/** The totals for a period, thin, so one period can be read against another. */
export interface PlatformPeriod {
  fromLocalDate: string;
  toLocalDate: string;
  completedCount: number;
  cancelledCount: number;
  /** What those cancelled orders would have come to, so money compares with money. */
  cancelledValue: number;
  paymentTotal: number;
  paymentCount: number;
  averageOrderValue: number;
}

/** What the whole platform did over a range of days. */
export interface PlatformReport {
  fromLocalDate: string;
  toLocalDate: string;
  dayCount: number;
  restaurantCount: number;
  /** Restaurants still waiting for a manager. These cannot trade at all. */
  withoutManagerCount: number;
  /** How many took at least one payment in the range. */
  tradingCount: number;
  completedCount: number;
  cancelledCount: number;
  paymentTotal: number;
  paymentCount: number;
  cancelledValue: number;
  averageOrderValue: number;
  byMethod: PlatformMethodTotal[];
  /** How many restaurants exist, against the number this report covers. */
  restaurantsTotal: number;
  /** The period of the same length immediately before this one. */
  previous: PlatformPeriod;
  /** Every day in the range, oldest first, present even at zero. */
  days: PlatformReportDay[];
  /** The range summed into seven weekdays. */
  byWeekday: PlatformWeekday[];
  /** Why orders were called off, heaviest first by value. */
  cancellations: PlatformCancellationReason[];
  /** One row per restaurant, busiest first. */
  restaurants: PlatformRestaurantRow[];
}

/** One day of trading across the whole estate. */
export interface PlatformDay {
  ordersPlaced: number;
  completed: number;
  cancelled: number;
  takings: number;
  averageOrderValue: number;
}

/** One service day on the trend line. */
export interface PlatformTrendDay {
  localDate: string;
  ordersPlaced: number;
  completed: number;
  cancelled: number;
  takings: number;
}

/** One hour of the service day now running. */
export interface PlatformHour {
  hour: number;
  ordersPlaced: number;
  takings: number;
}

/** One restaurant, as an operator needs to see it during a service. */
export interface PlatformPulseRestaurant {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  hasManager: boolean;
  ordersToday: number;
  takingsToday: number;
  /** Orders running right now, so a quiet day can be told from a closed one. */
  openOrders: number;
  /** Dishes cooked and not yet carried out. */
  platesAtPass: number;
  /**
   * When this restaurant last opened an order, or null if it never has.
   *
   * The one figure on this screen nobody else can see. A restaurant that has taken
   * nothing for three days is either losing its custom or has a broken install, and
   * both of those are the platform's problem: the manager is not looking at a screen
   * that would tell them.
   */
  lastOrderAtUtc: string | null;
}

/**
 * What the estate is doing right now, and what it did today against yesterday.
 *
 * Separate from the report, which answers a range somebody chose, and from the
 * overview, which answers how the estate is configured. This answers the question an
 * operator has every morning: is everything trading.
 */
export interface PlatformPulse {
  localDate: string;
  serverUtcNow: string;
  today: PlatformDay;
  yesterday: PlatformDay;
  openOrders: number;
  platesAtPass: number;
  tradingToday: number;
/** The last week, oldest first, every day present even at zero. */
  days: PlatformTrendDay[];
  /** Today, hour by hour, all twenty-four including the ones still to come. */
  hours: PlatformHour[];
  /** Today split by tender, every method listed even at zero. */
  byMethodToday: PlatformMethodTotal[];
  restaurants: PlatformPulseRestaurant[];
}

/** Somebody who works at one restaurant, as the platform lists them. */
export interface PlatformPerson {
  id: string;
  fullName: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
}

/**
 * How far a restaurant has actually been set up.
 *
 * Almost every "this restaurant isn't working" report turns out to be one of these
 * being zero — no table taking orders, an empty menu, nobody hired — and none of
 * them are visible from the estate list.
 */
export interface PlatformRestaurantSetup {
  tables: number;
  tablesInService: number;
  /** Tables a guest could scan and order from right now. */
  tablesTakingOrders: number;
  menuCategories: number;
  menuItems: number;
  menuItemsActive: number;
  inventoryItems: number;
  staff: number;
  sitePublished: boolean;
}

/** One order on the restaurant page. */
export interface PlatformRestaurantOrder {
  id: string;
  orderNumber: number;
  tableName: string;
  status: "Open" | "Completed" | "Cancelled";
  itemCount: number;
  /** Dishes cooked and not yet carried out. */
  waitingAtPass: number;
  total: number;
  createdAtUtc: string;
  /** When it was settled or called off, or null while it is still running. */
  closedAtUtc: string | null;
}

/** What guests have said, in the figures that matter from outside. */
export interface PlatformRestaurantReviews {
  count: number;
  averageRating: number | null;
  recentCount: number;
  recentAverage: number | null;
}

/**
 * One restaurant, whole.
 *
 * Deliberately one response rather than the eight this page would otherwise stitch
 * together: a platform operator opening a restaurant is asking a single question —
 * what is going on here — and eight requests that each half-fail leave a screen that
 * is right about the menu and wrong about the money with nothing to say which.
 */
export interface PlatformRestaurantDetail {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine: string | null;
  city: string | null;
  country: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  serverUtcNow: string;
  localDate: string;
  manager: PlatformPerson | null;
  setup: PlatformRestaurantSetup;
  staff: PlatformPerson[];
  today: PlatformDay;
  yesterday: PlatformDay;
  openOrders: number;
  platesAtPass: number;
  lastOrderAtUtc: string | null;
  days: PlatformTrendDay[];
  /** The fortnight's takings by tender, every method listed even at zero. */
  byMethod: PlatformMethodTotal[];
  /** Orders open at this moment, oldest first. */
  running: PlatformRestaurantOrder[];
  /** The last few orders to close, newest first. */
  recent: PlatformRestaurantOrder[];
  reviews: PlatformRestaurantReviews;
}

/** One thing a platform administrator did. */
export interface PlatformActivity {
  id: string;
  /** Who did it, as they were called at the time. */
  actorName: string;
  /** A stable verb such as "restaurant.suspended". */
  action: string;
  subject: string;
  subjectId: string | null;
  detail: string | null;
  atUtc: string;
}

/**
 * The handful of things that are true of the platform rather than of a restaurant.
 *
 * Rates are fractions. A default and not a rule: existing restaurants keep their own,
 * and every order snapshots its rate at the moment it opens, so changing one of these
 * can never reach backwards into a bill that has been printed.
 */
export interface PlatformSettings {
  defaultVatRate: number;
  defaultServiceChargeRate: number;
  updatedAtUtc: string | null;
}

/** Whether the thing this platform runs on is actually healthy. */
export interface PlatformSystem {
  serverUtcNow: string;
  localDate: string;
  serviceDayLabel: string;
  serviceDayOffsetMinutes: number;
  environment: string;
  version: string;
  databaseReachable: boolean;
  appliedMigrationCount: number;
  /** Empty is the only healthy answer. */
  pendingMigrations: string[];
}
