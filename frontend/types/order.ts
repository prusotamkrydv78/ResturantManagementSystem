/**
 * Where an order sits in its lifecycle.
 *
 * One beginning and two ends, all one way, and only a manager moves an order off
 * Open: either the bill is settled or the order is called off. Both endings are
 * history and neither is editable anywhere; a cancelled order is kept rather than
 * deleted, so the restaurant can still answer why that table paid nothing.
 */
export type OrderStatus = "Open" | "Completed" | "Cancelled";

/**
 * Where a kitchen ticket sits in its own lifecycle.
 *
 * A short one-way workflow: Pending, then Preparing, then Ready. Deliberately
 * separate from the order status, because sending food to the kitchen does not
 * close a table and marking it ready does not either. An order stays Open while
 * its tickets move through these on their own.
 */
export type KitchenTicketStatus = "Pending" | "Preparing" | "Ready";

/** Bounds the API applies to a submitted line. */
export const ORDER_LIMITS = {
  minQuantity: 1,
  maxQuantity: 99,
  maxNoteLength: 200,
} as const;

/** What the waiter workspace needs to orient itself. */
export interface WaiterContext {
  restaurantName: string;
  activeTableCount: number;
  availableItemCount: number;
}

/** A table a waiter may open an order on. Only tables in service are returned. */
export interface WaiterTable {
  id: string;
  name: string;
  capacity: number;
}

/** A menu item a waiter may order. */
export interface WaiterMenuItem {
  id: string;
  name: string;
  description: string | null;
  /**
   * Current price. Used for display and for the running total the waiter sees; the
   * server re-reads it when the order is placed and never trusts a client price.
   */
  price: number;
}

/** A category with the items a waiter may order from it. */
export interface WaiterMenuCategory {
  id: string;
  name: string;
  items: WaiterMenuItem[];
}

/** One line of a placed order, as recorded at the time. */
export interface OrderItem {
  id: string;
  menuItemId: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
  note: string | null;
  lineTotal: number;
  /** Whether this line has gone out on a ticket. Decided by the server. */
  isSubmittedToKitchen: boolean;
  /** The ticket it went out on, so the screen can name it. Null until sent. */
  kitchenTicketNumber: number | null;
  /**
   * Whether this line may still be changed or removed. False once it is kitchen
   * history. The server refuses either way; this only keeps the screen honest.
   */
  isEditable: boolean;
}

/** One line on a kitchen ticket, as the kitchen was told it. */
export interface KitchenTicketItem {
  itemName: string;
  quantity: number;
  note: string | null;
}

/** One submission of order lines to the kitchen. */
export interface KitchenTicket {
  id: string;
  /** The number the kitchen calls out. Sequential within the restaurant. */
  ticketNumber: number;
  status: KitchenTicketStatus;
  itemCount: number;
  createdAtUtc: string;
  items: KitchenTicketItem[];
}

/** A placed order with its lines. */
export interface Order {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  tableId: string;
  tableName: string;
  subtotal: number;
  itemCount: number;
  createdByName: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  /** Whether a waiter may still change it. Decided by the server. */
  isEditable: boolean;
  /** Send back with an update so a save built on stale data is refused. */
  rowVersion: string;
  /** Units added but not yet sent to the kitchen. */
  unsubmittedItemCount: number;
  /** Whether there is anything to send right now. Decided by the server. */
  canSubmitToKitchen: boolean;
  /**
   * Whether a customer put this order in themselves, from the website or a scanned
   * code. What it changes for the waiter is that nobody has agreed it out loud yet.
   */
  isCustomerPlaced: boolean;
  /**
   * Whether somebody still has to check this order with the table.
   *
   * True only for a customer's order nobody has confirmed. While it is true the
   * kitchen cannot be told anything, and the customer can still call it off.
   */
  needsConfirmation: boolean;
  /** When it was confirmed with the customer, or null. */
  confirmedAtUtc: string | null;
  /** Who confirmed it, or null. The person who knows what was agreed. */
  confirmedByName: string | null;
  items: OrderItem[];
  /** Every submission this order has produced, newest first. */
  kitchenTickets: KitchenTicket[];
}

/** A placed order without its lines, for lists. */
export interface OrderSummary {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  tableName: string;
  subtotal: number;
  itemCount: number;
  /** Who placed it, preserved from creation. */
  createdByName: string;
  /** Units still waiting to go to the kitchen, so the list can flag the order. */
  unsubmittedItemCount: number;
  /** How many submissions it has produced. */
  kitchenTicketCount: number;
  createdAtUtc: string;
  /** Whether a customer placed it themselves rather than a waiter taking it. */
  isCustomerPlaced: boolean;
  /**
   * Whether somebody still has to check it with the table. The server puts these
   * first in the list: an unconfirmed order is a customer sitting there waiting.
   */
  needsConfirmation: boolean;
}

/**
 * Payload for placing an order. Carries no prices and no total: the server reads
 * the menu itself and calculates the amount.
 */
export interface CreateOrderPayload {
  tableId: string;
  items: {
    menuItemId: string;
    quantity: number;
    note?: string;
  }[];
}

/**
 * A line the waiter is assembling. Lives only in the New Order screen; nothing is
 * persisted until the order is placed.
 */
export interface CartLine {
  menuItemId: string;
  name: string;
  /** Shown to the waiter while building the order. The server decides the real one. */
  unitPrice: number;
  quantity: number;
  note: string;
}

/**
 * Payload for updating an open order.
 *
 * `lines` is the desired state of the existing lines: one left out is removed.
 * Only quantity and note can move, because a historical line keeps the name and
 * price it was created with. `newItems` are validated against the live menu and
 * get their own fresh snapshot.
 */
export interface UpdateOrderPayload {
  lines: { id: string; quantity: number; note?: string }[];
  newItems: { menuItemId: string; quantity: number; note?: string }[];
  rowVersion: string;
}

/**
 * A line being edited on screen. `id` marks an existing line whose snapshot must
 * be preserved; a line without one is a new item that will be priced on save.
 */
export interface EditableLine {
  /** Present for an existing line, absent for a newly added item. */
  id?: string;
  menuItemId: string;
  name: string;
  /** The stored snapshot for an existing line, today price for a new one. */
  unitPrice: number;
  quantity: number;
  note: string;
  /**
   * True once the line has gone to the kitchen. Such a line is carried through a
   * save untouched: the server rejects any change to it.
   */
  isSubmitted: boolean;
  /** The ticket it went out on, so the screen can name it. Null while pending. */
  kitchenTicketNumber: number | null;
}

/**
 * Food cooked and waiting for somebody to carry it.
 *
 * The floor's half of the kitchen rail. A ticket appears here the moment the kitchen
 * marks it ready and leaves the moment a waiter says they took it, which is what turns
 * "your food is ready" from an announcement into a task with an end.
 */
export interface PassTicket {
  ticketId: string;
  /** What the kitchen calls out. */
  ticketNumber: number;
  /** The order behind it, so the screen can link through. */
  orderId: string;
  orderNumber: number;
  /** Where it is going. The only thing a waiter navigates by. */
  tableName: string;
  itemCount: number;
  /**
   * When it reached the pass, so the screen can say how long it has been sitting.
   * Food going cold is what this queue exists to prevent.
   */
  readyAtUtc: string;
  /** What is on the plate, so it can be checked before carrying it. */
  items: KitchenTicketItem[];
}

/**
 * The result of sending items to the kitchen: the ticket that was created and the
 * order as it now stands, so the screen refreshes without a second request.
 */
export interface SubmitToKitchenResult {
  ticket: KitchenTicket;
  order: Order;
}
