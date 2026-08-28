import { beforeAll, describe, expect, it } from "vitest";
import { requireApi } from "./support/client";
import { expectNumber, expectText, first, only } from "./support/expect";
import { seedRestaurant, seedUnassignedManager, type Seeded } from "./support/seed";
import type {
  InventoryItem,
  InventoryItemDetail,
  InventoryOverview,
  Recipe,
  RecipeSummary,
} from "@/types/inventory";
import type { KitchenTicket } from "@/types/kitchen";
import type { Order } from "@/types/order";

/**
 * The shelves, the recipes, and what cooking takes off them.
 *
 * The rules worth holding hardest are the ones that keep the ledger honest: a balance
 * never moves without a movement saying why, a movement is never rewritten, and short
 * stock never stops a kitchen. Several tests below exist only for those.
 */
describe("inventory", () => {
  let seeded: Seeded;

  beforeAll(async () => {
    await requireApi();
    seeded = await seedRestaurant("Inventory");
  });

  /* --------------------------------------------------------------------- Items */

  it("starts with empty shelves", async () => {
    const overview = await seeded.manager.get<InventoryOverview>(
      "/api/inventory/items",
    );

    expect(overview.items).toHaveLength(0);
    expect(overview.activeCount).toBe(0);
    expect(overview.lowStockCount).toBe(0);
    expect(overview.outOfStockCount).toBe(0);
    expect(overview.negativeCount).toBe(0);
  });

  it("records an opening quantity as a movement of its own", async () => {
    const item = await addItem("Buns", "Piece", 40, 10);

    const detail = await seeded.manager.get<InventoryItemDetail>(
      `/api/inventory/items/${item.id}`,
    );

    expect(detail.item.quantityInStock).toBe(40);

    // The ledger accounts for the whole balance rather than starting part way in.
    const opening = only(detail.movements, (m) => m.kind === "Opening", "the opening");
    expect(opening.quantityDelta).toBe(40);
    expect(opening.quantityAfter).toBe(40);
    expectText(opening.recordedByName, "opening.recordedByName");
  });

  it("writes no opening movement when an item starts empty", async () => {
    const item = await addItem("Napkins", "Piece", 0, 0);

    const detail = await seeded.manager.get<InventoryItemDetail>(
      `/api/inventory/items/${item.id}`,
    );

    // A movement of nothing explains nothing, so none is written.
    expect(detail.movements).toHaveLength(0);
    expect(detail.item.movementCount).toBe(0);
  });

  it("refuses a second item with the same name", async () => {
    const refused = await seeded.manager.attempt("POST", "/api/inventory/items", {
      name: "Buns",
      unit: "Piece",
      quantityInStock: 1,
      minimumQuantity: 0,
    });

    expect(refused.status).toBe(409);
  });

  it("reports low, out and untracked separately", async () => {
    const fresh = await seedRestaurant("InventoryStates");

    await add(fresh, "Low", "Gram", 100, 500);
    await add(fresh, "Empty", "Piece", 0, 5);
    await add(fresh, "Plenty", "Litre", 20, 2);
    await add(fresh, "Unwatched", "Piece", 3, 0);

    const overview = await fresh.manager.get<InventoryOverview>(
      "/api/inventory/items",
    );

    expect(overview.activeCount).toBe(4);
    expect(overview.lowStockCount).toBe(1);
    expect(overview.outOfStockCount).toBe(1);
    // An item with no reorder level is not low, it is unmonitored, and reporting it as
    // low would make the warning worthless.
    expect(overview.untrackedCount).toBe(1);

    const unwatched = only(overview.items, (i) => i.name === "Unwatched", "Unwatched");
    expect(unwatched.isLowStock).toBe(false);
    expect(unwatched.minimumQuantity).toBe(0);
  });

  it("cannot change the unit or the stock figure through an edit", async () => {
    const item = await addItem("Cheese slices", "Piece", 30, 5);

    await seeded.manager.put(`/api/inventory/items/${item.id}`, {
      name: "Cheese",
      minimumQuantity: 8,
      // Sent anyway. If either were honoured, every historical quantity would be
      // reinterpreted or the balance would move with nothing explaining it.
      unit: "Kilogram",
      quantityInStock: 9999,
    });

    const detail = await seeded.manager.get<InventoryItemDetail>(
      `/api/inventory/items/${item.id}`,
    );

    expect(detail.item.name).toBe("Cheese");
    expect(detail.item.minimumQuantity).toBe(8);
    expect(detail.item.unit).toBe("Piece");
    expect(detail.item.quantityInStock).toBe(30);
  });

  /* ----------------------------------------------------------------- Movements */

  it("adds a delivery and leaves the balance it produced on the movement", async () => {
    const item = await addItem("Sauce", "Millilitre", 500, 200);

    const detail = await seeded.manager.post<InventoryItemDetail>(
      `/api/inventory/items/${item.id}/movements`,
      { kind: "Received", quantity: 250, increase: true },
    );

    expect(detail.item.quantityInStock).toBe(750);

    const received = first(detail.movements, "movements");
    expect(received.kind).toBe("Received");
    expect(received.quantityDelta).toBe(250);
    expect(received.quantityAfter).toBe(750);
  });

  it("subtracts a write-off however the direction is asked for", async () => {
    const item = await addItem("Lettuce", "Gram", 1000, 100);

    const detail = await seeded.manager.post<InventoryItemDetail>(
      `/api/inventory/items/${item.id}/movements`,
      // Direction is decided by the kind, so a write-off cannot be turned into a
      // delivery by asking for an increase.
      { kind: "Wasted", quantity: 300, increase: true, reason: "Wilted overnight" },
    );

    expect(detail.item.quantityInStock).toBe(700);
    expect(first(detail.movements, "movements").quantityDelta).toBe(-300);
  });

  it("lets a correction go either way", async () => {
    const item = await addItem("Tomatoes", "Kilogram", 5, 1);

    const up = await seeded.manager.post<InventoryItemDetail>(
      `/api/inventory/items/${item.id}/movements`,
      { kind: "Adjusted", quantity: 2, increase: true, reason: "Found a crate" },
    );
    expect(up.item.quantityInStock).toBe(7);

    const down = await seeded.manager.post<InventoryItemDetail>(
      `/api/inventory/items/${item.id}/movements`,
      { kind: "Adjusted", quantity: 3, increase: false, reason: "Recount after stocktake" },
    );
    expect(down.item.quantityInStock).toBe(4);
  });

  it("requires a reason for a correction and for a write-off", async () => {
    const item = await addItem("Oil", "Litre", 10, 2);

    for (const kind of ["Adjusted", "Wasted"]) {
      const refused = await seeded.manager.attempt(
        "POST",
        `/api/inventory/items/${item.id}/movements`,
        { kind, quantity: 1, increase: false },
      );

      // A stock figure that moved and nobody knows why is what this ledger exists to
      // prevent.
      expect(refused.status).toBe(400);
    }

    // And a delivery does not need one, because the kind is the reason.
    const fine = await seeded.manager.attempt(
      "POST",
      `/api/inventory/items/${item.id}/movements`,
      { kind: "Received", quantity: 5, increase: true },
    );
    expect(fine.status).toBe(200);
  });

  it("refuses consumption and opening entered by hand", async () => {
    const item = await addItem("Ice", "Kilogram", 10, 1);

    for (const kind of ["Consumed", "Opening"]) {
      const refused = await seeded.manager.attempt(
        "POST",
        `/api/inventory/items/${item.id}/movements`,
        { kind, quantity: 1, increase: false, reason: "trying it on" },
      );

      // Both are written by the system. A second route would let the same stock be
      // counted twice.
      expect(refused.status).toBe(400);
    }
  });

  it("refuses a movement of nothing", async () => {
    const item = await addItem("Salt", "Gram", 100, 10);

    const refused = await seeded.manager.attempt(
      "POST",
      `/api/inventory/items/${item.id}/movements`,
      { kind: "Received", quantity: 0, increase: true },
    );

    expect(refused.status).toBe(400);
  });

  /* ------------------------------------------------------- Deleting vs archiving */

  it("deletes an item that has never moved", async () => {
    const fresh = await seedRestaurant("InventoryDelete");
    const item = await add(fresh, "Mistake", "Piece", 0, 0);

    const deleted = await fresh.manager.attempt(
      "DELETE",
      `/api/inventory/items/${item.id}`,
    );

    expect(deleted.status).toBe(204);

    const overview = await fresh.manager.get<InventoryOverview>(
      "/api/inventory/items?includeArchived=true",
    );
    expect(overview.items.some((i) => i.id === item.id)).toBe(false);
  });

  it("refuses to delete an item with history, and archives instead", async () => {
    const item = await addItem("Flour", "Kilogram", 25, 5);

    const refused = await seeded.manager.attempt(
      "DELETE",
      `/api/inventory/items/${item.id}`,
    );

    // A movement pointing at a row nobody can look up would make the ledger
    // unreadable, which is worse than keeping a row somebody no longer wants.
    expect(refused.status).toBe(409);

    const archived = await seeded.manager.put<InventoryItem>(
      `/api/inventory/items/${item.id}/status`,
      { isActive: false },
    );

    expect(archived.isActive).toBe(false);

    // Gone from the working list, still there when asked for.
    const active = await seeded.manager.get<InventoryOverview>("/api/inventory/items");
    expect(active.items.some((i) => i.id === item.id)).toBe(false);

    const all = await seeded.manager.get<InventoryOverview>(
      "/api/inventory/items?includeArchived=true",
    );
    expect(all.items.some((i) => i.id === item.id)).toBe(true);
  });

  /* ------------------------------------------------------------------- Recipes */

  it("treats a menu item with no ingredients as consuming nothing", async () => {
    const recipe = await seeded.manager.get<Recipe>(
      `/api/menu/items/${seeded.itemId}/recipe`,
    );

    // An empty recipe is a legitimate state, not a missing one.
    expect(recipe.lines).toHaveLength(0);
    expect(recipe.portionsAvailable).toBeNull();
    expect(recipe.hasShortage).toBe(false);
  });

  it("saves a recipe and works out how many could be made", async () => {
    const fresh = await seedRestaurant("Recipe");

    const bun = await add(fresh, "Bun", "Piece", 20, 5);
    const chicken = await add(fresh, "Chicken", "Kilogram", 3, 1);

    const recipe = await fresh.manager.put<Recipe>(
      `/api/menu/items/${fresh.itemId}/recipe`,
      {
        lines: [
          { inventoryItemId: bun.id, quantity: 1, unit: "Piece" },
          // Grams against an ingredient stocked in kilograms: the same family, so it
          // converts exactly.
          { inventoryItemId: chicken.id, quantity: 150, unit: "Gram" },
        ],
      },
    );

    expect(recipe.lines).toHaveLength(2);

    const chickenLine = only(
      recipe.lines,
      (l) => l.inventoryItemId === chicken.id,
      "the chicken line",
    );
    expect(chickenLine.unit).toBe("Gram");
    expect(chickenLine.stockUnit).toBe("Kilogram");
    // 150 g of a kilogram-stocked item is 0.15 kg off the shelf.
    expect(chickenLine.quantityInStockUnit).toBe(0.15);

    // 20 buns allows 20; 3 kg of chicken at 0.15 allows 20 as well.
    expect(recipe.portionsAvailable).toBe(20);
    expect(recipe.hasShortage).toBe(false);
  });

  it("is limited by whichever ingredient runs out first", async () => {
    const fresh = await seedRestaurant("RecipeLimit");

    const bun = await add(fresh, "Bun", "Piece", 100, 0);
    const cheese = await add(fresh, "Cheese", "Piece", 7, 0);

    const recipe = await fresh.manager.put<Recipe>(
      `/api/menu/items/${fresh.itemId}/recipe`,
      {
        lines: [
          { inventoryItemId: bun.id, quantity: 1, unit: "Piece" },
          { inventoryItemId: cheese.id, quantity: 2, unit: "Piece" },
        ],
      },
    );

    // Seven slices of cheese at two each is three, not fifty.
    expect(recipe.portionsAvailable).toBe(3);
  });

  it("replaces the whole recipe on save", async () => {
    const fresh = await seedRestaurant("RecipeReplace");

    const bun = await add(fresh, "Bun", "Piece", 10, 0);
    const sauce = await add(fresh, "Sauce", "Millilitre", 1000, 0);

    await fresh.manager.put(`/api/menu/items/${fresh.itemId}/recipe`, {
      lines: [
        { inventoryItemId: bun.id, quantity: 1, unit: "Piece" },
        { inventoryItemId: sauce.id, quantity: 20, unit: "Millilitre" },
      ],
    });

    const trimmed = await fresh.manager.put<Recipe>(
      `/api/menu/items/${fresh.itemId}/recipe`,
      { lines: [{ inventoryItemId: bun.id, quantity: 2, unit: "Piece" }] },
    );

    // The submitted lines become the recipe, so the sauce is gone rather than kept.
    expect(trimmed.lines).toHaveLength(1);
    expect(first(trimmed.lines, "lines").quantity).toBe(2);

    const emptied = await fresh.manager.put<Recipe>(
      `/api/menu/items/${fresh.itemId}/recipe`,
      { lines: [] },
    );
    expect(emptied.lines).toHaveLength(0);
  });

  it("refuses a unit that cannot describe the ingredient", async () => {
    const fresh = await seedRestaurant("RecipeUnits");
    const sauce = await add(fresh, "Sauce", "Millilitre", 500, 0);

    const refused = await fresh.manager.attempt(
      "PUT",
      `/api/menu/items/${fresh.itemId}/recipe`,
      { lines: [{ inventoryItemId: sauce.id, quantity: 50, unit: "Gram" }] },
    );

    // Grams of a liquid would need a density nothing here stores, so it is refused
    // rather than converted with a made-up figure.
    expect(refused.status).toBe(400);
  });

  it("refuses the same ingredient listed twice", async () => {
    const fresh = await seedRestaurant("RecipeDupe");
    const bun = await add(fresh, "Bun", "Piece", 10, 0);

    const refused = await fresh.manager.attempt(
      "PUT",
      `/api/menu/items/${fresh.itemId}/recipe`,
      {
        lines: [
          { inventoryItemId: bun.id, quantity: 1, unit: "Piece" },
          { inventoryItemId: bun.id, quantity: 2, unit: "Piece" },
        ],
      },
    );

    // Two answers to one question. Summing them would hide whichever was wrong.
    expect(refused.status).toBe(400);
  });

  it("refuses an ingredient from another restaurant", async () => {
    const mine = await seedRestaurant("RecipeMine");
    const theirs = await seedRestaurant("RecipeTheirs");

    const theirBun = await add(theirs, "Bun", "Piece", 10, 0);

    const refused = await mine.manager.attempt(
      "PUT",
      `/api/menu/items/${mine.itemId}/recipe`,
      { lines: [{ inventoryItemId: theirBun.id, quantity: 1, unit: "Piece" }] },
    );

    expect(refused.status).toBe(400);
  });

  it("lists which menu items have a recipe", async () => {
    const fresh = await seedRestaurant("RecipeSummaries");
    const bun = await add(fresh, "Bun", "Piece", 12, 0);

    await fresh.manager.put(`/api/menu/items/${fresh.itemId}/recipe`, {
      lines: [{ inventoryItemId: bun.id, quantity: 2, unit: "Piece" }],
    });

    const summaries = await fresh.manager.get<RecipeSummary[]>(
      "/api/inventory/recipes",
    );

    const summary = only(
      summaries,
      (s) => s.menuItemId === fresh.itemId,
      "the recipe summary",
    );

    expect(summary.ingredientCount).toBe(1);
    expect(summary.portionsAvailable).toBe(6);
    expect(summary.hasShortage).toBe(false);
  });

  /* --------------------------------------------------------------- Deduction */

  it("takes ingredients off the shelf when the kitchen is told to cook", async () => {
    const fresh = await seedRestaurant("Deduct");

    const bun = await add(fresh, "Bun", "Piece", 50, 5);
    const chicken = await add(fresh, "Chicken", "Kilogram", 10, 2);

    await fresh.manager.put(`/api/menu/items/${fresh.itemId}/recipe`, {
      lines: [
        { inventoryItemId: bun.id, quantity: 1, unit: "Piece" },
        { inventoryItemId: chicken.id, quantity: 150, unit: "Gram" },
      ],
    });

    const order = await fresh.waiter.post<Order>("/api/waiter/orders", {
      tableId: fresh.tableId,
      items: [{ menuItemId: fresh.itemId, quantity: 3 }],
    });

    // Nothing moves on placing the order: the kitchen has not been told anything yet.
    let detail = await fresh.manager.get<InventoryItemDetail>(
      `/api/inventory/items/${bun.id}`,
    );
    expect(detail.item.quantityInStock).toBe(50);

    const submitted = await fresh.waiter.post<{ ticket: KitchenTicket }>(
      `/api/waiter/orders/${order.id}/kitchen-tickets`,
    );
    expect(submitted.ticket.ticketNumber).toBeGreaterThan(0);

    detail = await fresh.manager.get<InventoryItemDetail>(
      `/api/inventory/items/${bun.id}`,
    );

    // Three burgers, one bun each.
    expect(detail.item.quantityInStock).toBe(47);

    const consumed = first(detail.movements, "movements");
    expect(consumed.kind).toBe("Consumed");
    expect(consumed.quantityDelta).toBe(-3);
    expect(consumed.quantityAfter).toBe(47);
    // Traceable back to the order it was cooked for.
    expect(consumed.orderId).toBe(order.id);
    expect(consumed.orderNumber).toBe(order.orderNumber);

    const chickenDetail = await fresh.manager.get<InventoryItemDetail>(
      `/api/inventory/items/${chicken.id}`,
    );

    // 3 × 150 g is 0.45 kg off a kilogram-stocked shelf.
    expect(chickenDetail.item.quantityInStock).toBe(9.55);
  });

  it("deducts nothing for a menu item with no recipe", async () => {
    const fresh = await seedRestaurant("DeductNoRecipe");
    const bun = await add(fresh, "Bun", "Piece", 20, 0);

    const order = await fresh.waiter.post<Order>("/api/waiter/orders", {
      tableId: fresh.tableId,
      items: [{ menuItemId: fresh.itemId, quantity: 2 }],
    });
    await fresh.waiter.post(`/api/waiter/orders/${order.id}/kitchen-tickets`);

    const detail = await fresh.manager.get<InventoryItemDetail>(
      `/api/inventory/items/${bun.id}`,
    );

    // The item is sold as it comes, so nothing is tracked against it.
    expect(detail.item.quantityInStock).toBe(20);
    expect(detail.movements.filter((m) => m.kind === "Consumed")).toHaveLength(0);
  });

  it("deducts only what a second submission adds", async () => {
    const fresh = await seedRestaurant("DeductTwice");
    const bun = await add(fresh, "Bun", "Piece", 20, 0);

    await fresh.manager.put(`/api/menu/items/${fresh.itemId}/recipe`, {
      lines: [{ inventoryItemId: bun.id, quantity: 1, unit: "Piece" }],
    });

    const order = await fresh.waiter.post<Order>("/api/waiter/orders", {
      tableId: fresh.tableId,
      items: [{ menuItemId: fresh.itemId, quantity: 2 }],
    });
    await fresh.waiter.post(`/api/waiter/orders/${order.id}/kitchen-tickets`);

    const afterFirst = await fresh.manager.get<InventoryItemDetail>(
      `/api/inventory/items/${bun.id}`,
    );
    expect(afterFirst.item.quantityInStock).toBe(18);

    // Add one more and send it. The already-submitted lines must not be deducted again.
    const current = await fresh.waiter.get<Order>(`/api/waiter/orders/${order.id}`);
    await fresh.waiter.put(`/api/waiter/orders/${order.id}`, {
      lines: current.items.map((line) => ({
        id: line.id,
        quantity: line.quantity,
        ...(line.note === null ? {} : { note: line.note }),
      })),
      newItems: [{ menuItemId: fresh.itemId, quantity: 1 }],
      rowVersion: current.rowVersion,
    });
    await fresh.waiter.post(`/api/waiter/orders/${order.id}/kitchen-tickets`);

    const afterSecond = await fresh.manager.get<InventoryItemDetail>(
      `/api/inventory/items/${bun.id}`,
    );

    // Three buns in total, not five.
    expect(afterSecond.item.quantityInStock).toBe(17);
    expect(afterSecond.movements.filter((m) => m.kind === "Consumed")).toHaveLength(2);
  });

  it("still lets the kitchen be told to cook when the shelf cannot cover it", async () => {
    const fresh = await seedRestaurant("DeductShort");
    const bun = await add(fresh, "Bun", "Piece", 1, 0);

    await fresh.manager.put(`/api/menu/items/${fresh.itemId}/recipe`, {
      lines: [{ inventoryItemId: bun.id, quantity: 1, unit: "Piece" }],
    });

    const order = await fresh.waiter.post<Order>("/api/waiter/orders", {
      tableId: fresh.tableId,
      items: [{ menuItemId: fresh.itemId, quantity: 4 }],
    });

    const submitted = await fresh.waiter.attempt(
      "POST",
      `/api/waiter/orders/${order.id}/kitchen-tickets`,
    );

    // A service must not stop because a count was wrong. The submission goes through.
    expect(submitted.status).toBe(201);

    const detail = await fresh.manager.get<InventoryItemDetail>(
      `/api/inventory/items/${bun.id}`,
    );

    // The balance goes negative, which is a true statement that more was cooked than
    // the records held rather than a clamp hiding it.
    expect(detail.item.quantityInStock).toBe(-3);
    expect(detail.item.isNegative).toBe(true);
    expect(detail.item.isOutOfStock).toBe(true);

    const overview = await fresh.manager.get<InventoryOverview>(
      "/api/inventory/items",
    );
    expect(overview.negativeCount).toBe(1);
  });

  it("keeps a cancelled order deduction, because the food was already cooked", async () => {
    const fresh = await seedRestaurant("DeductCancel");
    const bun = await add(fresh, "Bun", "Piece", 10, 0);

    await fresh.manager.put(`/api/menu/items/${fresh.itemId}/recipe`, {
      lines: [{ inventoryItemId: bun.id, quantity: 1, unit: "Piece" }],
    });

    const order = await fresh.waiter.post<Order>("/api/waiter/orders", {
      tableId: fresh.tableId,
      items: [{ menuItemId: fresh.itemId, quantity: 2 }],
    });
    await fresh.waiter.post(`/api/waiter/orders/${order.id}/kitchen-tickets`);

    await fresh.manager.post(`/api/billing/orders/${order.id}/cancellation`, {
      reason: "Guests walked out after ordering",
    });

    const detail = await fresh.manager.get<InventoryItemDetail>(
      `/api/inventory/items/${bun.id}`,
    );

    // Cancelling the order does not un-cook the food, so the stock stays gone. Putting
    // it back would claim the buns were never used.
    expect(detail.item.quantityInStock).toBe(8);
  });

  it("sums one ingredient into a single movement per submission", async () => {
    const fresh = await seedRestaurant("DeductSum");
    const bun = await add(fresh, "Bun", "Piece", 30, 0);

    await fresh.manager.put(`/api/menu/items/${fresh.itemId}/recipe`, {
      lines: [{ inventoryItemId: bun.id, quantity: 1, unit: "Piece" }],
    });

    // Two lines of the same item, kept apart by their notes.
    const order = await fresh.waiter.post<Order>("/api/waiter/orders", {
      tableId: fresh.tableId,
      items: [
        { menuItemId: fresh.itemId, quantity: 2, note: "No onion" },
        { menuItemId: fresh.itemId, quantity: 3, note: "Extra spicy" },
      ],
    });
    await fresh.waiter.post(`/api/waiter/orders/${order.id}/kitchen-tickets`);

    const detail = await fresh.manager.get<InventoryItemDetail>(
      `/api/inventory/items/${bun.id}`,
    );

    expect(detail.item.quantityInStock).toBe(25);
    // One movement, not two: correct arithmetic either way, readable history only one.
    expect(detail.movements.filter((m) => m.kind === "Consumed")).toHaveLength(1);
  });

  /* ------------------------------------------------------- Isolation and access */

  it("keeps one restaurant shelves out of another", async () => {
    const other = await seedRestaurant("InventoryOther");
    const theirs = await add(other, "Their Flour", "Kilogram", 5, 1);

    const overview = await seeded.manager.get<InventoryOverview>(
      "/api/inventory/items?includeArchived=true",
    );
    expect(overview.items.some((i) => i.id === theirs.id)).toBe(false);

    const refused = await seeded.manager.attempt(
      "GET",
      `/api/inventory/items/${theirs.id}`,
    );
    expect(refused.status).toBe(404);

    const refusedMove = await seeded.manager.attempt(
      "POST",
      `/api/inventory/items/${theirs.id}/movements`,
      { kind: "Received", quantity: 1, increase: true },
    );
    expect(refusedMove.status).toBe(404);
  });

  it("refuses every role that does not own a restaurant", async () => {
    for (const caller of [seeded.waiter, seeded.chef, seeded.cashier]) {
      expect(
        (await caller.attempt("GET", "/api/inventory/items")).status,
      ).toBeGreaterThanOrEqual(400);
      expect(
        (await caller.attempt("GET", "/api/inventory/recipes")).status,
      ).toBeGreaterThanOrEqual(400);
      expect(
        (
          await caller.attempt("GET", `/api/menu/items/${seeded.itemId}/recipe`)
        ).status,
      ).toBeGreaterThanOrEqual(400);
    }

    const orphan = await seedUnassignedManager();
    expect((await orphan.attempt("GET", "/api/inventory/items")).status).toBe(404);
  });

  /* --------------------------------------------------------------------- Helpers */

  async function addItem(
    name: string,
    unit: string,
    quantity: number,
    minimum: number,
  ): Promise<InventoryItem> {
    return add(seeded, name, unit, quantity, minimum);
  }

  async function add(
    target: Seeded,
    name: string,
    unit: string,
    quantity: number,
    minimum: number,
  ): Promise<InventoryItem> {
    const created = await target.manager.post<InventoryItem>("/api/inventory/items", {
      name,
      unit,
      quantityInStock: quantity,
      minimumQuantity: minimum,
    });

    expectText(created.id, "created.id");
    expectNumber(created.quantityInStock, "created.quantityInStock");

    return created;
  }
});
