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
  /**
   * The photograph heading this section, or null.
   *
   * Shown to guests above the section when they scan a table. Carries a version
   * stamp so the browser can cache it hard and still see a replacement at once.
   */
  imageUrl: string | null;
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
  /**
   * The dish photograph, or null.
   *
   * The one image in this product a paying guest sees: it is drawn on the page they
   * reach by scanning their table. Carries a version stamp so the browser can cache
   * it hard and still see a replacement immediately.
   */
  imageUrl: string | null;
}

/** What a menu photograph upload has to stay inside. Mirrors the API. */
export const MENU_IMAGE = {
  maxBytes: 2 * 1024 * 1024,
  accept: "image/jpeg,image/png,image/webp,image/avif",
} as const;

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

/**
 * One line of a bulk item creation.
 *
 * No category: the whole batch goes into one, chosen once.
 */
export interface MenuItemLine {
  name: string;
  description?: string;
  price: number;
}

/** The largest batch the API will take in one request. */
export const MAX_BULK_ITEMS = 100;
