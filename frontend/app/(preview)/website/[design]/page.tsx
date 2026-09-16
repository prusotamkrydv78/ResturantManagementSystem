"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  CircleAlert,
  CircleCheck,
  Eye,
  Globe,
  Images,
  LayoutGrid,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  Undo2,
} from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { ErrorState, Spinner } from "@/components/ui/states";
import { Surface } from "@/components/ui/surface";
import { NoRestaurantAssigned } from "@/features/restaurants/no-restaurant";
import { getMyRestaurant } from "@/features/restaurants/api";
import { designById, type Design } from "@/features/website/designs";
import { SiteRenderer } from "@/features/website/templates";
import { useSiteDraft, type SiteDraft } from "@/features/website/editor/draft";
import { EditorProvider } from "@/features/website/editor/editable";
import { EditorPanel, type PanelTab } from "@/features/website/editor/panel";
import { MediaLibraryProvider } from "@/features/website/media/library";
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
 * restaurant to load it for.
 */
function Page({ design, restaurant }: { design: Design; restaurant: Restaurant }) {
  const draft = useSiteDraft(design.id);

  const [isEditing, setIsEditing] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);

  /**
   * Which half of the panel is showing.
   *
   * Held here rather than in the panel because the toolbar opens the library directly,
   * and a tab the panel owned would be unreachable from outside it. It also means the
   * library survives the panel closing and reopening, which is what somebody
   * uploading a set of photographs expects.
   */
  const [tab, setTab] = useState<PanelTab>("section");

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
    setTab("section");
  }

  /**
   * The library, from the toolbar.
   *
   * A press with it already open closes it, because the button is the only way in and
   * a one-way door is how a panel ends up covering a page somebody is trying to look
   * at. Opening it does not start an edit: browsing and tidying pictures is a job of
   * its own, and it should not require putting the page into a mode first.
   */
  function toggleMedia() {
    if (tab === "media") {
      setTab("section");

      if (!isEditing) {
        setOpenSection(null);
      }

      return;
    }

    setTab("media");
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

  // Open for the fields of a section, or for the library on its own.
  const isPanelOpen = open !== undefined || tab === "media";

  return (
    // The library is provided around the whole page rather than around the panel, so
    // one load serves the media tab, every photograph picker in it, and anything the
    // templates grow later. See the note in library.tsx.
    <MediaLibraryProvider>
      <div className="min-h-svh">
        <div
          className={cn(
            "transition-[margin] duration-300 ease-out",
            isPanelOpen && "sm:mr-[24rem]",
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

        {isPanelOpen && (
          <EditorPanel
            design={design.id}
            section={open}
            sections={sections}
            content={draft.content}
            tab={open === undefined ? "media" : tab}
            onTab={setTab}
            onPatch={patch}
            onClose={stopEditing}
          />
        )}

        <Toolbar
          name={design.name}
          canEdit={canEdit}
          isEditing={isEditing}
          isMediaOpen={tab === "media"}
          draft={draft}
          isPanelOpen={isPanelOpen}
          onEdit={() => setIsEditing(true)}
          onDone={stopEditing}
          onMedia={toggleMedia}
        />
      </div>
    </MediaLibraryProvider>
  );
}

/**
 * The controls, floating over the page rather than framing it.
 *
 * At the bottom and centred, because the top of a landing page is the part whose
 * composition matters most and a bar across it would be judged as part of the design.
 * It slides with the panel so it is never underneath it.
 *
 * GLYPHS, WITH THE WORDS ON HOVER
 *
 * This carried eight labelled controls and two badges, which is a sentence laid across
 * the bottom of somebody's restaurant. A bar sitting on a page that is being judged for
 * its looks should be the smallest thing that still works, and these are five controls
 * a manager uses often enough to learn in an afternoon.
 *
 * The words are not gone. Each control unfolds its own name under the pointer, and
 * keeps a real accessible name whether or not anybody hovers it. Unfolded rather than
 * shown in a tooltip beside the bar, so the name stays attached to the button it
 * belongs to and the bar remains one object rather than two.
 */
function Toolbar({
  name,
  canEdit,
  isEditing,
  isMediaOpen,
  draft,
  isPanelOpen,
  onEdit,
  onDone,
  onMedia,
}: {
  name: string;
  canEdit: boolean;
  isEditing: boolean;
  isMediaOpen: boolean;
  draft: SiteDraft;
  isPanelOpen: boolean;
  onEdit: () => void;
  onDone: () => void;
  onMedia: () => void;
}) {
  const isLive = draft.site?.isPublished === true;
  const isSaving = draft.status === "saving";

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4",
        "transition-[padding] duration-300 ease-out",
        isPanelOpen && "sm:pr-[25rem]",
      )}
    >
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-surface/95 p-1.5 pl-4 shadow-lg backdrop-blur">
        {/* The design's name, and beside it one mark for everything a manager might
            ask about the state of their work. Two badges sat here before, saying two
            halves of the same thing. */}
        <Tooltip content={stateOf(draft)} side="top" className="max-w-72 whitespace-normal!">
          <span className="flex cursor-help items-center gap-1.5 pr-1 text-sm font-semibold text-text">
            {name}
            <StateMark draft={draft} />
          </span>
        </Tooltip>

        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

        {/* A page that never arrived is the only thing here worth a control of its
            own, so it takes this slot. Unsaved changes otherwise have somewhere to go
            back to; saved ones have only the sample. Never more than one at a time. */}
        {draft.loadError !== null ? (
          <IconAction
            label="Try loading again"
            icon={<RefreshCw className="size-4" aria-hidden="true" />}
            onClick={draft.reload}
          />
        ) : draft.isDirty ? (
          <IconAction
            label="Discard changes"
            icon={<Undo2 className="size-4" aria-hidden="true" />}
            onClick={draft.discard}
          />
        ) : (
          draft.hasOwnContent && (
            <IconAction
              label="Back to the sample"
              icon={<RotateCcw className="size-4" aria-hidden="true" />}
              onClick={draft.reset}
            />
          )
        )}

        <IconAction
          label="All designs"
          icon={<LayoutGrid className="size-4" aria-hidden="true" />}
          href="/settings/website"
        />

        {/* Editing is offered only where there is something to edit. A design whose
            sections have not been wired yet says so rather than opening a mode in
            which nothing on the page responds. */}
        <IconAction
          label={
            !canEdit
              ? "Only Aurora can be edited so far"
              : isEditing
                ? "Done editing"
                : "Edit page"
          }
          icon={
            isEditing ? (
              <Eye className="size-4" aria-hidden="true" />
            ) : (
              <Pencil className="size-4" aria-hidden="true" />
            )
          }
          isActive={isEditing}
          isDisabled={!canEdit}
          onClick={isEditing ? onDone : onEdit}
        />

        {/* The library, reachable without first putting the page into edit mode.
            Sorting through photographs is a job of its own and often the one that
            happens first. */}
        <IconAction
          label="Pictures"
          icon={<Images className="size-4" aria-hidden="true" />}
          isActive={isMediaOpen}
          onClick={onMedia}
        />

        {/* Nothing reaches the server until this is pressed. Off when there is nothing
            to send, so the button is also the answer to "is my work in". */}
        <IconAction
          label={isSaving ? "Saving" : draft.isDirty ? "Save" : "Nothing to save"}
          icon={
            isSaving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )
          }
          isDisabled={!draft.isDirty || isSaving}
          onClick={() => void draft.save()}
        />

        {/* Publishing takes a copy of the draft. Saving does not, which is why a
            manager can edit a live page all afternoon without anybody seeing it. The
            one control here that changes what strangers see, so the one that is
            filled rather than quiet. */}
        <IconAction
          label={isLive ? "Publish changes" : "Publish"}
          icon={<Globe className="size-4" aria-hidden="true" />}
          isPrimary
          isDisabled={!draft.isReady || draft.loadError !== null}
          onClick={() => void draft.publish(true)}
        />
      </div>
    </div>
  );
}

