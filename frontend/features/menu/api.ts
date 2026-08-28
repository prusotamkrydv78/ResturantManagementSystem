import { apiFetch } from "@/lib/api/client";
import type {
  CreateMenuCategoryPayload,
  CreateMenuItemPayload,
  MenuCategory,
  MenuItem,
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
