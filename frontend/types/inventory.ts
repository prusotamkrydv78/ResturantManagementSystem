/**
 * How an ingredient is measured.
 *
 * Five units in three families: counted, weighed, poured. Conversion happens only
 * within a family and only by exact factors of a thousand, so nothing rounds.
 */
export type UnitOfMeasure = "Piece" | "Gram" | "Kilogram" | "Millilitre" | "Litre";

/** The units, in the order they are offered. */
export const UNITS: readonly UnitOfMeasure[] = [
  "Piece",
  "Gram",
  "Kilogram",
  "Millilitre",
  "Litre",
] as const;

/** How a unit is written next to a number. */
export const UNIT_SHORT: Record<UnitOfMeasure, string> = {
  Piece: "pc",
  Gram: "g",
  Kilogram: "kg",
  Millilitre: "ml",
  Litre: "L",
};

/**
 * What kind of quantity a unit measures.
 *
 * Only units in the same family convert. Grams of a liquid would need a density
 * nothing here stores, so the editor offers only compatible units rather than letting
 * the server refuse the save afterwards.
 */
export const UNIT_FAMILY: Record<UnitOfMeasure, "Count" | "Mass" | "Volume"> = {
  Piece: "Count",
  Gram: "Mass",
  Kilogram: "Mass",
  Millilitre: "Volume",
  Litre: "Volume",
};

/** Why a stock figure moved. */
export type StockMovementKind =
  | "Opening"
  | "Received"
  | "Consumed"
  | "Adjusted"
  | "Wasted";

/**
 * The kinds a manager can enter.
 *
 * Consumption and the opening balance are written by the system: the first when a
 * waiter sends an order to the kitchen, the second when an item is created. Offering
 * either here would let the same stock be counted twice.
 */
export const ENTERABLE_KINDS: readonly StockMovementKind[] = [
  "Received",
  "Adjusted",
  "Wasted",
] as const;

/** What each kind is called on screen. */
export const KIND_LABEL: Record<StockMovementKind, string> = {
  Opening: "Opening balance",
  Received: "Delivery",
  Consumed: "Used for cooking",
  Adjusted: "Correction",
  Wasted: "Written off",
};

/** One thing on a kitchen shelf. */
export interface InventoryItem {
  id: string;
  name: string;
  unit: UnitOfMeasure;
  quantityInStock: number;
  /** The reorder level. Zero means none is set, so nothing can warn about it. */
  minimumQuantity: number;
  isActive: boolean;
  isLowStock: boolean;
  isOutOfStock: boolean;
  /**
   * Below zero, which means more was cooked than the records held rather than the
   * shelf being empty. A data problem, not a stock level.
   */
  isNegative: boolean;
  recipeUseCount: number;
  /** How many times it has moved. What decides whether it can be deleted. */
  movementCount: number;
  lastMovementAtUtc: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

/** The shelves as a whole. The counts cover every item, not the filtered list. */
export interface InventoryOverview {
  items: InventoryItem[];
  activeCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  negativeCount: number;
  /** Active items with no reorder level, so nothing can warn about them. */
  untrackedCount: number;
}

/** One entry in an item history. */
export interface StockMovement {
  id: string;
  kind: StockMovementKind;
  /** How much it moved by, signed. */
  quantityDelta: number;
  /** The balance immediately afterwards. */
  quantityAfter: number;
  unit: UnitOfMeasure;
  reason: string | null;
  orderId: string | null;
  orderNumber: number | null;
  recordedByName: string;
  recordedAtUtc: string;
}

/** One item with its history. */
export interface InventoryItemDetail {
  item: InventoryItem;
  movements: StockMovement[];
}

/** Payload for adding an item. */
export interface CreateInventoryItemPayload {
  name: string;
  unit: UnitOfMeasure;
  quantityInStock: number;
  minimumQuantity: number;
}

/**
 * Payload for editing an item.
 *
 * No unit and no stock figure: changing the unit would reinterpret every recorded
 * quantity, and the figure only moves through a movement.
 */
export interface UpdateInventoryItemPayload {
  name: string;
  minimumQuantity: number;
}

/**
 * Payload for moving stock by hand.
 *
 * The quantity is always positive and the kind decides the direction, so a delivery
 * cannot be entered as a negative and quietly become a loss.
 */
export interface RecordStockMovementPayload {
  kind: StockMovementKind;
  quantity: number;
  /** For a correction only, whether the count went up. */
  increase: boolean;
  reason?: string;
}

/** One ingredient a menu item is made from. */
export interface RecipeLine {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  quantity: number;
  unit: UnitOfMeasure;
  /** The unit the ingredient is stocked in. */
  stockUnit: UnitOfMeasure;
  /** The same amount in the stock unit, which is what will actually be deducted. */
  quantityInStockUnit: number;
  quantityInStock: number;
  isInventoryItemActive: boolean;
  portionsAvailable: number | null;
}

/** What a menu item is made from. No lines is valid: it consumes nothing. */
export interface Recipe {
  menuItemId: string;
  menuItemName: string;
  lines: RecipeLine[];
  /** How many could be made, decided by the scarcest ingredient. */
  portionsAvailable: number | null;
  hasShortage: boolean;
}

/** One line of a recipe being saved. */
export interface RecipeLinePayload {
  inventoryItemId: string;
  quantity: number;
  unit: UnitOfMeasure;
}

/** The whole recipe. Lines left out are removed; an empty list is valid. */
export interface SaveRecipePayload {
  lines: RecipeLinePayload[];
}

/** Whether a menu item has a recipe, for the menu screen. */
export interface RecipeSummary {
  menuItemId: string;
  ingredientCount: number;
  portionsAvailable: number | null;
  hasShortage: boolean;
}

/** Bounds the API applies. */
export const INVENTORY_LIMITS = {
  maxQuantity: 1_000_000,
  minPositiveQuantity: 0.001,
  maxNameLength: 120,
  maxReasonLength: 200,
} as const;
