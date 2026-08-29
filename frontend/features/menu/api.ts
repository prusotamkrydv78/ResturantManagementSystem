import { apiFetch } from "@/lib/api/client";
import type {
  CreateMenuCategoryPayload,
  CreateMenuItemPayload,
  MenuCategory,
  MenuItem,
  MenuItemLine,
  UpdateMenuCategoryPayload,
  UpdateMenuItemPayload,
} from "@/types/menu";

/**
 * Menu calls for a restaurant manager.
 *
 * None of these send a restaurant id. The API derives the restaurant from the
 * access token, and rejects a category that is not one of the caller own.
 */

/* ---- Categories ---- */

/** List categories in menu order. */
export function listCategories(): Promise<MenuCategory[]> {
  return apiFetch<MenuCategory[]>("/api/menu/categories");
}

/** Add a category. */
export function createCategory(
  payload: CreateMenuCategoryPayload,
): Promise<MenuCategory> {
  return apiFetch<MenuCategory>("/api/menu/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Update a category name, description and position. */
export function updateCategory(
  id: string,
  payload: UpdateMenuCategoryPayload,
): Promise<MenuCategory> {
  return apiFetch<MenuCategory>(`/api/menu/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/**
 * Put a category on or off the menu. Its items are left as they are; whether they
 * can be ordered is derived from both flags.
 */
export function setCategoryActive(
  id: string,
  isActive: boolean,
): Promise<MenuCategory> {
  return apiFetch<MenuCategory>(`/api/menu/categories/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ isActive }),
  });
}

/* ---- Items ---- */

/** List items, optionally narrowed by name and category. */
export function listItems(
  options: { search?: string; categoryId?: string } = {},
): Promise<MenuItem[]> {
  const params = new URLSearchParams();

  if (options.search !== undefined && options.search.trim() !== "") {
    params.set("search", options.search.trim());
  }

  if (options.categoryId !== undefined && options.categoryId !== "") {
    params.set("categoryId", options.categoryId);
  }

  const query = params.toString();

  return apiFetch<MenuItem[]>(`/api/menu/items${query === "" ? "" : `?${query}`}`);
}

/** Add an item to one of your categories. */
export function createItem(payload: CreateMenuItemPayload): Promise<MenuItem> {
  return apiFetch<MenuItem>("/api/menu/items", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Update an item, including moving it between your categories. */
export function updateItem(
  id: string,
  payload: UpdateMenuItemPayload,
): Promise<MenuItem> {
  return apiFetch<MenuItem>(`/api/menu/items/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/** Put an item on or off the menu. */
export function setItemActive(id: string, isActive: boolean): Promise<MenuItem> {
  return apiFetch<MenuItem>(`/api/menu/items/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ isActive }),
  });
}

/**
 * Add several items to one category at once.
 *
 * The batch saves together, so a rejected row takes the whole paste back rather than
 * leaving half a course entered.
 */
export function createItems(
  categoryId: string,
  items: MenuItemLine[],
): Promise<MenuItem[]> {
  return apiFetch<MenuItem[]>("/api/menu/items/bulk", {
    method: "POST",
    body: JSON.stringify({ categoryId, items }),
  });
}

/**
 * Set the order categories appear in.
 *
 * Send every category, in the order wanted. A place only means anything relative to
 * the others, so this is one decision rather than a series of them.
 */
export function reorderCategories(categoryIds: string[]): Promise<MenuCategory[]> {
  return apiFetch<MenuCategory[]>("/api/menu/categories/order", {
    method: "PUT",
    body: JSON.stringify({ categoryIds }),
  });
}

/** Delete an item added by mistake. Rejected with 409 once it has been ordered. */
export function deleteItem(id: string): Promise<void> {
  return apiFetch<void>(`/api/menu/items/${id}`, { method: "DELETE" });
}

/** Delete an empty category. Rejected with 409 while it still holds items. */
export function deleteCategory(id: string): Promise<void> {
  return apiFetch<void>(`/api/menu/categories/${id}`, { method: "DELETE" });
}
