"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ListPlus,
  Pencil,
  Plus,
  Search,
  ScrollText,
  Tags,
} from "lucide-react";
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
  createItems,
  deleteCategory,
  deleteItem,
  listCategories,
  listItems,
  reorderCategories,
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
  const [isReordering, setIsReordering] = useState(false);

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

  /**
   * Moves one category up or down and sends the whole resulting order.
   *
   * The API takes the full list rather than a position, because a place only means
   * anything relative to the others: sending "this one is now third" would pass
   * through a state where two categories claim third.
   */
  async function moveCategory(categoryId: string, direction: -1 | 1) {
    if (categories === null) return;

    const from = categories.findIndex((category) => category.id === categoryId);
    const to = from + direction;

    if (from === -1 || to < 0 || to >= categories.length) return;

    // Swapped through a temporary rather than a destructuring swap: indexed access
    // on an array is typed as possibly-undefined under noUncheckedIndexedAccess, and
    // the bounds are already established above.
    const order = categories.map((category) => category.id);
    const moved = order[from]!;
    order[from] = order[to]!;
    order[to] = moved;

    setIsReordering(true);

    try {
      const reordered = await reorderCategories(order);
      setCategories(reordered);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to reorder the menu.",
      );
    } finally {
      setIsReordering(false);
    }
  }

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
              <>
                <BulkItemsDialog categories={categories ?? []} onSaved={refresh} />
                <ItemDialog categories={categories ?? []} onSaved={refresh} />
              </>
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
                  {categories.map((category, index) => (
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
                      <Td className="text-right">
                        {/* Buttons rather than an editable number. Position is
                            relative, so "move this one up" is the operation a
                            manager actually has in mind; typing 3 into a box means
                            working out what everything else should become. */}
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="secondary"
                            size="sm"
                            aria-label={`Move ${category.name} up`}
                            disabled={isReordering || index === 0}
                            onClick={() => void moveCategory(category.id, -1)}
                          >
                            <ChevronUp className="size-3.5" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            aria-label={`Move ${category.name} down`}
                            disabled={isReordering || index === categories.length - 1}
                            onClick={() => void moveCategory(category.id, 1)}
                          >
                            <ChevronDown className="size-3.5" aria-hidden="true" />
                          </Button>
                        </div>
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

/**
 * Adds several items to one category at once.
 *
 * Entering a real menu a dish at a time is the longest job in setting a restaurant up,
 * and it is the same three fields over and over. This takes them as lines of text -
 * `Name | Price | Description` - because that is what a menu already looks like when
 * somebody has it written down or pasted from elsewhere.
 *
 * The batch saves together, so a bad price takes the whole paste back rather than
 * leaving half a course entered and the manager working out where they got to.
 */
function BulkItemsDialog({
  categories,
  onSaved,
}: {
  categories: MenuCategory[];
  onSaved: () => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsed = parseItemLines(text);
  const valid = parsed.filter((line) => line.error === null);
  const invalid = parsed.filter((line) => line.error !== null);

  function reset() {
    setCategoryId(categories[0]?.id ?? "");
    setText("");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await createItems(
        categoryId,
        valid.map((line) => ({
          name: line.name,
          price: line.price,
          ...(line.description === undefined ? {} : { description: line.description }),
        })),
      );

      reset();
      setIsOpen(false);
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add the items.");
    } finally {
      setIsSubmitting(false);
    }
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
        <Button variant="secondary" icon={<ListPlus />}>
          Add many
        </Button>
      </DialogTrigger>

      <DialogContent
        title="Add several items"
        description="One item per line, into a single category."
      >
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-4 py-4">
            {error !== null && <FormError message={error} />}

            <Field htmlFor="bulk-category" label="Category" required>
              <Select
                id="bulk-category"
                required
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              htmlFor="bulk-items"
              label="Items"
              required
              hint="One per line: Name | Price | Description. The description is optional."
            >
              <Textarea
                id="bulk-items"
                rows={10}
                required
                placeholder={"Veg Momo | 180 | Steamed dumplings\nChicken Momo | 220\nPaneer Tikka | 280"}
                value={text}
                onChange={(event) => setText(event.target.value)}
                aria-describedby={describedBy("bulk-items", { hasHint: true })}
              />
            </Field>

            {/* Counted before sending rather than after refusing: a paste of thirty
                lines with one typo should show the typo, not fail as a whole. */}
            {parsed.length > 0 && (
              <div className="flex flex-col gap-1.5 text-xs">
                <p className="text-muted">
                  <span className="font-medium text-text">{valid.length}</span> ready to
                  add
                  {invalid.length > 0 && (
                    <>
                      {" · "}
                      <span className="text-danger">
                        {invalid.length} need fixing
                      </span>
                    </>
                  )}
                </p>

                {invalid.slice(0, 5).map((line) => (
                  <p key={line.lineNumber} className="text-danger">
                    Line {line.lineNumber}: {line.error}
                  </p>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                categoryId === "" ||
                valid.length === 0 ||
                invalid.length > 0
              }
            >
              {isSubmitting
                ? "Adding…"
                : `Add ${valid.length} ${valid.length === 1 ? "item" : "items"}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** One parsed line of the bulk box, valid or not. */
interface ParsedItemLine {
  lineNumber: number;
  name: string;
  price: number;
  description?: string;
  error: string | null;
}

/**
 * Reads `Name | Price | Description` lines.
 *
 * Blank lines are skipped rather than reported: a paste usually carries them, and
 * complaining about whitespace would be noise.
 */
function parseItemLines(text: string): ParsedItemLine[] {
  return text
    .split("\n")
    .map((raw, index) => ({ raw: raw.trim(), lineNumber: index + 1 }))
    .filter((line) => line.raw !== "")
    .map(({ raw, lineNumber }) => {
      const [name = "", price = "", ...rest] = raw.split("|").map((part) => part.trim());
      const description = rest.join(" | ").trim();
      const parsedPrice = Number(price);

      const error =
        name === ""
          ? "needs a name."
          : price === ""
            ? "needs a price, after a | character."
            : !Number.isFinite(parsedPrice) || parsedPrice < 0
              ? `"${price}" is not a price.`
              : null;

      return {
        lineNumber,
        name,
        price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
        ...(description === "" ? {} : { description }),
        error,
      };
    });
}

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
  const [busy, setBusy] = useState<"none" | "save" | "status" | "delete">("none");

  function reset() {
    setName(category?.name ?? "");
    setDescription(category?.description ?? "");
    setOrder(category === undefined ? "" : String(category.displayOrder));
    setError(null);
    setFieldErrors({});
  }

  async function run(
    action: "save" | "status" | "delete",
    work: () => Promise<unknown>,
  ) {
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

            {isEditing && (
              <section className="flex flex-col gap-2 border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-text">Remove</h3>
                <p className="text-xs text-muted">
                  {category.itemCount > 0
                    ? "This category still has items. Move or delete them first, or hide the category instead."
                    : "Deleting is only for a category added by mistake. Hiding takes it off the menu without removing it."}
                </p>

                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  className="self-start"
                  disabled={busy !== "none" || category.itemCount > 0}
                  onClick={() =>
                    void run("delete", () => deleteCategory(category.id))
                  }
                >
                  {busy === "delete" ? "Deleting…" : "Delete category"}
                </Button>
              </section>
            )}
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
  const [busy, setBusy] = useState<"none" | "save" | "status" | "delete">("none");

  function reset() {
    setName(item?.name ?? "");
    setDescription(item?.description ?? "");
    setPrice(item === undefined ? "" : item.price.toFixed(2));
    setCategoryId(item?.categoryId ?? categories[0]?.id ?? "");
    setError(null);
    setFieldErrors({});
  }

  async function run(
    action: "save" | "status" | "delete",
    work: () => Promise<unknown>,
  ) {
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

            {isEditing && (
              <section className="flex flex-col gap-2 border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-text">Remove</h3>
                <p className="text-xs text-muted">
                  Deleting is only for an item added by mistake. Once it has been
                  ordered it is refused, because the sales history points at it. Hide it
                  instead to take it off the menu.
                </p>

                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  className="self-start"
                  disabled={busy !== "none"}
                  onClick={() => void run("delete", () => deleteItem(item.id))}
                >
                  {busy === "delete" ? "Deleting…" : "Delete item"}
                </Button>
              </section>
            )}
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
