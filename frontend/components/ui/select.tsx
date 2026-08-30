"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { controlClasses } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

/**
 * The dropdown used everywhere in the product.
 *
 * A native `select` styles its closed box and nothing else: the list that opens is
 * drawn by the operating system, so on a dark page it opened as a strip of white
 * with a blue highlight. Nothing in CSS reaches it. The only way to have a list
 * that matches the product is to draw it, which is what this does.
 *
 * Built rather than pulled in, for the same reason as the tooltip beside it: what
 * is needed is one placement and one selection model, and a select library is
 * mostly the cases this product does not have — multiple selection, tags, remote
 * search, grouped headings.
 *
 * Three things it does not do the naive way:
 *
 * The list is portalled to the body and positioned fixed, from the trigger's
 * measured rectangle. Half the callers sit inside a dialog or a table that scrolls
 * sideways, and an absolutely positioned list inside those is clipped at exactly
 * the edge it needs to cross. It also flips above the trigger when the space below
 * would not hold it.
 *
 * Focus stays on the trigger the whole time, and the highlighted row is published
 * with `aria-activedescendant`. Moving real focus into the list is what makes a
 * custom select fight the focus trap of whatever dialog it opens in.
 *
 * What it does not do is take part in native form validation — a `required` here
 * marks the field for a screen reader, but the browser will not block a submit over
 * it, because the element it would need to focus to complain about is not on the
 * page. Forms with an empty starting value guard their own submit button instead.
 */

export interface SelectOption {
  value: string;
  /** Plain text. This is a row in a list, not a slot for markup. */
  label: string;
  /** Shown, but not choosable. Used where one row is already spoken for. */
  disabled?: boolean;
}

