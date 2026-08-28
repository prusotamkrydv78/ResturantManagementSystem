import { Caller, signIn } from "./client";
import { seededPassword, superAdmin } from "./env";

/** A restaurant with a manager and nothing else in it. */
export interface BareSeeded {
  restaurantId: string;
  restaurantSlug: string;
  managerEmail: string;
  manager: Caller;
  waiter: Caller;
}

/**
 * A restaurant built for one test file, with the three staff who work it.
 *
 * Everything is created through the real endpoints, in the real order a platform
 * admin and a manager would use. That is deliberate: the seed is itself a test of the
 * administration surface, so a broken create endpoint fails here instead of being
 * quietly stepped over by a direct database write.
 *
 * Each file seeds its own, so no test depends on another leftovers and nothing
 * touches records that already exist in the development database.
 */
export interface Seeded {
  restaurantId: string;
  restaurantName: string;
  tableId: string;
  tableName: string;
  secondTableId: string;
  secondTableName: string;
  categoryId: string;
  itemId: string;
  itemName: string;
  itemPrice: number;
  manager: Caller;
  waiter: Caller;
  chef: Caller;
  cashier: Caller;
  /** The waiter login, so a test can exercise sign-in itself rather than assume it. */
  waiterEmail: string;
  password: string;
}

/**
 * Seeds a restaurant ready to trade: two tables in service, one orderable item, and
 * a waiter, chef and cashier.
 *
 * The label only has to be unique within a run; a suffix keeps the restaurant slug
 * and the staff emails from colliding with earlier runs against the same database.
 */
export async function seedRestaurant(label: string): Promise<Seeded> {
  const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const credentials = superAdmin();

  const admin = await signIn("super admin", credentials.email, credentials.password);

  const restaurantName = `Contract ${label} ${suffix}`;

  const restaurant = await admin.post<{ id: string; name: string }>(
    "/api/restaurants",
    {
      name: restaurantName,
      slug: `contract-${label.toLowerCase()}-${suffix}`,
    },
  );

  // Assigned at creation, which is also the path the admin screens use.
  const managerEmail = `manager.${suffix}@contract.test`;
  await admin.post("/api/managers", {
    fullName: `Contract Manager ${suffix}`,
    email: managerEmail,
    password: seededPassword,
    restaurantId: restaurant.id,
  });

  const manager = await signIn("manager", managerEmail, seededPassword);

  const table = await manager.post<{ id: string; name: string }>("/api/tables", {
    name: "Table 1",
    capacity: 4,
  });

  const secondTable = await manager.post<{ id: string; name: string }>("/api/tables", {
    name: "Table 2",
    capacity: 2,
  });

  const category = await manager.post<{ id: string }>("/api/menu/categories", {
    name: "Mains",
    displayOrder: 1,
  });

  const itemPrice = 12.5;
  const item = await manager.post<{ id: string; name: string; price: number }>(
    "/api/menu/items",
    {
      name: "Chicken Burger",
      price: itemPrice,
      categoryId: category.id,
    },
  );

  async function addStaff(role: "Waiter" | "Chef" | "Cashier") {
    const email = `${role.toLowerCase()}.${suffix}@contract.test`;

    await manager.post("/api/staff", {
      fullName: `Contract ${role} ${suffix}`,
      email,
      password: seededPassword,
      role,
    });

    return { email, caller: await signIn(role.toLowerCase(), email, seededPassword) };
  }

  const [waiter, chef, cashier] = await Promise.all([
    addStaff("Waiter"),
    addStaff("Chef"),
    addStaff("Cashier"),
  ]);

  return {
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    tableId: table.id,
    tableName: table.name,
    secondTableId: secondTable.id,
    secondTableName: secondTable.name,
    categoryId: category.id,
    itemId: item.id,
    itemName: item.name,
    itemPrice: item.price,
    manager,
    waiter: waiter.caller,
    chef: chef.caller,
    cashier: cashier.caller,
    waiterEmail: waiter.email,
    password: seededPassword,
  };
}

/**
 * A restaurant that exists but cannot trade: a manager, a waiter, and no tables or
 * menu at all.
 *
 * This is the state every restaurant starts in, and the one the empty screens have to
 * handle. It is worth seeding deliberately because the ordinary seed skips straight
 * past it, so nothing else in the suite ever sees a restaurant on its first day.
 */
export async function seedBareRestaurant(label: string): Promise<BareSeeded> {
  const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const credentials = superAdmin();
  const admin = await signIn("super admin", credentials.email, credentials.password);

  const slug = `bare-${label.toLowerCase()}-${suffix}`;

  const restaurant = await admin.post<{ id: string }>("/api/restaurants", {
    name: `Bare ${label} ${suffix}`,
    slug,
  });

  const managerEmail = `bare.manager.${suffix}@contract.test`;
  await admin.post("/api/managers", {
    fullName: `Bare Manager ${suffix}`,
    email: managerEmail,
    password: seededPassword,
    restaurantId: restaurant.id,
  });

  const manager = await signIn("bare manager", managerEmail, seededPassword);

  const waiterEmail = `bare.waiter.${suffix}@contract.test`;
  await manager.post("/api/staff", {
    fullName: `Bare Waiter ${suffix}`,
    email: waiterEmail,
    password: seededPassword,
    role: "Waiter",
  });

  return {
    restaurantId: restaurant.id,
    restaurantSlug: slug,
    managerEmail,
    manager,
    waiter: await signIn("bare waiter", waiterEmail, seededPassword),
  };
}

/**
 * A manager who owns no restaurant.
 *
 * Every manager screen has to survive this: the account is real and correctly
 * authorised, and there is simply nothing behind it.
 */
export async function seedUnassignedManager(): Promise<Caller> {
  const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const credentials = superAdmin();
  const admin = await signIn("super admin", credentials.email, credentials.password);

  const email = `unassigned.${suffix}@contract.test`;

  await admin.post("/api/managers", {
    fullName: `Unassigned Manager ${suffix}`,
    email,
    password: seededPassword,
  });

  return signIn("unassigned manager", email, seededPassword);
}

/** A signed-in super admin, for the platform-level checks. */
export async function signInSuperAdmin(): Promise<Caller> {
  const credentials = superAdmin();

  return signIn("super admin", credentials.email, credentials.password);
}
