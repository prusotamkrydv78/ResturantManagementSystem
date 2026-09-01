"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ImagePlus, Trash2, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, describedBy } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import {
  Notice,
  failure,
  fieldError,
  idle,
  type PanelState,
} from "@/components/ui/panel-state";
import { Select } from "@/components/ui/select";
import { DetailRow, Surface, SurfaceHeader } from "@/components/ui/surface";
import { ErrorState, FormError, Spinner } from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { RecipeDialog } from "@/features/inventory/recipe-dialog";
import {
  deleteItem,
  getItem,
  listCategories,
  removeItemImage,
  setItemActive,
  setItemImage,
  updateItem,
} from "@/features/menu/api";
import { apiAssetSrc } from "@/lib/api/asset-url";
import { MENU_IMAGE } from "@/types/menu";
import type { MenuCategory, MenuItem } from "@/types/menu";

/**
 * One dish, and everything a manager decides about it.
 *
 * A page rather than a dialog, for the reason the staff and table records became
 * pages: renaming it, pricing it, moving it between sections, photographing it,
 * taking it off the menu and deleting it are unrelated jobs, and a modal made them
 * one scrolling column that read as a form to fill in.
 *
 * The photograph is the reason this page earns its place rather than just matching
 * the others. It is the only image in the product a paying guest sees, and choosing
 * one is not something to do in a corner of a table row.
 */
export default function MenuItemPage() {
  return (
    <RequireAuth roles={["RestaurantManager"]}>
      <MenuItemView />
    </RequireAuth>
  );
}

