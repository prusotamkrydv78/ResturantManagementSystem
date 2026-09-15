"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Eye, Globe, Info, LayoutGrid, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { ErrorState, Spinner } from "@/components/ui/states";
import { Surface } from "@/components/ui/surface";
import { NoRestaurantAssigned } from "@/features/restaurants/no-restaurant";
import { getMyRestaurant } from "@/features/restaurants/api";
import { designById, type Design } from "@/features/website/designs";
import { SiteRenderer } from "@/features/website/templates";
import { useSiteDraft } from "@/features/website/editor/draft";
import { EditorProvider } from "@/features/website/editor/editable";
import { EditorPanel } from "@/features/website/editor/panel";
import { sectionOf, sectionsFor } from "@/features/website/editor/sections";
import { isMissingRestaurant } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import type { Restaurant } from "@/types/restaurant";

/**
 * One design, drawn as this restaurant's own page — and edited on it.
 *
 * Outside the application shell on purpose: a website judged inside a sidebar and a
 * settings rail is judged at the wrong width, with somebody else's navigation next to
 * every margin it has.
 *
 * EDITING HAPPENS HERE, NOT SOMEWHERE ELSE
 *
 * There is no separate editor screen and there will not be one. A manager fixing a
 * headline is looking at the headline; sending them to a form and asking them to
 * imagine the result is how the website editor this replaced came to have eighteen
 * sections nobody could navigate. Turning on Edit outlines the parts of the page that
 * can be changed, clicking one opens its fields beside the page, and what they type
 * appears where they are looking.
 *
 * The page keeps a margin while the panel is open, so the thing being edited is never
 * behind the thing editing it.
 */
export default function DesignPreviewPage() {
  const params = useParams();
  const id = typeof params.design === "string" ? params.design : "";
  const design = designById(id);

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missingRestaurant, setMissingRestaurant] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await getMyRestaurant();

        if (cancelled) return;

        setRestaurant(loaded);
        setError(null);
        setMissingRestaurant(false);
      } catch (caught) {
        if (cancelled) return;

        if (isMissingRestaurant(caught)) {
          setMissingRestaurant(true);
        } else {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load your restaurant.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (design === undefined) {
    return (
      <Centred>
        <ErrorState
          title="No such design"
          message="That design is not one of the four on offer."
        />
      </Centred>
    );
  }

  if (missingRestaurant) {
    return (
      <Centred>
        <NoRestaurantAssigned area="Website" />
      </Centred>
    );
  }

  if (error !== null) {
    return (
      <Centred>
        <ErrorState message={error} onRetry={() => setReloadKey((key) => key + 1)} />
      </Centred>
    );
  }

  if (restaurant === null) {
    return (
      <Centred>
        <Spinner label="Drawing your page…" />
      </Centred>
    );
  }

  return <Page design={design} restaurant={restaurant} />;
}

/**
 * How long after a change a scroll report is ignored.
 *
 * Long enough to cover the reflow a keystroke causes, short enough that somebody who
 * stops typing and scrolls is never held up. Anything much larger and the panel feels
 * stuck; much smaller and a growing paragraph can still push the page far enough to
 * hand the panel to the next section.
 */
const QUIET_AFTER_EDIT_MS = 700;

/**
 * The page and its editor.
 *
 * Split from the loader above so the draft is only ever opened once there is a
 * restaurant to key it on — a draft is stored per restaurant, and a hook that ran
 * before the slug arrived would read and write the wrong drawer.
 */
function Page({ design, restaurant }: { design: Design; restaurant: Restaurant }) {
  const draft = useSiteDraft(restaurant.slug);

  const [isEditing, setIsEditing] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);

  /** When the draft last changed, which is the only moment a scroll report is suspect. */
  const typedAt = useRef(0);

  const sections = sectionsFor(design.id);
  const canEdit = sections.length > 0;
  const open = openSection === null ? undefined : sectionOf(design.id, openSection);

  /**
   * Writing a field, and noting when.
   *
   * The timestamp is what the guard below reads. Wrapping the draft's own patch
   * rather than tracking keystrokes on the inputs: a photograph chosen from the
   * picker changes the layout exactly as much as a typed paragraph does, and only
   * this path sees both.
   */
  const patch = useCallback(
    (path: string, value: unknown) => {
      typedAt.current = Date.now();
      draft.patch(path, value);
    },
    [draft],
  );

  /**
   * A section reporting that it is the one on screen.
   *
   * The first version of this ignored every report while focus was anywhere in the
   * panel, which was wrong in the ordinary case: somebody who clicks into a field and
   * then scrolls is scrolling deliberately, and the panel sat on the old section until
   * they clicked the page to get rid of the caret.
   *
   * What actually had to be prevented is narrower. Editing a paragraph makes it
   * taller, a taller paragraph moves the page under it, and that movement reports a
   * new section — handing the panel away with a sentence half written in it. That
   * only ever happens in the instant after a change, so the guard is a short quiet
   * period after one rather than a rule about focus. Type and the panel stays put;
   * pause and scroll and it follows, caret or no caret.
   */
  const sight = useCallback((id: string) => {
    if (Date.now() - typedAt.current < QUIET_AFTER_EDIT_MS) {
      return;
    }

    setOpenSection(id);
  }, []);

  // Leaving edit mode closes the panel with it. A panel that survived the switch
  // would be a form floating over a page with nothing outlined behind it.
  function stopEditing() {
    setIsEditing(false);
    setOpenSection(null);
  }

  // Opening the editor opens a section with it. Which one is decided by the sections
  // themselves a frame later — whatever is on screen reports in — so pressing Edit
  // halfway down a page lands on the band being looked at rather than the top of it.
  // The first section is the fallback for the case nothing reports, which only
  // happens if no band is crossing the middle of the window.
  useEffect(() => {
    if (!isEditing) {
      return;
    }

    const first = sections[0];

    if (first === undefined) {
      return;
    }

    const timer = setTimeout(() => {
      setOpenSection((current) => current ?? first.id);
    }, 120);

    return () => clearTimeout(timer);
  }, [isEditing, sections]);

  return (
    <div className="min-h-svh">
      <div
        className={cn(
          "transition-[margin] duration-300 ease-out",
          open !== undefined && "sm:mr-[24rem]",
        )}
      >
        <EditorProvider value={{ isEditing, openSection, open: setOpenSection, sight }}>
          <SiteRenderer
            design={design.id}
            restaurant={restaurant}
            content={draft.content}
          />
        </EditorProvider>
      </div>

      {open !== undefined && (
        <EditorPanel
          design={design.id}
          section={open}
          sections={sections}
          content={draft.content}
          onPatch={patch}
          onClose={stopEditing}
        />
      )}

      <Toolbar
        name={design.name}
        canEdit={canEdit}
        isEditing={isEditing}
        isEdited={draft.isEdited}
        isPanelOpen={open !== undefined}
        onEdit={() => setIsEditing(true)}
        onDone={stopEditing}
        onReset={draft.reset}
      />
    </div>
  );
}