/**
 * One control: a glyph that unfolds its name under the pointer.
 *
 * A tooltip was the first answer and it was the wrong one. A tooltip is a second
 * object — it appears somewhere else, on a delay, over the page being judged — when
 * all this needs is for the button to say what it is. Unfolding keeps the name
 * attached to the thing it names, and the bar stays one object.
 *
 * The width is animated as a grid track from 0fr to 1fr, which is the only way to
 * transition to a size nobody has measured. The obvious max-width version is what was
 * here first and it is never smooth: the label is around a hundred pixels and the cap
 * has to be set well above the longest one, so the text finishes arriving in the first
 * third of the animation and the remaining two thirds are spent widening empty space.
 * Closing reads worse still — a long pause, then a snap.
 *
 * Three hundred milliseconds on a curve that covers most of the distance early and
 * settles into the last of it: long enough to read as unfolding rather than appearing,
 * short enough that somebody moving along the row is never waiting on it. The text
 * fades and slides the last few pixels in with it, so the name arrives as one movement
 * instead of a box opening and a word landing in it.
 *
 * The icon never moves inside the button, and the button never stops being under the
 * pointer that opened it — it grows to the right of a fixed glyph, and the whole bar
 * being centred only pulls it left by half of what it gained.
 *
 * Opens on focus as well as hover, so the name is not something only a mouse can
 * reach. Every control carries a real accessible name regardless.
 *
 * An anchor or a button depending on what it does, because a thing that navigates
 * should be a link — middle-click and open-in-new-tab are not worth losing to make a
 * row uniform.
 *
 * Unavailable is `aria-disabled` rather than `disabled`, so the control still takes
 * a pointer and can still unfold to say why it is unavailable. A greyed glyph that
 * refuses to name itself is a riddle.
 */