function MenuItemView() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [item, setItem] = useState<MenuItem | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Both together: the details form cannot offer a section to move to without
        // the list, and showing the form before it arrives would mean a select that
        // is briefly empty.
        const [loaded, sections] = await Promise.all([getItem(id), listCategories()]);

        if (!cancelled) {
          setItem(loaded);
          setCategories(sections);
          setLoadError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setLoadError(
            caught instanceof Error ? caught.message : "Unable to load this item.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const apply = useCallback((next: MenuItem) => setItem(next), []);

  return (
    <>
      <PageHeader
        title={item?.name ?? "Menu item"}
        description={
          item === null
            ? undefined
            : `${item.categoryName} · ${item.price.toFixed(2)}`
        }
        crumbs={[
          { label: "Workspace", href: "/dashboard" },
          { label: "Menu", href: "/menu" },
          { label: item?.name ?? "Item" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {item !== null && <AvailabilityBadge item={item} />}
            <LinkButton href="/menu" variant="secondary" icon={<ArrowLeft />}>
              All items
            </LinkButton>
          </div>
        }
      />

      <PageBody>
        {loadError !== null && (
          <ErrorState
            message={loadError}
            onRetry={() => setReloadKey((key) => key + 1)}
          />
        )}

        {item === null && loadError === null && (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        )}

        {item !== null && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(22rem,1fr)]">
            <div className="flex flex-col gap-5">
              <DetailsPanel item={item} categories={categories} onSaved={apply} />
              <RecipePanel item={item} />
            </div>

            <div className="flex flex-col gap-5">
              <PhotoPanel item={item} onChanged={apply} />
              <AvailabilityPanel item={item} onChanged={apply} />
              <RemovePanel item={item} onDeleted={() => router.replace("/menu")} />
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}

/**
 * An item can be off the menu for two different reasons, and a manager needs to tell
 * them apart: its own switch, or the section it sits in.
 */
function AvailabilityBadge({ item }: { item: MenuItem }) {
  if (item.isAvailable) {
    return (
      <Badge tone="success" dot>
        On the menu
      </Badge>
    );
  }

  return (
    <Badge tone="neutral" dot>
      {item.isActive ? `${item.categoryName} is off` : "Off the menu"}
    </Badge>
  );
}

/* -------------------------------------------------------------------------- */
/* Details                                                                    */
/* -------------------------------------------------------------------------- */

function DetailsPanel({
  item,
  categories,
  onSaved,
}: {
  item: MenuItem;
  categories: MenuCategory[];
  onSaved: (next: MenuItem) => void;
}) {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [price, setPrice] = useState(String(item.price));
  const [categoryId, setCategoryId] = useState(item.categoryId);
  const [state, setState] = useState<PanelState>(idle);

  const isDirty =
    name !== item.name ||
    description !== (item.description ?? "") ||
    price !== String(item.price) ||
    categoryId !== item.categoryId;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setState({ status: "busy" });

    try {
      onSaved(
        await updateItem(item.id, {
          name: name.trim(),
          description: description.trim() === "" ? null : description.trim(),
          price: Number(price),
          categoryId,
        }),
      );
      setState({ status: "done", message: "Saved." });
    } catch (caught) {
      setState(failure(caught, "Could not save this item."));
    }
  }

  return (
    <Surface>
      <SurfaceHeader
        title="Details"
        description="What it is called, what it costs, and where it sits on the menu"
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
        {state.status === "error" && <FormError message={state.message} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            htmlFor="item-name"
            label="Name"
            required
            error={fieldError(state, "name")}
          >
            <Input
              id="item-name"
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={fieldError(state, "name") !== undefined}
            />
          </Field>

          <Field
            htmlFor="item-price"
            label="Price"
            required
            error={fieldError(state, "price")}
          >
            <Input
              id="item-price"
              type="number"
              min={0}
              step="0.01"
              required
              className="sm:max-w-40"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              aria-invalid={fieldError(state, "price") !== undefined}
            />
          </Field>
        </div>

        <Field
          htmlFor="item-description"
          label="Description"
          hint="Shown to guests under the name. Leave it empty if the name says enough."
          error={fieldError(state, "description")}
        >
          <Textarea
            id="item-description"
            rows={3}
            maxLength={600}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            aria-describedby={describedBy("item-description", { hasHint: true })}
          />
        </Field>

        <Field
          htmlFor="item-category"
          label="Section"
          required
          hint="Moving an item between sections changes where guests find it, not its history."
        >
          <Select
            id="item-category"
            className="sm:max-w-80"
            value={categoryId}
            onChange={setCategoryId}
            aria-describedby={describedBy("item-category", { hasHint: true })}
            options={categories.map((category) => ({
              value: category.id,
              label: category.isActive
                ? category.name
                : `${category.name} (off the menu)`,
            }))}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button
            type="submit"
            disabled={state.status === "busy" || !isDirty || name.trim() === ""}
          >
            {state.status === "busy" ? "Saving…" : "Save changes"}
          </Button>

          {isDirty && (
            <Button
              type="button"
              variant="ghost"
              disabled={state.status === "busy"}
              onClick={() => {
                setName(item.name);
                setDescription(item.description ?? "");
                setPrice(String(item.price));
                setCategoryId(item.categoryId);
                setState(idle);
              }}
            >
              Discard
            </Button>
          )}

          <Notice state={state} />
        </div>
      </form>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* Photograph                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The picture a guest sees.
 *
 * Given a whole panel and shown at the size it will actually appear, because this is
 * the one image in the product somebody decides to buy from. A thumbnail in a table
 * row would not tell a manager whether the photograph is any good.
 */
function PhotoPanel({
  item,
  onChanged,
}: {
  item: MenuItem;
  onChanged: (next: MenuItem) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<PanelState>(idle);

  async function upload(file: File) {
    // Checked here as well as by the server, so the common mistake - a photograph
    // straight off a phone - is answered instantly rather than after a megabyte has
    // gone up the wire to be refused.
    if (file.size > MENU_IMAGE.maxBytes) {
      setState({
        status: "error",
        message: `That picture is ${(file.size / 1024 / 1024).toFixed(
          1,
        )} MB. The limit is ${MENU_IMAGE.maxBytes / 1024 / 1024} MB.`,
        fieldErrors: {},
      });
      return;
    }

    setState({ status: "busy" });

    try {
      onChanged(await setItemImage(item.id, file));
      setState({ status: "done", message: "Picture saved." });
    } catch (caught) {
      setState(failure(caught, "Could not upload that picture."));
    }
  }

  async function remove() {
    setState({ status: "busy" });

    try {
      onChanged(await removeItemImage(item.id));
      setState(idle);
    } catch (caught) {
      setState(failure(caught, "Could not remove the picture."));
    }
  }

  return (
    <Surface>
      <SurfaceHeader title="Picture" description="What guests see when they scan" />

      <div className="flex flex-col gap-4 p-4">
        {state.status === "error" && <FormError message={state.message} />}

        {item.imageUrl === null ? (
          <div className="flex aspect-4/3 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border-strong bg-surface-2 text-center">
            <Utensils className="size-6 text-subtle" aria-hidden="true" />
            <p className="max-w-[18rem] px-4 text-sm text-muted">
              No picture. Guests ordering from their phone see the name and the price
              only.
            </p>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={apiAssetSrc(item.imageUrl)}
            alt={item.name}
            className="aspect-4/3 w-full rounded-md border border-border object-cover"
          />
        )}

        {/* Hidden and driven by the button: a bare file input cannot be styled to
            match anything else here, and its "no file chosen" text says nothing once
            a picture is already showing above it. */}
        <input
          ref={inputRef}
          type="file"
          accept={MENU_IMAGE.accept}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];

            // Cleared so choosing the same file twice still fires a change, which is
            // what somebody does straight after a failed upload.
            event.target.value = "";

            if (file !== undefined) {
              void upload(file);
            }
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<ImagePlus />}
            disabled={state.status === "busy"}
            onClick={() => inputRef.current?.click()}
          >
            {state.status === "busy"
              ? "Uploading…"
              : item.imageUrl === null
                ? "Add a picture"
                : "Replace"}
          </Button>

          {item.imageUrl !== null && (
            <Button
              variant="ghost"
              size="sm"
              disabled={state.status === "busy"}
              onClick={() => void remove()}
            >
              Remove
            </Button>
          )}

          <Notice state={state} />
        </div>

        <p className="text-2xs text-subtle">
          JPEG, PNG, WebP or AVIF, up to {MENU_IMAGE.maxBytes / 1024 / 1024} MB. Shown
          cropped to a landscape rectangle, so keep the dish in the middle.
        </p>
      </div>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* Availability                                                               */
/* -------------------------------------------------------------------------- */

function AvailabilityPanel({
  item,
  onChanged,
}: {
  item: MenuItem;
  onChanged: (next: MenuItem) => void;
}) {
  const [state, setState] = useState<PanelState>(idle);

  async function toggle() {
    setState({ status: "busy" });

    try {
      onChanged(await setItemActive(item.id, !item.isActive));
      setState(idle);
    } catch (caught) {
      setState(failure(caught, "Could not change this."));
    }
  }

  return (
    <Surface>
      <SurfaceHeader
        title="On the menu"
        actions={<AvailabilityBadge item={item} />}
      />

      <div className="flex flex-col gap-4 p-4">
        {state.status === "error" && <FormError message={state.message} />}

        <p className="text-sm text-muted">
          {item.isActive
            ? "Guests can order this, and a waiter can put it on a bill. Taking it off keeps the item and everything it has ever sold."
            : "This is off the menu. Nobody can order it, and it is kept with all of its history."}
        </p>

        {/* Two reasons an item can be unorderable, and only one of them is fixable
            here. Saying so stops a manager toggling this switch and wondering why
            nothing changed. */}
        {item.isActive && !item.isCategoryActive && (
          <p className="rounded-md border border-warning-border bg-warning-soft px-2.5 py-2 text-sm text-warning">
            This item is on, but {item.categoryName} is off the menu, so guests still
            cannot order it. Turn the section back on from the menu screen.
          </p>
        )}

        <Button
          variant={item.isActive ? "secondary" : "primary"}
          size="sm"
          className="self-start"
          disabled={state.status === "busy"}
          onClick={() => void toggle()}
        >
          {state.status === "busy"
            ? "Saving…"
            : item.isActive
              ? "Take off the menu"
              : "Put on the menu"}
        </Button>
      </div>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* Recipe                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * What the dish is made from.
 *
 * Beside the item rather than on the inventory screen, because a manager thinks of a
 * recipe while looking at the dish. The editor itself stays a dialog: it is a list of
 * rows being added and removed, which is one task rather than four.
 */
function RecipePanel({ item }: { item: MenuItem }) {
  const [savedAt, setSavedAt] = useState(0);

  return (
    <Surface>
      <SurfaceHeader
        title="Made from"
        description="Stock taken off the shelves when this is cooked"
        actions={
          <RecipeDialog
            key={savedAt}
            menuItemId={item.id}
            menuItemName={item.name}
            onSaved={() => setSavedAt(Date.now())}
          />
        }
      />

      <dl className="divide-y divide-border">
        <DetailRow label="Section">{item.categoryName}</DetailRow>
        <DetailRow label="Item id" mono>
          {item.id}
        </DetailRow>
      </dl>

      <p className="border-t border-border px-4 py-3 text-xs text-muted">
        An item with no recipe deducts nothing when it is cooked. That is a valid
        answer for a bought-in drink, and a gap for anything the kitchen makes.
      </p>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* Removal                                                                    */
/* -------------------------------------------------------------------------- */

function RemovePanel({
  item,
  onDeleted,
}: {
  item: MenuItem;
  onDeleted: () => void;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [state, setState] = useState<PanelState>(idle);

  async function handleDelete() {
    setState({ status: "busy" });

    try {
      await deleteItem(item.id);
      onDeleted();
    } catch (caught) {
      // Usually because an order names it. The message says so, and taking it off
      // the menu is the answer.
      setState(failure(caught, "Could not delete this item."));
      setIsConfirming(false);
    }
  }

  return (
    <Surface className="border-danger-border">
      <SurfaceHeader title="Remove" className="border-danger-border" />

      <div className="flex flex-col gap-4 p-4">
        {state.status === "error" && <FormError message={state.message} />}

        <p className="text-sm text-muted">
          Deleting is only for an item added by mistake. Once an order has named it the
          request is refused, because a bill has to keep meaning what it said. Take it
          off the menu instead for something you have genuinely stopped selling.
        </p>

        {isConfirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="danger"
              size="sm"
              disabled={state.status === "busy"}
              onClick={() => void handleDelete()}
            >
              {state.status === "busy" ? "Deleting…" : `Yes, delete ${item.name}`}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={state.status === "busy"}
              onClick={() => setIsConfirming(false)}
            >
              Keep it
            </Button>
          </div>
        ) : (
          <Button
            variant="danger"
            size="sm"
            className="self-start"
            icon={<Trash2 />}
            onClick={() => setIsConfirming(true)}
          >
            Delete item
          </Button>
        )}
      </div>
    </Surface>
  );
}