/**
 * The controls, floating over the page rather than framing it.
 *
 * At the bottom and centred, because the top of a landing page is the part whose
 * composition matters most and a bar across it would be judged as part of the design.
 * It slides with the panel so it is never underneath it.
 */
function Toolbar({
  name,
  canEdit,
  isEditing,
  isEdited,
  isPanelOpen,
  onEdit,
  onDone,
  onReset,
}: {
  name: string;
  canEdit: boolean;
  isEditing: boolean;
  isEdited: boolean;
  isPanelOpen: boolean;
  onEdit: () => void;
  onDone: () => void;
  onReset: () => void;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4",
        "transition-[padding] duration-300 ease-out",
        isPanelOpen && "sm:pr-[25rem]",
      )}
    >
      <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-full border border-border bg-surface/95 p-1.5 pl-4 shadow-lg backdrop-blur">
        <span className="text-sm font-semibold text-text">{name}</span>

        {/* What is real and what is not, one tap away. Once a manager has started
            editing, the sentence changes: some of it is now theirs. */}
        <Tooltip
          content={
            isEdited
              ? "Your name, address, phone and email are real, and so is anything you have edited. The rest is still sample copy."
              : "Your name, address, phone and email are real. The headline, menu, photographs, hours and quotes are sample copy."
          }
        >
          <span className="inline-flex cursor-help items-center gap-1 rounded-full bg-surface-3 px-2.5 py-1 text-2xs font-medium text-muted">
            <Info className="size-3" aria-hidden="true" />
            {isEdited ? "Edited · this device" : "Sample content"}
          </span>
        </Tooltip>

        <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />

        {isEdited && (
          <Tooltip content="Throw away your changes and go back to the sample restaurant.">
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-3 hover:text-text"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Reset
            </button>
          </Tooltip>
        )}

        <Link
          href="/settings/website"
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-3 hover:text-text"
        >
          <LayoutGrid className="size-3.5" aria-hidden="true" />
          All designs
        </Link>

        {/* Editing is offered only where there is something to edit. A design whose
            sections have not been wired yet says so rather than opening a mode in
            which nothing on the page responds. */}
        {canEdit ? (
          isEditing ? (
            <Button size="sm" variant="secondary" icon={<Eye />} onClick={onDone}>
              Done
            </Button>
          ) : (
            <Button size="sm" variant="secondary" icon={<Pencil />} onClick={onEdit}>
              Edit page
            </Button>
          )
        ) : (
          <Tooltip content="This design cannot be edited yet. Aurora is the one that can.">
            <span>
              <Button size="sm" variant="secondary" icon={<Pencil />} disabled>
                Edit
              </Button>
            </span>
          </Tooltip>
        )}

        {/* Disabled and labelled, which is how this product treats anything not yet
            built. There is nowhere to publish to: the site service was taken out to
            be rebuilt, and a button that appeared to work would be the one thing on
            this screen that lied. */}
        <Tooltip content="Publishing arrives with the server side of this. Nothing can be made public yet.">
          <span>
            <Button size="sm" icon={<Globe />} disabled>
              Publish
            </Button>
          </span>
        </Tooltip>
      </div>
    </div>
  );
}

/** Anything that is not a page: an error, a spinner, a design with nothing behind it. */
function Centred({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-canvas p-6">
      <Surface className="w-full max-w-lg">{children}</Surface>
    </div>
  );
}