function IconAction({
  label,
  icon,
  href,
  onClick,
  isDisabled = false,
  isPrimary = false,
  isActive = false,
}: {
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  isDisabled?: boolean;
  isPrimary?: boolean;
  isActive?: boolean;
}) {
  // The hover styles are withheld rather than overridden when the control is
  // unavailable: cn() is a plain join, so two competing hover:bg-* classes would be
  // settled by the order Tailwind happened to emit them in, not by the order here.
  const className = cn(
    "group inline-flex h-9 shrink-0 items-center justify-center rounded-full px-2.5",
    // 200 rather than the product's usual 100, so the fill arriving and the name
    // unfolding read as one gesture instead of two of different lengths.
    "pressable transition-colors duration-200",
    isPrimary
      ? "bg-primary-solid text-primary-fg"
      : isActive
        ? "bg-primary-soft text-primary"
        : "text-muted",
    !isDisabled &&
      (isPrimary
        ? "hover:bg-primary-hover active:bg-primary-active"
        : "hover:bg-surface-3 hover:text-text"),
    isDisabled && "cursor-not-allowed opacity-40",
  );

  const body = (
    <>
      {icon}

      {/* aria-hidden because the accessible name is on the control itself. Without
          it a screen reader is told the name twice, once as the label and once as
          the text inside. */}
      <span
        aria-hidden="true"
        className={cn(
          "grid grid-cols-[0fr] ease-[cubic-bezier(0.22,1,0.36,1)]",
          "transition-[grid-template-columns] duration-300 motion-reduce:transition-none",
          "group-hover:grid-cols-[1fr] group-focus-visible:grid-cols-[1fr]",
        )}
      >
        {/* The clip. A grid track can go to zero; the text inside it cannot, so this
            is what hides the overflow while the track closes. */}
        <span className="overflow-hidden">
          <span
            className={cn(
              "block translate-x-1 pl-1.5 text-sm font-medium whitespace-nowrap opacity-0",
              "transition-[opacity,transform] duration-300 ease-out",
              "motion-reduce:transition-none",
              "group-hover:translate-x-0 group-hover:opacity-100",
              "group-focus-visible:translate-x-0 group-focus-visible:opacity-100",
            )}
          >
            {label}
          </span>
        </span>
      </span>
    </>
  );

  return href === undefined ? (
    <button
      type="button"
      aria-label={label}
      aria-disabled={isDisabled || undefined}
      onClick={isDisabled ? undefined : onClick}
      className={className}
    >
      {body}
    </button>
  ) : (
    <Link href={href} aria-label={label} className={className}>
      {body}
    </Link>
  );
}

/**
 * The state of the work, as one mark beside the name.
 *
 * Silent when there is nothing to say. A badge that permanently reads "Saved" is
 * furniture and stops being read, which is the moment it would have been worth
 * reading. The words behind each mark are in the hover on the name.
 */
function StateMark({ draft }: { draft: SiteDraft }) {
  if (draft.loadError !== null || draft.status === "failed") {
    return <CircleAlert className="size-3.5 text-danger" aria-hidden="true" />;
  }

  if (draft.status === "saving") {
    return <Loader2 className="size-3.5 animate-spin text-muted" aria-hidden="true" />;
  }

  if (draft.isDirty) {
    return <span className="size-2 rounded-full bg-warning" aria-hidden="true" />;
  }

  if (draft.status === "saved") {
    return <CircleCheck className="size-3.5 text-success" aria-hidden="true" />;
  }

  return null;
}

/** Everything the mark stands for, in the words the hover shows. */
function stateOf(draft: SiteDraft): string {
  if (draft.loadError !== null) {
    return draft.loadError + " Nothing you change here can be kept until it loads.";
  }

  if (draft.status === "failed") {
    return draft.saveError ?? "The last save did not reach the server. Try again.";
  }

  if (draft.status === "saving") {
    return "Saving your changes.";
  }

  if (draft.isDirty) {
    return "You have changes that have not been saved yet.";
  }

  return draft.hasOwnContent
    ? "Saved. Your name, address, phone and email come from your restaurant; anything you have not written yourself is still sample copy."
    : "Your name, address, phone and email are real. The headline, menu, photographs, hours and quotes are sample copy until you change them.";
}

/** Anything that is not a page: an error, a spinner, a design with nothing behind it. */
function Centred({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-canvas p-6">
      <Surface className="w-full max-w-lg">{children}</Surface>
    </div>
  );
}
