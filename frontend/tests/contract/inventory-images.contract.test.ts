import { beforeAll, describe, expect, it } from "vitest";
import { guest, requireApi } from "./support/client";
import { seedRestaurant, type Seeded } from "./support/seed";
import type { InventoryItem } from "@/types/inventory";

/**
 * Photographs on inventory items.
 *
 * The picture itself is decoration - nothing in the product reads it - but the route
 * that serves it is the one place in the application that hands bytes to an
 * unauthenticated caller, and the route that accepts it is the one place a manager
 * can put arbitrary bytes into the database. Those two facts are what these tests are
 * really about.
 *
 * The rules worth holding hardest: a file is stored only if its bytes actually begin
 * the way its declared type says they should, one restaurant cannot put a picture on
 * another's shelf, and the URL changes whenever the picture does so a replacement is
 * never hidden behind the cache of the one before it.
 */
describe("inventory images", () => {
  let seeded: Seeded;

  beforeAll(async () => {
    await requireApi();
    seeded = await seedRestaurant("InventoryImages");
  });

  /** The smallest valid PNG: an 8-byte signature is all the sniff checks. */
  function png(): Blob {
    const bytes = new Uint8Array(64);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    return new Blob([bytes], { type: "image/png" });
  }

  /** A file claiming to be a picture that is nothing of the sort. */
  function imposter(): Blob {
    return new Blob([new TextEncoder().encode("<script>alert(1)</script>--")], {
      type: "image/png",
    });
  }

  async function newItem(name: string): Promise<InventoryItem> {
    return seeded.manager.post<InventoryItem>("/api/inventory/items", {
      name,
      unit: "Kilogram",
      quantityInStock: 5,
      minimumQuantity: 1,
    });
  }

  it("starts with no picture", async () => {
    const item = await newItem("Onions");

    expect(item.imageUrl).toBeNull();
  });

  it("stores a picture and serves it back to anyone with the link", async () => {
    const item = await newItem("Tomatoes");

    const upload = await seeded.manager.upload(
      `/api/inventory/items/${item.id}/image`,
      png(),
      "tomatoes.png",
    );

    expect(upload.status).toBe(200);

    const withImage = upload.body as InventoryItem;
    expect(withImage.imageUrl).not.toBeNull();

    // An image tag cannot send a token, so this route has to answer a caller with no
    // session at all. That is the whole design, and it is worth asserting rather than
    // assuming.
    const served = await guest.bytes(withImage.imageUrl!);

    expect(served.status).toBe(200);
    expect(served.contentType).toContain("image/png");
    expect(served.length).toBe(64);
  });

  it("caches hard against a URL that changes with the picture", async () => {
    const item = await newItem("Garlic");

    const first = (
      await seeded.manager.upload(
        `/api/inventory/items/${item.id}/image`,
        png(),
        "garlic.png",
      )
    ).body as InventoryItem;

    // A different size, so a stale response would be caught by the length alone.
    const bigger = new Uint8Array(96);
    bigger.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);

    const second = (
      await seeded.manager.upload(
        `/api/inventory/items/${item.id}/image`,
        new Blob([bigger], { type: "image/png" }),
        "garlic-2.png",
      )
    ).body as InventoryItem;

    // The year-long cache is only safe because the URL moves with the bytes.
    expect(second.imageUrl).not.toBe(first.imageUrl);

    const served = await guest.bytes(second.imageUrl!);

    expect(served.cacheControl).toContain("immutable");
    expect(served.length).toBe(96);
  });

  it("refuses a file that is not the picture it claims to be", async () => {
    const item = await newItem("Basil");

    const upload = await seeded.manager.upload(
      `/api/inventory/items/${item.id}/image`,
      imposter(),
      "basil.png",
    );

    expect(upload.status).toBe(400);

    // And nothing was stored, so the refusal is not merely a message.
    const listed = await seeded.manager.get<{ items: InventoryItem[] }>(
      "/api/inventory/items",
    );

    expect(
      listed.items.find((candidate) => candidate.id === item.id)?.imageUrl,
    ).toBeNull();
  });

  it("removes a picture", async () => {
    const item = await newItem("Thyme");

    await seeded.manager.upload(
      `/api/inventory/items/${item.id}/image`,
      png(),
      "thyme.png",
    );

    const removed = await seeded.manager.attempt(
      "DELETE",
      `/api/inventory/items/${item.id}/image`,
    );

    expect(removed.status).toBe(200);
    expect((removed.body as InventoryItem).imageUrl).toBeNull();
  });

  it("refuses to remove a picture that is not there", async () => {
    const item = await newItem("Parsley");

    const removed = await seeded.manager.attempt(
      "DELETE",
      `/api/inventory/items/${item.id}/image`,
    );

    expect(removed.status).toBe(404);
  });

  it("keeps one restaurant out of another's pictures", async () => {
    const other = await seedRestaurant("InventoryImagesOther");
    const item = await newItem("Rosemary");

    const upload = await other.manager.upload(
      `/api/inventory/items/${item.id}/image`,
      png(),
      "rosemary.png",
    );

    // Not found rather than forbidden: an identifier from another restaurant simply
    // does not resolve, so probing tells the caller nothing.
    expect(upload.status).toBe(404);
  });

  it("keeps staff away from uploading at all", async () => {
    const item = await newItem("Sage");

    const upload = await seeded.waiter.upload(
      `/api/inventory/items/${item.id}/image`,
      png(),
      "sage.png",
    );

    expect(upload.status).toBe(403);
  });
});
