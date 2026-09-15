"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field as FieldRow } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  PHOTO_GROUND,
  photoUrl,
  PHOTO_TONES,
  type PhotoTone,
} from "@/features/website/photos";
import { cn } from "@/lib/utils/cn";
import type { DesignId } from "@/features/website/designs";
import type { SampleContent } from "@/features/website/sample-content";
import { scrollToSection } from "./editable";
import { readAt, type ContentPath } from "./draft";
import { destinationsFor, type EditableSection, type Field } from "./sections";

/**
 * The fields for one section, beside the page rather than over it.
 *
 * A panel, not a dialog, and that decision is the whole editor. A manager changing a
 * headline is watching the headline change; a modal would cover the one thing they
 * are looking at, and they would be typing at a preview they cannot see. The page is
 * given a margin while this is open, so nothing they are editing is ever behind it.
 *
 * NO SAVE BUTTON, AND NO APPLY
 *
 * Every keystroke reaches the page and the draft together. An editor with an Apply
 * button asks somebody to hold a change in their head between typing it and seeing
 * it, which is exactly the work a live preview exists to remove. What the panel does
 * carry is the truth about where the work is kept — on this device, until publishing
 * is built.
 */
export function EditorPanel({
  design,
  section,
  sections,
  content,
  onPatch,
  onClose,
}: {
  design: DesignId;
  section: EditableSection;
  /** Every section of this design, so the panel can say where in the page you are. */
  sections: EditableSection[];
  content: SampleContent;
  onPatch: (path: ContentPath, value: unknown) => void;
  onClose: () => void;
}) {
  const index = sections.findIndex((entry) => entry.id === section.id);
  const previous = index > 0 ? sections[index - 1] : undefined;
  const next = index >= 0 && index < sections.length - 1 ? sections[index + 1] : undefined;

  return (
    <aside
      aria-label={`Edit ${section.label.toLowerCase()}`}
      className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-surface shadow-lg sm:w-[24rem]"
    >
      {/* Where in the page this is, and the way to the next one.

          The panel follows the scroll, so a manager who wants the next section can
          simply keep scrolling. These are for the other half of the job: working
          through a page deliberately, in order, without having to find each band by
          eye. Pressing one sends the page there and the follow does the rest. */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-2 px-3 py-2">
        <button
          type="button"
          disabled={previous === undefined}
          onClick={() => previous !== undefined && scrollToSection(previous.id)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-2xs font-medium text-muted transition-colors hover:bg-surface-3 hover:text-text disabled:pointer-events-none disabled:opacity-35"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          {previous?.label ?? "Start"}
        </button>

        <span className="tabular shrink-0 text-2xs text-subtle">
          {index + 1} of {sections.length}
        </span>

        <button
          type="button"
          disabled={next === undefined}
          onClick={() => next !== undefined && scrollToSection(next.id)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-2xs font-medium text-muted transition-colors hover:bg-surface-3 hover:text-text disabled:pointer-events-none disabled:opacity-35"
        >
          {next?.label ?? "End"}
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-lg font-semibold text-text">{section.label}</h2>
          <p className="text-xs text-muted">{section.note}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Stop editing"
          className="-mt-0.5 -mr-1 shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-surface-3 hover:text-text"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
        {section.fields.map((field) => (
          <FieldInput
            key={field.path}
            design={design}
            field={field}
            value={readAt(content, field.path)}
            onChange={(value) => onPatch(field.path, value)}
          />
        ))}
      </div>

      <footer className="border-t border-border bg-surface-2 px-4 py-3">
        <p className="text-2xs leading-relaxed text-muted">
          Scroll the page to move through the sections. Changes appear as you type and
          are kept in this browser — nothing is published, and nothing has left this
          device.
        </p>
      </footer>
    </aside>
  );
}

/* -------------------------------------------------------------------------- */
/* Fields                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * One field, chosen by its kind.
 *
 * Every kind takes the same three things — what it is, what it holds, and what to
 * call when it changes — so a list can render its own inner fields through the same
 * component without knowing anything about them.
 */
function FieldInput({
  design,
  field,
  value,
  onChange,
}: {
  design: DesignId;
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const id = `site-${field.path.split(".").join("-")}`;

  if (field.kind === "photo") {
    return <PhotoField field={field} value={value} onChange={onChange} />;
  }

  if (field.kind === "link") {
    return <LinkField design={design} field={field} value={value} onChange={onChange} />;
  }

  if (field.kind === "strings") {
    return <StringsField field={field} value={value} onChange={onChange} />;
  }

  if (field.kind === "list") {
    return <ListField design={design} field={field} value={value} onChange={onChange} />;
  }

  const text = typeof value === "string" ? value : "";
  const over = field.max !== undefined && text.length > field.max;

  return (
    <FieldRow
      htmlFor={id}
      label={field.label}
      hint={field.hint}
      // Shown only once the limit is passed. A counter running from the first
      // character is a rule being enforced; one that appears at the end is a warning.
      error={over ? `${text.length - (field.max ?? 0)} characters too many` : undefined}
    >
      {field.kind === "lines" ? (
        <Textarea
          id={id}
          rows={field.max !== undefined && field.max > 120 ? 4 : 2}
          value={text}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input id={id} value={text} onChange={(event) => onChange(event.target.value)} />
      )}
    </FieldRow>
  );
}

/** Which of the plates. Thumbnails, because nobody picks a photograph by its name. */
function PhotoField({
  field,
  value,
  onChange,
}: {
  field: Extract<Field, { kind: "photo" }>;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-text">{field.label}</legend>
      {field.hint !== undefined && <p className="text-xs text-muted">{field.hint}</p>}

      <div className="mt-1 grid grid-cols-4 gap-2">
        {PHOTO_TONES.map((tone) => (
          <button
            key={tone}
            type="button"
            onClick={() => onChange(tone)}
            aria-pressed={value === tone}
            aria-label={tone}
            className={cn(
              "relative aspect-square overflow-hidden rounded-md border-2 transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              value === tone
                ? "border-primary"
                : "border-transparent hover:border-border-strong",
            )}
            style={{
              backgroundImage: PHOTO_GROUND[tone as PhotoTone],
              backgroundSize: "cover",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl(tone, 160, 160)}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 block h-full w-full object-cover"
            />
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Where a button goes.
 *
 * A list of this page's own sections rather than a box to type a URL into. A manager
 * typing an address will eventually type one that stops working, and there is no
 * version of this page where that is worth allowing for the sake of it.
 */
function LinkField({
  design,
  field,
  value,
  onChange,
}: {
  design: DesignId;
  field: Extract<Field, { kind: "link" }>;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const options = destinationsFor(design);

  return (
    <FieldRow htmlFor={`site-${field.path}`} label={field.label} hint={field.hint}>
      <Select
        id={`site-${field.path}`}
        value={typeof value === "string" ? value : ""}
        onChange={onChange}
        options={options.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
      />
    </FieldRow>
  );
}

/** A list of plain lines: accolades, the paragraphs of a story. */
function StringsField({
  field,
  value,
  onChange,
}: {
  field: Extract<Field, { kind: "strings" }>;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const items = Array.isArray(value) ? (value as string[]) : [];
  const full = field.max !== undefined && items.length >= field.max;

  const replace = (index: number, next: string) =>
    onChange(items.map((item, at) => (at === index ? next : item)));

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-text">{field.label}</legend>
      {field.hint !== undefined && <p className="text-xs text-muted">{field.hint}</p>}

      <ul className="mt-1 flex flex-col gap-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-1.5">
            {field.long === true ? (
              <Textarea
                rows={3}
                aria-label={`${field.itemLabel} ${index + 1}`}
                value={item}
                onChange={(event) => replace(index, event.target.value)}
              />
            ) : (
              <Input
                aria-label={`${field.itemLabel} ${index + 1}`}
                value={item}
                onChange={(event) => replace(index, event.target.value)}
              />
            )}

            <RowButtons
              index={index}
              count={items.length}
              onMove={(to) => onChange(moved(items, index, to))}
              onRemove={() => onChange(items.filter((_, at) => at !== index))}
            />
          </li>
        ))}
      </ul>

      <AddButton
        label={field.itemLabel}
        disabled={full}
        onClick={() => onChange([...items, ""])}
      />
    </fieldset>
  );
}

/**
 * A list of records: dishes, quotations, opening hours.
 *
 * Each row is a small panel of its own fields, rendered through the same component
 * that renders a top-level field — so a dish's photograph picker is the hero's
 * photograph picker, and there is one of each in the codebase rather than two.
 *
 * Order is part of the content here. These lists are drawn top to bottom on the page,
 * so moving a dish up is editing the page, not sorting a table.
 */
function ListField({
  design,
  field,
  value,
  onChange,
}: {
  design: DesignId;
  field: Extract<Field, { kind: "list" }>;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  const full = field.max !== undefined && items.length >= field.max;

  const replace = (index: number, key: string, next: unknown) =>
    onChange(
      items.map((item, at) => (at === index ? { ...item, [key]: next } : item)),
    );

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-text">{field.label}</legend>
      {field.hint !== undefined && <p className="text-xs text-muted">{field.hint}</p>}

      <ul className="mt-1 flex flex-col gap-3">
        {items.map((item, index) => {
          const title = item[field.titleKey];

          return (
            <li
              key={index}
              className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2 p-3"
            >
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-text">
                  {typeof title === "string" && title.trim() !== ""
                    ? title
                    : `${field.itemLabel} ${index + 1}`}
                </span>

                <RowButtons
                  index={index}
                  count={items.length}
                  onMove={(to) => onChange(moved(items, index, to))}
                  onRemove={() => onChange(items.filter((_, at) => at !== index))}
                />
              </div>

              {field.fields.map((inner) => (
                <FieldInput
                  key={inner.path}
                  design={design}
                  field={inner}
                  value={item[inner.path]}
                  onChange={(next) => replace(index, inner.path, next)}
                />
              ))}
            </li>
          );
        })}
      </ul>

      <AddButton
        label={field.itemLabel}
        disabled={full}
        onClick={() => onChange([...items, { ...field.blank }])}
      />
    </fieldset>
  );
}

/* -------------------------------------------------------------------------- */
/* Row controls                                                               */
/* -------------------------------------------------------------------------- */

/** Move up, move down, remove. The same three on every list in the panel. */
function RowButtons({
  index,
  count,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      <IconButton
        label="Move up"
        disabled={index === 0}
        onClick={() => onMove(index - 1)}
      >
        <ChevronUp className="size-3.5" aria-hidden="true" />
      </IconButton>
      <IconButton
        label="Move down"
        disabled={index === count - 1}
        onClick={() => onMove(index + 1)}
      >
        <ChevronDown className="size-3.5" aria-hidden="true" />
      </IconButton>
      <IconButton label="Remove" onClick={onRemove} tone="danger">
        <Trash2 className="size-3.5" aria-hidden="true" />
      </IconButton>
    </span>
  );
}

function IconButton({
  label,
  disabled = false,
  tone = "neutral",
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  tone?: "neutral" | "danger";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-md p-1.5 transition-colors disabled:pointer-events-none disabled:opacity-35",
        tone === "danger"
          ? "text-muted hover:bg-danger-soft hover:text-danger"
          : "text-muted hover:bg-surface-3 hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

function AddButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      icon={<Plus />}
      disabled={disabled}
      onClick={onClick}
      className="mt-1 self-start"
    >
      Add {label.toLowerCase()}
    </Button>
  );
}

/** The same list with one item moved, or unchanged if the move goes off either end. */
function moved<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) {
    return items;
  }

  const next = [...items];
  const [lifted] = next.splice(from, 1);

  if (lifted !== undefined) {
    next.splice(to, 0, lifted);
  }

  return next;
}
