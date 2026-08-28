import { apiFetch } from "@/lib/api/client";
import type {
  CreateInventoryItemPayload,
  InventoryItem,
  InventoryItemDetail,
  InventoryOverview,
  Recipe,
  RecipeSummary,
  RecordStockMovementPayload,
  SaveRecipePayload,
  UpdateInventoryItemPayload,
} from "@/types/inventory";

/**
 * The shelves, and what each menu item is made from.
 *
 * None of these sends a restaurant id: the restaurant comes from the record the
 * authenticated manager runs. There is deliberately no call that sets a stock figure
 * directly, because every change goes through a movement that says why.
 */

/** The shelves, with the counts that decide what needs attention. */
export function listInventory(includeArchived = false): Promise<InventoryOverview> {
  const query = includeArchived ? "?includeArchived=true" : "";

  return apiFetch<InventoryOverview>(`/api/inventory/items${query}`);
}

/** One item with its history, newest first. */
export function getInventoryItem(id: string): Promise<InventoryItemDetail> {
  return apiFetch<InventoryItemDetail>(`/api/inventory/items/${id}`);
}

/** Add an item. Any opening quantity becomes a movement of its own. */
export function createInventoryItem(
  payload: CreateInventoryItemPayload,
): Promise<InventoryItem> {
  return apiFetch<InventoryItem>("/api/inventory/items", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Rename an item or change its reorder level. */
export function updateInventoryItem(
  id: string,
  payload: UpdateInventoryItemPayload,
): Promise<InventoryItem> {
  return apiFetch<InventoryItem>(`/api/inventory/items/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/** Archive or restore an item. */
export function setInventoryItemActive(
  id: string,
  isActive: boolean,
): Promise<InventoryItem> {
  return apiFetch<InventoryItem>(`/api/inventory/items/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ isActive }),
  });
}

/**
 * Delete an item outright.
 *
 * Only possible while it has no history and no recipe naming it, which in practice
 * means it was added by mistake. Anything else is archived, because a movement
 * pointing at a row nobody can look up would make the ledger unreadable.
 */
export function deleteInventoryItem(id: string): Promise<void> {
  return apiFetch<void>(`/api/inventory/items/${id}`, { method: "DELETE" });
}

/** Record a delivery, a correction after counting, or something thrown away. */
export function recordStockMovement(
  id: string,
  payload: RecordStockMovementPayload,
): Promise<InventoryItemDetail> {
  return apiFetch<InventoryItemDetail>(`/api/inventory/items/${id}/movements`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** What a menu item is made from. */
export function getRecipe(menuItemId: string): Promise<Recipe> {
  return apiFetch<Recipe>(`/api/menu/items/${menuItemId}/recipe`);
}

/** Save the whole recipe. Lines left out are removed. */
export function saveRecipe(
  menuItemId: string,
  payload: SaveRecipePayload,
): Promise<Recipe> {
  return apiFetch<Recipe>(`/api/menu/items/${menuItemId}/recipe`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/** Which menu items have a recipe, for the menu screen. */
export function listRecipeSummaries(): Promise<RecipeSummary[]> {
  return apiFetch<RecipeSummary[]>("/api/inventory/recipes");
}
