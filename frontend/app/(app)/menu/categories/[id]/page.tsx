"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ImagePlus, Tags, Trash2 } from "lucide-react";
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
import { DetailRow, Surface, SurfaceHeader } from "@/components/ui/surface";
import { ErrorState, FormError, Spinner } from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import {
  deleteCategory,
  getCategory,
  removeCategoryImage,
  setCategoryActive,
  setCategoryImage,
  updateCategory,
} from "@/features/menu/api";
import { apiAssetSrc } from "@/lib/api/asset-url";
import { MENU_IMAGE } from "@/types/menu";
import type { MenuCategory } from "@/types/menu";

/**
 * One section of the menu.
 *
 * The same shape as the dish page beside it, and for the same reasons: renaming a
 * section, photographing it, taking it off the menu and deleting it are unrelated
 * jobs that a dialog turned into one scrolling column.
 *
 * A section carries more weight than its own row suggests. Switching it off takes
 * every dish in it off the menu at once, so that control gets a panel that says how
 * many, rather than a toggle in a table.
 */
export default function MenuCategoryPage() {
  return (
    <RequireAuth roles={["RestaurantManager"]}>
      <MenuCategoryView />
    </RequireAuth>
  );
}

function MenuCategoryView() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [category, setCategory] = useState<MenuCategory | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await getCategory(id);

        if (!cancelled) {
          setCategory(loaded);
          setLoadError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setLoadError(
            caught instanceof Error ? caught.message : "Unable to load this section.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const apply = useCallback((next: MenuCategory) => setCategory(next), []);

  return (
    <>
      <PageHeader
        title={category?.name ?? "Menu section"}
        description={
          category === null
            ? undefined
            : `${category.itemCount} ${category.itemCount === 1 ? "item" : "items"}, ${
                category.activeItemCount
              } on the menu`
        }
        crumbs={[
          { label: "Workspace", href: "/dashboard" },
          { label: "Menu", href: "/menu" },
          { label: category?.name ?? "Section" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {category !== null &&
              (category.isActive ? (
                <Badge tone="success" dot>
                  On the menu
                </Badge>
              ) : (
                <Badge tone="neutral" dot>
                  Off the menu
                </Badge>
              ))}
            <LinkButton href="/menu" variant="secondary" icon={<ArrowLeft />}>
              All sections
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

        {category === null && loadError === null && (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        )}

        {category !== null && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(22rem,1fr)]">
            <div className="flex flex-col gap-5">
              <DetailsPanel category={category} onSaved={apply} />
              <ContentsPanel category={category} />
            </div>

            <div className="flex flex-col gap-5">
              <PhotoPanel category={category} onChanged={apply} />
              <AvailabilityPanel category={category} onChanged={apply} />
              <RemovePanel
                category={category}
                onDeleted={() => router.replace("/menu")}
              />
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Details                                                                    */
/* -------------------------------------------------------------------------- */

function DetailsPanel({
  category,
  onSaved,
}: {
  category: MenuCategory;
  onSaved: (next: MenuCategory) => void;
}) {
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description ?? "");
  const [displayOrder, setDisplayOrder] = useState(String(category.displayOrder));
  const [state, setState] = useState<PanelState>(idle);

  const isDirty =
    name !== category.name ||
    description !== (category.description ?? "") ||
    displayOrder !== String(category.displayOrder);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setState({ status: "busy" });

    try {
      onSaved(
        await updateCategory(category.id, {
          name: name.trim(),
          description: description.trim() === "" ? null : description.trim(),
          displayOrder: Number(displayOrder),
        }),
      );
      setState({ status: "done", message: "Saved." });
    } catch (caught) {
      setState(failure(caught, "Could not save this section."));
    }
  }

  return (
    <Surface>
      <SurfaceHeader
        title="Details"
        description="What the section is called, and where it sits on the menu"
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
        {state.status === "error" && <FormError message={state.message} />}

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <Field
            htmlFor="category-name"
            label="Name"
            required
            error={fieldError(state, "name")}
          >
            <Input
              id="category-name"
              required
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={fieldError(state, "name") !== undefined}
            />
          </Field>

          <Field
            htmlFor="category-order"
            label="Position"
            hint="Lower comes first."
            error={fieldError(state, "displayOrder")}
          >
            <Input
              id="category-order"
              type="number"
              min={0}
              value={displayOrder}
              onChange={(event) => setDisplayOrder(event.target.value)}
              aria-describedby={describedBy("category-order", { hasHint: true })}
            />
          </Field>
        </div>

        <Field
          htmlFor="category-description"
          label="Description"
          hint="A note about what belongs in here. For you, not for guests."
          error={fieldError(state, "description")}
        >
          <Textarea
            id="category-description"
            rows={3}
            maxLength={400}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            aria-describedby={describedBy("category-description", { hasHint: true })}
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
                setName(category.name);
                setDescription(category.description ?? "");
                setDisplayOrder(String(category.displayOrder));
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
 * The picture heading the section on a guest's phone.
 *
 * Shown here at the shape it is actually drawn in - a wide band with the name laid
 * over the bottom - because a photograph that works as a square thumbnail can be
 * useless once it is cropped to a letterbox and half of it is behind text.
 */
function PhotoPanel({
  category,
  onChanged,
}: {
  category: MenuCategory;
  onChanged: (next: MenuCategory) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<PanelState>(idle);

  async function upload(file: File) {
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
      onChanged(await setCategoryImage(category.id, file));
      setState({ status: "done", message: "Picture saved." });
    } catch (caught) {
      setState(failure(caught, "Could not upload that picture."));
    }
  }

  async function remove() {
    setState({ status: "busy" });

    try {
      onChanged(await removeCategoryImage(category.id));
      setState(idle);
    } catch (caught) {
      setState(failure(caught, "Could not remove the picture."));
    }
  }

  return (
    <Surface>
      <SurfaceHeader title="Picture" description="Heads the section when guests scan" />

      <div className="flex flex-col gap-4 p-4">
        {state.status === "error" && <FormError message={state.message} />}

        {category.imageUrl === null ? (
          <div className="flex h-28 flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border-strong bg-surface-2 px-4 text-center">
            <Tags className="size-5 text-subtle" aria-hidden="true" />
            <p className="text-sm text-muted">
              No picture. The section shows as a plain heading.
            </p>
          </div>
        ) : (
          // The same band the guest sees, name and all, so what is being judged here
          // is the thing they will actually get.
          <div className="relative isolate flex h-28 items-end overflow-hidden rounded-md border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={apiAssetSrc(category.imageUrl)}
              alt={category.name}
              className="absolute inset-0 -z-10 size-full object-cover"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 to-black/10"
            />
            <p className="px-4 py-2.5 text-base font-semibold text-white">
              {category.name}
            </p>
          </div>
        )}

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
              : category.imageUrl === null
                ? "Add a picture"
                : "Replace"}
          </Button>

          {category.imageUrl !== null && (
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
          JPEG, PNG, WebP or AVIF, up to {MENU_IMAGE.maxBytes / 1024 / 1024} MB. Cropped
          to a wide band with the name over the bottom, so keep that corner clear.
        </p>
      </div>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* Availability                                                               */
/* -------------------------------------------------------------------------- */

function AvailabilityPanel({
  category,
  onChanged,
}: {
  category: MenuCategory;
  onChanged: (next: MenuCategory) => void;
}) {
  const [state, setState] = useState<PanelState>(idle);

  async function toggle() {
    setState({ status: "busy" });

    try {
      onChanged(await setCategoryActive(category.id, !category.isActive));
      setState(idle);
    } catch (caught) {
      setState(failure(caught, "Could not change this."));
    }
  }

  return (
    <Surface>
      <SurfaceHeader
        title="On the menu"
        actions={
          category.isActive ? (
            <Badge tone="success" dot>
              On
            </Badge>
          ) : (
            <Badge tone="neutral" dot>
              Off
            </Badge>
          )
        }
      />

      <div className="flex flex-col gap-4 p-4">
        {state.status === "error" && <FormError message={state.message} />}

        {/* The number is the point. Switching a section off is the widest-reaching
            control on the menu screen, and doing it without being told how many
            dishes go with it is how a whole course quietly disappears. */}
        <p className="text-sm text-muted">
          {category.isActive
            ? category.activeItemCount === 0
              ? "Nothing in this section is on the menu, so turning it off changes nothing a guest can see."
              : `Turning this off takes ${category.activeItemCount} ${
                  category.activeItemCount === 1 ? "dish" : "dishes"
                } off the menu at once. Each one keeps its own switch, so they come back as they were.`
            : "This whole section is hidden from guests, whatever the items inside it say."}
        </p>

        <Button
          variant={category.isActive ? "secondary" : "primary"}
          size="sm"
          className="self-start"
          disabled={state.status === "busy"}
          onClick={() => void toggle()}
        >
          {state.status === "busy"
            ? "Saving…"
            : category.isActive
              ? "Take off the menu"
              : "Put on the menu"}
        </Button>
      </div>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* Contents                                                                   */
/* -------------------------------------------------------------------------- */

function ContentsPanel({ category }: { category: MenuCategory }) {
  return (
    <Surface>
      <SurfaceHeader
        title="What is in it"
        actions={
          <LinkButton href="/menu" variant="secondary" size="sm">
            Open the menu
          </LinkButton>
        }
      />

      <dl className="divide-y divide-border">
        <DetailRow label="Items">
          <span className="tabular">{category.itemCount}</span>
        </DetailRow>
        <DetailRow label="On the menu">
          <span className="tabular">{category.activeItemCount}</span>
        </DetailRow>
        <DetailRow label="Section id" mono>
          {category.id}
        </DetailRow>
      </dl>

      <p className="border-t border-border px-4 py-3 text-xs text-muted">
        Dishes are added and edited from the{" "}
        <Link href="/menu" className="text-primary hover:underline">
          menu screen
        </Link>
        , where they can be filtered to this section.
      </p>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* Removal                                                                    */
/* -------------------------------------------------------------------------- */

function RemovePanel({
  category,
  onDeleted,
}: {
  category: MenuCategory;
  onDeleted: () => void;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [state, setState] = useState<PanelState>(idle);

  const isEmpty = category.itemCount === 0;

  async function handleDelete() {
    setState({ status: "busy" });

    try {
      await deleteCategory(category.id);
      onDeleted();
    } catch (caught) {
      setState(failure(caught, "Could not delete this section."));
      setIsConfirming(false);
    }
  }

  return (
    <Surface className={isEmpty ? "border-danger-border" : undefined}>
      <SurfaceHeader
        title="Remove"
        className={isEmpty ? "border-danger-border" : undefined}
      />

      <div className="flex flex-col gap-4 p-4">
        {state.status === "error" && <FormError message={state.message} />}

        {isEmpty ? (
          <>
            <p className="text-sm text-muted">
              Nothing is in this section, so it can be deleted outright.
            </p>

            {isConfirming ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  disabled={state.status === "busy"}
                  onClick={() => void handleDelete()}
                >
                  {state.status === "busy"
                    ? "Deleting…"
                    : `Yes, delete ${category.name}`}
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
                Delete section
              </Button>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">
            This section holds{" "}
            <span className="font-medium text-text tabular">{category.itemCount}</span>{" "}
            {category.itemCount === 1 ? "item" : "items"}, so it cannot be deleted —
            those dishes would be left with nowhere to sit. Move them to another
            section first, or take this one off the menu instead, which hides it and
            keeps everything.
          </p>
        )}
      </div>
    </Surface>
  );
}
