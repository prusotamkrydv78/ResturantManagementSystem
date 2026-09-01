/**
 * What a guest sees after scanning the code on their table.
 *
 * Nothing here carries an identifier except the menu item ids an order has to name.
 * No order id, no table id, no restaurant id: every action goes through the token in
 * the link, so a public page has nothing it could leak and nothing it could be talked
 * into substituting.
 */

/** A menu item as a guest sees it. */
export interface PublicMenuItem {
  id: string;
  name: string;
  description: string | null;
  /** For display. The server prices the order again from its own menu. */
  price: number;
  /** The dish photograph, or null when the restaurant has not added one. */
  imageUrl: string | null;
}

/** A course or section of the menu. */
export interface PublicMenuSection {
  name: string;
  items: PublicMenuItem[];
  /** The photograph heading the section, or null. */
  imageUrl: string | null;
}

/** One line of a guest own order. */
export interface PublicOrderLine {
  itemName: string;
  quantity: number;
  note: string | null;
  lineTotal: number;
  /** Whether the kitchen has been told about this line yet. */
  isSentToKitchen: boolean;
}

/** A guest own order at the table. */
export interface PublicOrder {
  /** What to say to a member of staff. The only number a guest is given. */
  orderNumber: number;
  lines: PublicOrderLine[];
  itemCount: number;
  subtotal: number;
  awaitingKitchenCount: number;
  placedAtUtc: string;
}

/** Everything the scanned page needs, in one response. */
export interface PublicTable {
  restaurantName: string;
  tableName: string;
  /** False while a member of staff is running an order on this table. */
  canOrder: boolean;
  /** What to tell the guest when they cannot order. Null when they can. */
  unavailableReason: string | null;
  menu: PublicMenuSection[];
  /** Their own order, if they have started one. */
  currentOrder: PublicOrder | null;
}

/**
 * Which restaurant a printed table code belongs to.
 *
 * The only thing about a scanned code still answered without a session. It exists so a
 * customer who scans a table can be sent to that restaurant ordering page, which the
 * browser cannot work out on its own.
 */
export interface ScannedTableRestaurant {
  slug: string;
  restaurantName: string;
}

/** A table a customer may say they are sitting at. */
export interface PublicTableChoice {
  id: string;
  name: string;
  capacity: number;
  /** False when an order is already running on it, so it cannot be chosen. */
  isAvailable: boolean;
}

/**
 * What the restaurant own website needs to take an order.
 *
 * The menu here is the real one, priced from the menu records - not the menu a manager
 * types into their site content, which is prose with free-text prices and no
 * identifiers, so nothing in it could ever be ordered.
 */
export interface PublicRestaurant {
  restaurantName: string;
  menu: PublicMenuSection[];
  tables: PublicTableChoice[];
  /** False when no table is open to ordering at all. */
  isAcceptingOrders: boolean;
}

/**
 * Payload for ordering from the website.
 *
 * Carries a table, which the scanned request does not: a code says where the guest is,
 * and somebody on a website has to be asked. Still no prices and no total.
 */
export interface PlaceWebsiteOrderPayload {
  tableId: string;
  items: PublicOrderLinePayload[];
}

/** One line a guest is asking for. */
export interface PublicOrderLinePayload {
  menuItemId: string;
  quantity: number;
  note?: string | null;
}

/**
 * Payload for placing an order. No table, no restaurant, no prices and no total: the
 * table comes from the link and every amount is calculated by the server.
 */
export interface PlacePublicOrderPayload {
  items: PublicOrderLinePayload[];
}
