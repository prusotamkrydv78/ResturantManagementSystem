"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Search, ScrollText, Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, describedBy } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Surface, SurfaceHeader } from "@/components/ui/surface";
import {
  EmptyState,
  ErrorState,
  FormError,
  TableSkeleton,
} from "@/components/ui/states";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { RecipeDialog } from "@/features/inventory/recipe-dialog";
import {
  createCategory,
  createItem,
  listCategories,
  listItems,
  setCategoryActive,
  setItemActive,
  updateCategory,
  updateItem,
} from "@/features/menu/api";
import { ApiError } from "@/lib/api/client";
import type { MenuCategory, MenuItem } from "@/types/menu";

/**
 * Menu management for the signed-in manager restaurant.
 *
 * An internal management interface, not a guest-facing menu. Categories sit above
 * items because an item cannot exist without one.
 */
export default function MenuPage() {
  return (
    <RequireAuth roles={["RestaurantManager"]}>
      <MenuManager />
    </RequireAuth>
  );
}

function MenuManager() {
  const [categories, setCategories] = useState<MenuCategory[] | null>(null);
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [loadedCategories, loadedItems] = await Promise.all([
        listCategories(),
        listItems({ search, categoryId: categoryFilter }),
      ]);
      setCategories(loadedCategories);
      setItems(loadedItems);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load the menu.");
    }
  }, [search, categoryFilter]);

  // Search and filtering go back to the server, so they cover the whole menu.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [loadedCategories, loadedItems] = await Promise.all([
          listCategories(),
          listItems({ search, categoryId: categoryFilter }),
        ]);
        if (!cancelled) {
          setCategories(loadedCategories);
          setItems(loadedItems);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Unable to load the menu.");
        }
      }
    }

    const timer = setTimeout(() => void load(), 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, categoryFilter]);

  const isFiltering = search.trim() !== "" || categoryFilter !== "";
  const hasCategories = categories !== null && categories.length > 0;

  return (
    <>
      <PageHeader
        title="Menu"
        description="Categories and the items inside them. Guests never see this screen."
        crumbs={[{ label: "Workspace", href: "/dashboard" }, { label: "Menu" }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <CategoryDialog categories={categories ?? []} onSaved={refresh} />
            {hasCategories && (
              <ItemDialog categories={categories ?? []} onSaved={refresh} />
            )}
          </div>
        }
      />

      <PageBody>
        {error !== null && (
          <Surface>
            <ErrorState message={error} onRetry={() => void refresh()} />
          </Surface>
        )}

        {/* Categories first: an item cannot exist without one. */}
        <Surface>
          <SurfaceHeader
            title="Categories"
            description={
              categories === null
                ? "Loading…"
                : `${categories.length} ${categories.length === 1 ? "category" : "categories"}`
            }
          />

          {categories === null ? (
            <TableSkeleton rows={3} columns={4} />
          ) : categories.length === 0 ? (
            <EmptyState
              icon={<Tags />}
              title="No categories yet"
              description="Start with something like Starters or Drinks, then add items to it."
              action={<CategoryDialog categories={[]} onSaved={refresh} />}
            />
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Category</Th>
                    <Th>Items</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Order</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <Tr key={category.id}>
                      <Td>
                        <span className="font-medium text-text">{category.name}</span>
                        {category.description !== null && (
                          <span className="block truncate text-2xs text-muted">
                            {category.description}
                          </span>
                        )}
                      </Td>
                      <Td className="text-muted tabular">
                        {category.itemCount === 0 ? (
                          "—"
                        ) : (
                          <>
                            {category.itemCount}
                            {category.activeItemCount !== category.itemCount && (
                              <span className="text-subtle">
                                {" "}
                                ({category.activeItemCount} on)
                              </span>
                            )}
                          </>
                        )}
                      </Td>
                      <Td>
                        {category.isActive ? (
                          <Badge tone="success" dot>
                            On menu
                          </Badge>
                        ) : (
                          <Badge tone="neutral" dot>
                            Hidden
                          </Badge>
                        )}
                      </Td>
                      <Td className="text-right text-muted tabular">
                        {category.displayOrder}
                      </Td>
                      <Td className="text-right">
                        <CategoryDialog
                          categories={categories}
                          category={category}
                          onSaved={refresh}
                        />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Surface>

        {/* Items */}
        <Surface>
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative sm:max-w-xs sm:flex-1">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle"
                  aria-hidden="true"
                />
                <Input
                  id="item-search"
                  type="search"
                  placeholder="Search items"
                  className="pl-8"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Search menu items"
                />
              </div>

              <Select
                id="item-category-filter"
                className="sm:w-52"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                aria-label="Filter by category"
                disabled={!hasCategories}
              >
                <option value="">All categories</option>
                {(categories ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </div>

            <p className="text-sm text-muted">
              {items === null
                ? "Loading…"
                : `${items.length} ${items.length === 1 ? "item" : "items"}`}
            </p>
          </div>

          {items === null ? (
            <TableSkeleton rows={5} columns={4} />
          ) : items.length === 0 ? (
            isFiltering ? (
              <EmptyState
                icon={<Search />}
                title="Nothing matches"
                description="Try a different search term or category."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch("");
                      setCategoryFilter("");
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<ScrollText />}
                title={hasCategories ? "No items yet" : "Add a category first"}
                description={
                  hasCategories
                    ? "Add the dishes and drinks you sell."
                    : "Items live inside a category, so create one before adding items."
                }
                action={
                  hasCategories ? (
                    <ItemDialog categories={categories ?? []} onSaved={refresh} />
                  ) : undefined
                }
              />
            )
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Item</Th>
                    <Th>Category</Th>
                    <Th className="text-right">Price</Th>
                    <Th>Status</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <Tr key={item.id}>
                      <Td>
                        <span className="font-medium text-text">{item.name}</span>
                        {item.description !== null && (
                          <span className="block max-w-xs truncate text-2xs text-muted">
                            {item.description}
                          </span>
                        )}
                      </Td>
                      <Td className="text-muted">{item.categoryName}</Td>
                      <Td className="text-right text-text tabular">
                        {formatPrice(item.price)}
                      </Td>
                      <Td>
                        <ItemStatusBadge item={item} />
                      </Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* What it is made from lives next to the item itself, since
                              that is where a manager is when they think of it. */}
                          <RecipeDialog
                            menuItemId={item.id}
                            menuItemName={item.name}
                            onSaved={refresh}
                          />
                          <ItemDialog
                            categories={categories ?? []}
                            item={item}
                            onSaved={refresh}
                          />
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Surface>
      </PageBody>
    </>
  );
}

/**
 * An item can be off the menu for two different reasons, and a manager needs to
 * tell them apart: its own switch, or the category it sits in.
 */
function ItemStatusBadge({ item }: { item: MenuItem }) {
  if (item.isAvailable) {
    return (
      <Badge tone="success" dot>
        On menu
      </Badge>
    );
  }

  if (!item.isActive) {
    return (
      <Badge tone="neutral" dot>
        Hidden
      </Badge>
    );
  }

  return (
    <Badge tone="warning" dot>
      Category hidden
    </Badge>
  );
}

function formatPrice(price: number): string {
  return price.toFixed(2);
}

function firstError(
  errors: Record<string, string[]>,
  field: string,
): string | undefined {
  return errors[field]?.[0];
}

/* -------------------------------------------------------------------------- */
/* Category create / edit                                                     */
/* -------------------------------------------------------------------------- */

function CategoryDialog({
  categories,
  category,
  onSaved,
}: {
  categories: MenuCategory[];
  category?: MenuCategory;
  onSaved: () => Promise<void>;
}) {
  const isEditing = category !== undefined;

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [order, setOrder] = useState(
    category === undefined ? "" : String(category.displayOrder),
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState<"none" | "save" | "status">("none");

  function reset() {
    setName(category?.name ?? "");
    setDescription(category?.description ?? "");
    setOrder(category === undefined ? "" : String(category.displayOrder));
    setError(null);
    setFieldErrors({});
  }

  async function run(action: "save" | "status", work: () => Promise<unknown>) {
    setError(null);
    setFieldErrors({});
    setBusy(action);

    try {
      await work();
      await onSaved();
      setIsOpen(false);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors);
      } else {
        setError(caught instanceof Error ? caught.message : "The action failed.");
      }
    } finally {
      setBusy("none");
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const payload = {
      name,
      description: description.trim() === "" ? null : description.trim(),
    };

    void run("save", () =>
      isEditing
        ? updateCategory(category.id, {
            ...payload,
            displayOrder: Number(order === "" ? category.displayOrder : order),
          })
        : createCategory(
            order === "" ? payload : { ...payload, displayOrder: Number(order) },
          ),
    );
  }

  const activeItems = category?.activeItemCount ?? 0;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        setIsOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        {isEditing ? (
          <Button variant="secondary" size="sm" icon={<Pencil />}>
            Manage
          </Button>
        ) : (
          <Button variant="secondary" icon={<Tags />}>
            Add category
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        title={isEditing ? category.name : "Add category"}
        description={
          isEditing
            ? `${category.itemCount} ${category.itemCount === 1 ? "item" : "items"}`
            : "Categories group your items, such as Starters or Drinks."
        }
      >
        {isEditing && (
          <div className="flex flex-col gap-3 border-b border-border px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-text">Menu status</h3>
              {category.isActive ? (
                <Badge tone="success" dot>
                  On menu
                </Badge>
              ) : (
                <Badge tone="neutral" dot>
                  Hidden
                </Badge>
              )}
            </div>

            <p className="text-sm text-muted">
              {category.isActive
                ? activeItems > 0
                  ? `Hiding this category also takes its ${activeItems} active ${activeItems === 1 ? "item" : "items"} off the menu. The items themselves are kept and unchanged.`
                  : "Hiding this category takes it off the menu. Its items are kept and unchanged."
                : "This category and its items are off the menu. Its items keep their own settings."}
            </p>

            <Button
              variant={category.isActive ? "secondary" : "primary"}
              size="sm"
              className="self-start"
              disabled={busy !== "none"}
              onClick={() =>
                void run("status", () =>
                  setCategoryActive(category.id, !category.isActive),
                )
              }
            >
              {busy === "status"
                ? "Saving…"
                : category.isActive
                  ? "Hide from menu"
                  : "Show on menu"}
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-4 py-4">
            {error !== null && <FormError message={error} />}

            <Field
              htmlFor="category-name"
              label="Name"
              required
              error={firstError(fieldErrors, "name")}
            >
              <Input
                id="category-name"
                required
                maxLength={80}
                autoFocus={!isEditing}
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={firstError(fieldErrors, "name") !== undefined}
              />
            </Field>

            <Field
              htmlFor="category-description"
              label="Description"
              error={firstError(fieldErrors, "description")}
            >
              <Textarea
                id="category-description"
                rows={2}
                maxLength={400}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>

            <Field
              htmlFor="category-order"
              label="Menu position"
              hint={
                isEditing
                  ? "Lower numbers appear first."
                  : `Leave blank to place it after the current ${categories.length}.`
              }
              error={firstError(fieldErrors, "displayOrder")}
            >
              <Input
                id="category-order"
                type="number"
                inputMode="numeric"
                min={0}
                max={9999}
                className="sm:max-w-32"
                value={order}
                onChange={(event) => setOrder(event.target.value)}
                aria-describedby={describedBy("category-order", { hasHint: true })}
              />
            </Field>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">{isEditing ? "Close" : "Cancel"}</Button>
            </DialogClose>
            <Button type="submit" disabled={busy !== "none"}>
              {busy === "save" ? "Saving…" : isEditing ? "Save changes" : "Add category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Item create / edit                                                         */
/* -------------------------------------------------------------------------- */

function ItemDialog({
  categories,
  item,
  onSaved,
}: {
  categories: MenuCategory[];
  item?: MenuItem;
  onSaved: () => Promise<void>;
}) {
  const isEditing = item !== undefined;

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [price, setPrice] = useState(item === undefined ? "" : item.price.toFixed(2));
  const [categoryId, setCategoryId] = useState(
    item?.categoryId ?? categories[0]?.id ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState<"none" | "save" | "status">("none");

  function reset() {
    setName(item?.name ?? "");
    setDescription(item?.description ?? "");
    setPrice(item === undefined ? "" : item.price.toFixed(2));
    setCategoryId(item?.categoryId ?? categories[0]?.id ?? "");
    setError(null);
    setFieldErrors({});
  }

  async function run(action: "save" | "status", work: () => Promise<unknown>) {
    setError(null);
    setFieldErrors({});
    setBusy(action);

    try {
      await work();
      await onSaved();
      setIsOpen(false);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors);
      } else {
        setError(caught instanceof Error ? caught.message : "The action failed.");
      }
    } finally {
      setBusy("none");
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const payload = {
      name,
      description: description.trim() === "" ? null : description.trim(),
      price: Number(price),
      categoryId,
    };

    void run("save", () =>
      isEditing ? updateItem(item.id, payload) : createItem(payload),
    );
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        setIsOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        {isEditing ? (
          <Button variant="secondary" size="sm" icon={<Pencil />}>
            Manage
          </Button>
        ) : (
          <Button icon={<Plus />}>Add item</Button>
        )}
      </DialogTrigger>

      <DialogContent
        title={isEditing ? item.name : "Add item"}
        description={isEditing ? item.categoryName : "Items live inside a category."}
      >
        {isEditing && (
          <div className="flex flex-col gap-3 border-b border-border px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-text">Menu status</h3>
              <ItemStatusBadge item={item} />
            </div>

            <p className="text-sm text-muted">
              {item.isActive && !item.isCategoryActive
                ? "This item is switched on, but its category is hidden, so it is off the menu. Show the category to bring it back."
                : item.isActive
                  ? "Hiding an item keeps its record and takes it off the menu."
                  : "This item is off the menu. Its record is kept."}
            </p>

            <Button
              variant={item.isActive ? "secondary" : "primary"}
              size="sm"
              className="self-start"
              disabled={busy !== "none"}
              onClick={() => void run("status", () => setItemActive(item.id, !item.isActive))}
            >
              {busy === "status"
                ? "Saving…"
                : item.isActive
                  ? "Hide from menu"
                  : "Show on menu"}
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-4 py-4">
            {error !== null && <FormError message={error} />}

            <Field
              htmlFor="item-name"
              label="Name"
              required
              error={firstError(fieldErrors, "name")}
            >
              <Input
                id="item-name"
                required
                maxLength={120}
                autoFocus={!isEditing}
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={firstError(fieldErrors, "name") !== undefined}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                htmlFor="item-category"
                label="Category"
                required
                error={firstError(fieldErrors, "categoryId")}
              >
                <Select
                  id="item-category"
                  required
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                      {category.isActive ? "" : " (hidden)"}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                htmlFor="item-price"
                label="Price"
                required
                error={firstError(fieldErrors, "price")}
              >
                <Input
                  id="item-price"
                  type="number"
                  inputMode="decimal"
                  required
                  min={0}
                  step="0.01"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  aria-invalid={firstError(fieldErrors, "price") !== undefined}
                />
              </Field>
            </div>

            <Field
              htmlFor="item-description"
              label="Description"
              error={firstError(fieldErrors, "description")}
            >
              <Textarea
                id="item-description"
                rows={3}
                maxLength={600}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">{isEditing ? "Close" : "Cancel"}</Button>
            </DialogClose>
            <Button type="submit" disabled={busy !== "none"}>
              {busy === "save" ? "Saving…" : isEditing ? "Save changes" : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
