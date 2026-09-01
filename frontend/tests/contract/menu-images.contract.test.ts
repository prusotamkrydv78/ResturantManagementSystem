import { beforeAll, describe, expect, it } from "vitest";
import { guest, requireApi } from "./support/client";
import { seedRestaurant, type Seeded } from "./support/seed";
import type { MenuItem } from "@/types/menu";
import type { PublicTable } from "@/types/public-ordering";

/**
 * Photographs on menu items.
 *
 * This is the only image in the product a paying guest is shown, which makes the two
 * ends of it matter more than the middle. At one end a manager can put arbitrary bytes
 * into the database; at the other, a stranger's phone is told to load them from a route
 * with no authentication on it at all.
 *
 * So the rules held hardest here are: a file is stored only if its bytes actually begin
 * the way its declared type says, the picture reaches the scanned page a guest sees,
 * and one restaurant cannot put a photograph on another's menu.
 */
describe("menu images", () => {
  let seeded: Seeded;
  let scanToken: string;

  beforeAll(async () => {
    await requireApi();
    seeded = await seedRestaurant("MenuImages");

    // The seed leaves guest ordering off, which is the right default for a table but
    // means the scanned page cannot be reached until it is switched on.
    const tables = await seeded.manager.get<
      { id: string; publicOrderingToken: string }[]
    >("/api/tables");

    const table = tables.find((candidate) => candidate.id === seeded.tableId);

    if (table === undefined) {
      throw new Error("the seeded table is missing from the table list");
    }

    await seeded.manager.put(`/api/tables/${table.id}/ordering`, {
      isOrderingEnabled: true,
    });

    scanToken = table.publicOrderingToken;
  });

  /** The smallest valid PNG: the eight byte signature is all the sniff reads. */
  function png(size = 64): Blob {
    const bytes = new Uint8Array(size);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    return new Blob([bytes], { type: "image/png" });
  }

  it("starts with no picture", async () => {
    const item = await seeded.manager.get<MenuItem>(
      `/api/menu/items/${seeded.itemId}`,
    );

    expect(item.imageUrl).toBeNull();
  });

  it("shows the picture to a guest who scans the table", async () => {
    const saved = (
      await seeded.manager.upload(
        `/api/menu/items/${seeded.itemId}/image`,
        png(),
        "dish.png",
      )
    ).body as MenuItem;

    expect(saved.imageUrl).not.toBeNull();

    // The whole point of the feature. A guest has no account, so this is fetched the
    // way a scanned phone fetches it - with no token anywhere.
    const table = await guest.get<PublicTable>(
      `/api/public/tables/${scanToken}`,
    );

    const onMenu = table.menu
      .flatMap((section) => section.items)
      .find((candidate) => candidate.id === seeded.itemId);

    expect(onMenu?.imageUrl).toBe(saved.imageUrl);

    const served = await guest.bytes(onMenu!.imageUrl!);

    expect(served.status).toBe(200);
    expect(served.contentType).toContain("image/png");
    expect(served.length).toBe(64);
  });

  it("caches hard against a URL that moves with the bytes", async () => {
    const first = (
      await seeded.manager.upload(
        `/api/menu/items/${seeded.itemId}/image`,
        png(64),
        "a.png",
      )
    ).body as MenuItem;

    const second = (
      await seeded.manager.upload(
        `/api/menu/items/${seeded.itemId}/image`,
        png(112),
        "b.png",
      )
    ).body as MenuItem;

    // A year-long cache is only safe because the URL changes with the picture.
    expect(second.imageUrl).not.toBe(first.imageUrl);

    const served = await guest.bytes(second.imageUrl!);

    expect(served.cacheControl).toContain("immutable");
    expect(served.length).toBe(112);
  });

  it("refuses a file that is not the picture it claims to be", async () => {
    const imposter = new Blob(
      [new TextEncoder().encode("<script>alert(1)</script>--")],
      { type: "image/png" },
    );

    const upload = await seeded.manager.upload(
      `/api/menu/items/${seeded.itemId}/image`,
      imposter,
      "evil.png",
    );

    expect(upload.status).toBe(400);
  });

  it("removes a picture, and the guest stops being shown one", async () => {
    await seeded.manager.upload(
      `/api/menu/items/${seeded.itemId}/image`,
      png(),
      "dish.png",
    );

    const removed = await seeded.manager.attempt(
      "DELETE",
      `/api/menu/items/${seeded.itemId}/image`,
    );

    expect(removed.status).toBe(200);
    expect((removed.body as MenuItem).imageUrl).toBeNull();

    const table = await guest.get<PublicTable>(
      `/api/public/tables/${scanToken}`,
    );

    const onMenu = table.menu
      .flatMap((section) => section.items)
      .find((candidate) => candidate.id === seeded.itemId);

    expect(onMenu?.imageUrl).toBeNull();
  });

  it("keeps one restaurant out of another's menu pictures", async () => {
    const other = await seedRestaurant("MenuImagesOther");

    const upload = await other.manager.upload(
      `/api/menu/items/${seeded.itemId}/image`,
      png(),
      "dish.png",
    );

    // Not found rather than forbidden: an identifier from another restaurant does not
    // resolve, so probing tells the caller nothing.
    expect(upload.status).toBe(404);
  });

  it("keeps staff away from uploading at all", async () => {
    const upload = await seeded.waiter.upload(
      `/api/menu/items/${seeded.itemId}/image`,
      png(),
      "dish.png",
    );

    expect(upload.status).toBe(403);
  });
});