export function Select({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  required = false,
  className,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: {
  /** Matches the `htmlFor` of the Field around it. */
  id?: string;
  value: string;
  /** The chosen value, rather than an event: there is no input element to read. */
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  /** Shown when the value matches no option. Most callers supply their own empty row instead. */
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  /** Sizing for the control. Applied to the box, and the list matches its width. */
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const listId = `${controlId}-listbox`;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [box, setBox] = useState<PopupBox | null>(null);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex === -1 ? undefined : options[selectedIndex];

  const place = useCallback(() => {
    const trigger = triggerRef.current;

    if (trigger === null) {
      return;
    }

    setBox(measure(trigger, options.length));
  }, [options.length]);

  const open = useCallback(() => {
    if (disabled) {
      return;
    }

    place();
    // Opens on the current choice, so the arrow keys carry on from where the value
    // already is rather than from the top of the list.
    setActiveIndex(selectedIndex === -1 ? firstEnabled(options) : selectedIndex);
    setIsOpen(true);
  }, [disabled, options, place, selectedIndex]);

  const close = useCallback(() => {
    setIsOpen(false);
    setActiveIndex(-1);
  }, []);

  const choose = useCallback(
    (index: number) => {
      const option = options[index];

      if (option === undefined || option.disabled === true) {
        return;
      }

      onChange(option.value);
      close();
      triggerRef.current?.focus();
    },
    [close, onChange, options],
  );

  // Measured before paint, so the list never appears at the wrong place first and
  // then jumps to the right one.
  useLayoutEffect(() => {
    if (isOpen) {
      place();
    }
  }, [isOpen, place]);

  // Kept against the trigger while the page moves under it. Repositioned rather
  // than closed, because a dialog that scrolls its own body would otherwise shut
  // the list the moment the list itself was scrolled to.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function onScroll(event: Event) {
      if (listRef.current?.contains(event.target as Node) === true) {
        return;
      }

      place();
    }

    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", place);

    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", place);
    };
  }, [isOpen, place]);

  // Closed on a press anywhere else. Pointerdown rather than click, so pressing
  // another control does not first have to shut this one.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (
        triggerRef.current?.contains(target) === true ||
        listRef.current?.contains(target) === true
      ) {
        return;
      }

      close();
    }

    document.addEventListener("pointerdown", onPointerDown, true);

    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [isOpen, close]);

  // The highlighted row is kept in view as the arrows walk past the visible edge.
  useEffect(() => {
    if (!isOpen || activeIndex < 0) {
      return;
    }

    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [isOpen, activeIndex]);

  function step(from: number, direction: 1 | -1): number {
    for (let index = from + direction; index >= 0 && index < options.length; index += direction) {
      if (options[index]?.disabled !== true) {
        return index;
      }
    }

    return from;
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return;
    }

    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();

        if (!isOpen) {
          open();
          return;
        }

        setActiveIndex((current) =>
          step(
            current === -1 ? (event.key === "ArrowDown" ? -1 : options.length) : current,
            event.key === "ArrowDown" ? 1 : -1,
          ),
        );
        return;
      }

      case "Home":
      case "End": {
        if (!isOpen) {
          return;
        }

        event.preventDefault();
        setActiveIndex(
          event.key === "Home" ? firstEnabled(options) : lastEnabled(options),
        );
        return;
      }

      case "Enter":
      case " ": {
        event.preventDefault();

        if (isOpen) {
          choose(activeIndex);
        } else {
          open();
        }

        return;
      }

      case "Escape": {
        if (isOpen) {
          // Stopped here so a select inside a dialog closes itself rather than the
          // dialog around it. One Escape, one thing closed.
          event.preventDefault();
          event.stopPropagation();
          close();
        }

        return;
      }

      case "Tab": {
        close();
        return;
      }

      default: {
        // Typeahead: the one thing a native select does that people genuinely use.
        if (event.key.length !== 1 || event.altKey || event.ctrlKey || event.metaKey) {
          return;
        }

        const match = findByPrefix(options, event.key, isOpen ? activeIndex : selectedIndex);

        if (match === -1) {
          return;
        }

        event.preventDefault();

        if (isOpen) {
          setActiveIndex(match);
        } else {
          choose(match);
        }
      }
    }
  }

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        id={controlId}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-activedescendant={
          isOpen && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
        }
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={onKeyDown}
        className={cn(
          controlClasses,
          "flex h-9 items-center justify-between gap-2 text-left",
          // The browser outline is left alone. Every other control in the product
          // relies on it, and replacing it here with a border colour would make
          // this the one field a keyboard cannot see itself on.
          isOpen && "border-primary",
        )}
      >
        <span
          className={cn(
            "min-w-0 truncate",
            selected === undefined && "text-subtle",
          )}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-muted transition-transform duration-150",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen &&
        box !== null &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-labelledby={controlId}
            style={{
              position: "fixed",
              top: box.top,
              left: box.left,
              width: box.width,
              maxHeight: box.maxHeight,
            }}
            // pointer-events-auto is load-bearing. A modal dialog sets
            // pointer-events:none on the body to seal off what is behind it, and
            // this list is a child of the body, so without it every dropdown
            // inside a dialog looks right and cannot be clicked.
            className="pointer-events-auto z-[60] overflow-y-auto overscroll-contain rounded-md border border-border-strong bg-surface p-1 shadow-lg"
          >
            {options.length === 0 && (
              <li className="px-2 py-1.5 text-sm text-subtle">Nothing to choose</li>
            )}

            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === activeIndex;

              return (
                <li
                  key={option.value}
                  id={`${listId}-${index}`}
                  role="option"
                  data-index={index}
                  aria-selected={isSelected}
                  aria-disabled={option.disabled === true}
                  // Pointerdown would fire before the button's blur and fight it;
                  // the outside-press handler already ignores presses in here.
                  onClick={() => choose(index)}
                  onMouseMove={() =>
                    option.disabled === true ? undefined : setActiveIndex(index)
                  }
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm",
                    option.disabled === true
                      ? "cursor-not-allowed text-subtle"
                      : isActive
                        ? "bg-primary-soft text-primary"
                        : "text-text",
                  )}
                >
                  <Check
                    aria-hidden="true"
                    className={cn(
                      "size-3.5 shrink-0",
                      isSelected ? "text-primary" : "text-transparent",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Placement                                                                  */
/* -------------------------------------------------------------------------- */

interface PopupBox {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

/** Room to leave between the list and the edge of the window. */
const VIEWPORT_MARGIN = 8;

/** How tall the list is allowed to get before it scrolls instead. */
const MAX_HEIGHT = 288;

/**
 * Where to draw the list.
 *
 * Below the trigger by default, above it when below has less room and above has
 * more. The height is whatever is actually available, capped, so a list opened near
 * the bottom of the window scrolls rather than running off it.
 */
function measure(trigger: HTMLElement, optionCount: number): PopupBox {
  const rect = trigger.getBoundingClientRect();
  const gap = 4;

  const below = window.innerHeight - rect.bottom - gap - VIEWPORT_MARGIN;
  const above = rect.top - gap - VIEWPORT_MARGIN;

  // A rough height for the content, so a short list is not given a tall box and
  // flipped over a trigger it would have fitted under.
  const wanted = Math.min(MAX_HEIGHT, optionCount * 34 + 8);
  const openUp = below < wanted && above > below;

  const maxHeight = Math.max(96, Math.min(MAX_HEIGHT, openUp ? above : below));

  return {
    top: openUp ? rect.top - gap - Math.min(maxHeight, wanted) : rect.bottom + gap,
    left: Math.max(
      VIEWPORT_MARGIN,
      Math.min(rect.left, window.innerWidth - rect.width - VIEWPORT_MARGIN),
    ),
    width: rect.width,
    maxHeight,
  };
}

/* -------------------------------------------------------------------------- */
/* Option walking                                                             */
/* -------------------------------------------------------------------------- */

function firstEnabled(options: readonly SelectOption[]): number {
  return options.findIndex((option) => option.disabled !== true);
}

function lastEnabled(options: readonly SelectOption[]): number {
  for (let index = options.length - 1; index >= 0; index -= 1) {
    if (options[index]?.disabled !== true) {
      return index;
    }
  }

  return -1;
}

/**
 * The next option whose label starts with this letter, wrapping past the end.
 *
 * Single letter rather than an accumulating buffer: the lists here are short and
 * mostly distinct at the first character, and a buffer needs a timer to clear
 * itself that then has to be cancelled on every unmount.
 */
function findByPrefix(
  options: readonly SelectOption[],
  key: string,
  from: number,
): number {
  const needle = key.toLowerCase();
  const start = from === -1 ? 0 : from;

  for (let step = 1; step <= options.length; step += 1) {
    const index = (start + step) % options.length;
    const option = options[index];

    if (option?.disabled !== true && option?.label.toLowerCase().startsWith(needle)) {
      return index;
    }
  }

  return -1;
}
