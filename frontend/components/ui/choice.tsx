"use client";

import { useRef } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * A small set of choices, all visible at once.
 *
 * For two or three options a dropdown is the wrong control. It costs two clicks to
 * change something and one to find out what the alternatives even are, and it hides
 * behind a summary the very thing the form is asking about. Laid out flat, the whole
 * question and all of its answers are readable without touching anything, and
 * choosing is a single press.
 *
 * The rule of thumb: up to four short options belong here, and a longer or unbounded
 * list belongs in `select.tsx`. Twenty ingredients laid flat would be worse than a
 * dropdown, which is the case that component exists for.
 *
 * A real radio group rather than a row of buttons. That is what makes the arrow keys
 * move between options and Tab skip the group as one stop, which is what somebody
 * filling in a form with the keyboard expects; a row of ordinary buttons makes every
 * option its own tab stop and answers no arrow key at all.
 */

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
}

export function Choice<T extends string>({
  id,
  label,
  value,
  onChange,
  options,
  disabled = false,
  className,
}: {
  /** Matches the `htmlFor` of the Field around it. */
  id?: string;
  /**
   * What is being chosen.
   *
   * Announced on the group itself. A `label` element cannot be tied to a radio group
   * the way it is to an input, so the Field above supplies the visible text and this
   * supplies the same words to a screen reader.
   */
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly ChoiceOption<T>[];
  disabled?: boolean;
  className?: string;
}) {
  const groupRef = useRef<HTMLDivElement>(null);

  const selected = options.findIndex((option) => option.value === value);

  function move(direction: 1 | -1) {
    if (options.length === 0) {
      return;
    }

    // Wraps, which is what a radio group does: there is no first or last when the
    // set is this small, only the next one round.
    const from = selected === -1 ? 0 : selected;
    const next = (from + direction + options.length) % options.length;
    const option = options[next];

    if (option === undefined) {
      return;
    }

    onChange(option.value);

    // Focus follows selection in a radio group, so the arrow keys keep working from
    // wherever they have landed.
    groupRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [next]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        move(1);
        return;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        return;
      default:
    }
  }

  return (
    <div
      ref={groupRef}
      id={id}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "flex flex-wrap gap-1 rounded-md border border-border-strong bg-surface-2 p-1",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      {options.map((option, index) => {
        const isSelected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            // One tab stop for the whole group, landing on the chosen option. The
            // arrow keys do the rest.
            tabIndex={isSelected || (selected === -1 && index === 0) ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex min-w-fit flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5",
              "text-sm transition-colors disabled:pointer-events-none",
              isSelected
                ? "bg-surface font-medium text-text shadow-sm"
                : "text-muted hover:text-text",
            )}
          >
            <Check
              aria-hidden="true"
              className={cn(
                "size-3.5 shrink-0",
                isSelected ? "text-primary" : "text-transparent",
              )}
            />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
