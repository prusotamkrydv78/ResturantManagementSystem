"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Marks a part of a restaurant page as something a manager can change.
 *
 * WHY A CONTEXT RATHER THAN A PROP
 *
 * The templates are ordinary page components, and they should stay that way: every
 * band of Aurora would otherwise have to take an `editing` flag and hand it down, and
 * the design files would fill up with editor plumbing that has nothing to do with how
 * a restaurant page looks. A context means a template's only concession to the editor
 * is one wrapper around each section, and outside the editor that wrapper renders its
 * children and nothing else.
 *
 * WHY THE PANEL FOLLOWS THE PAGE
 *
 * Editing used to mean finding a section, moving the pointer to a small button and
 * clicking it — a hunt, repeated ten times, for something the manager was already
 * looking at. Each section now reports when it is the one on screen, and the panel
 * shows that section's fields. Scrolling the page is how you move through the editor,
 * which is the same gesture as reading it.
 */

interface EditorState {
  /** Whether the page is being edited at all. */
  isEditing: boolean;
  /** Which section's fields are open, if any. */
  openSection: string | null;
  /** Ask for a section directly. Still offered: the button is the discoverable half. */
  open: (id: string) => void;
  /** Reported by a section when it becomes the one being read. */
  sight: (id: string) => void;
}

const EditorContext = createContext<EditorState>({
  isEditing: false,
  openSection: null,
  open: () => {},
  sight: () => {},
});

export function EditorProvider({
  value,
  children,
}: {
  value: EditorState;
  children: React.ReactNode;
}) {
  return <EditorContext value={value}>{children}</EditorContext>;
}

export function useEditor(): EditorState {
  return useContext(EditorContext);
}

/** Where a section is in the document, so the panel can send the page to it. */
export const SECTION_ATTRIBUTE = "data-site-section";

/**
 * One editable region of a page.
 *
 * Renders a bare fragment when nobody is editing, so a published page carries no
 * wrapper, no outline, no observer and no click handler — the editor leaves no trace
 * on the thing it edits.
 */
export function Editable({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  const { isEditing, openSection, open, sight } = useEditor();

  if (!isEditing) {
    return children;
  }

  return (
    <Watched id={id} label={label} isOpen={openSection === id} open={open} sight={sight}>
      {children}
    </Watched>
  );
}

/**
 * The same region, once somebody is editing.
 *
 * Split into its own component so the observer's effect only ever exists in edit
 * mode. Hooks cannot be called conditionally, and a page that is merely being looked
 * at should not be running ten intersection observers.
 */
function Watched({
  id,
  label,
  isOpen,
  open,
  sight,
  children,
}: {
  id: string;
  label: string;
  isOpen: boolean;
  open: (id: string) => void;
  sight: (id: string) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;

    if (node === null) {
      return;
    }

    // The middle fifth of the window. A section counts as the one being read when it
    // is genuinely in front of the reader, not when its top edge crosses the fold —
    // which on bands this tall would hand over to the next one far too early.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          sight(id);
        }
      },
      { rootMargin: "-40% 0px -40% 0px" },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [id, sight]);

  return (
    <div
      ref={ref}
      {...{ [SECTION_ATTRIBUTE]: id }}
      className={cn(
        "group/editable relative",
        // Inset rather than an outline on the edge: these sections run to the edge of
        // the window, and half a ring painted off-screen reads as a broken border.
        "after:pointer-events-none after:absolute after:inset-2 after:rounded-xl after:transition-colors",
        isOpen
          ? "after:ring-2 after:ring-[#2563eb]"
          : "after:ring-1 after:ring-transparent hover:after:ring-2 hover:after:ring-[#2563eb]/50",
      )}
    >
      {children}

      {/* Still a button, even though scrolling now opens sections on its own. It is
          what makes an editable region look editable, and it is the way back when the
          panel has deliberately stopped following — see the focus guard on the page. */}
      <button
        type="button"
        onClick={() => open(id)}
        className={cn(
          "absolute top-5 left-5 z-40 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5",
          "text-xs font-semibold shadow-lg transition-all",
          "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
          isOpen
            ? "bg-[#2563eb] text-white"
            : "bg-white/95 text-[#1a1a1a] opacity-0 group-hover/editable:opacity-100 focus-visible:opacity-100",
        )}
      >
        <Pencil className="size-3" aria-hidden="true" />
        {isOpen ? label : `Edit ${label.toLowerCase()}`}
      </button>
    </div>
  );
}

/** Sends the page to a section, for the panel's step-through. */
export function scrollToSection(id: string): void {
  document
    .querySelector(`[${SECTION_ATTRIBUTE}="${id}"]`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}
