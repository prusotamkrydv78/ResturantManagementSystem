/** A menu category, as seen by its restaurant manager. */
export interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  /** Items in this category, including inactive ones. */
  itemCount: number;
  /** How many of those items are themselves active. */
  activeItemCount: number;
  createdAtUtc: string;
  updatedAtUtc: string;
}

/** A menu item, as seen by its restaurant manager. */
export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  categoryId: string;
  categoryName: string;
  isActive: boolean;
  isCategoryActive: boolean;
  /**
   * Whether the item would actually be orderable. Needs both the item and its
   * category to be active, and is computed by the backend so the two can never
   * drift apart.
   */
  isAvailable: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
}

/** Payload for adding a category. The restaurant is decided by the backend. */
export interface CreateMenuCategoryPayload {
  name: string;
  description: string | null;
  /** Omitted, the category goes after the existing ones. */
  displayOrder?: number;
}

/** Payload for editing a category. Active state has its own call. */
export interface UpdateMenuCategoryPayload {
  name: string;
  description: string | null;
  displayOrder: number;
}

/** Payload for adding an item. The category must be one of your own. */
export interface CreateMenuItemPayload {
  name: string;
  description: string | null;
  price: number;
  categoryId: string;
}

/** Payload for editing an item, including moving it between your categories. */
export interface UpdateMenuItemPayload {
  name: string;
  description: string | null;
  price: number;
  categoryId: string;
}
