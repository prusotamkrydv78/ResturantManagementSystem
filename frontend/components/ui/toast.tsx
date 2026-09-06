"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell, BellOff, Check, ChefHat, UserRoundCheck, X } from "lucide-react";
import { armChime, playChime, type ChimeTone } from "@/lib/notify/chime";
import { cn } from "@/lib/utils/cn";

/**
 * Things that happened while somebody was looking at another part of the screen.
 *
 * Built for a restaurant rather than for a dashboard. A waiter is holding a phone in one
 * hand, glancing at it between tables, so a toast here is large enough to read at arm's
 * length, says the table name before anything else, and is tappable straight through to
 * the thing it is about - a notification you have to go and find the page for is a
 * notification that wastes a trip.
 *
 * Each one makes a sound, because the screen is usually in a pocket. That is also why
 * the sound can be turned off in one tap and why the choice is remembered: a phone that
 * chimes during a conversation with a guest gets silenced permanently, and a mute switch
 * inside the product is far better than the one on the side of the handset.
 *
 * Auto-dismissing, but never while somebody is reading. Hovering or focusing a toast
 * holds it, which is what makes a stack of three during a rush survivable.
 */

/** How a toast reads and which voice it speaks in. */
export type ToastTone = "info" | "alert" | "success";

/** What to show. */
export interface ToastRequest {
  tone?: ToastTone;
  /** The headline. Lead with the table: it is what a waiter navigates by. */
  title: string;
  /** One supporting line. Optional, and skipped rather than padded. */
  description?: string;
  /** Where tapping the toast goes. Omitted for something purely informational. */
  href?: string;
  /** Label for the tap target, so it reads as an action rather than a link. */
  actionLabel?: string;
  /** How long before it leaves, in milliseconds. */
  duration?: number;
  /**
   * Collapses repeats.
   *
   * Two events about the same ticket should replace each other rather than stack:
   * during a rush the kitchen can mark three tickets ready in as many seconds, and a
   * waiter needs three toasts - but the *same* ticket announced twice is noise.
   */
  dedupeKey?: string;
  /** Whether to make a sound. Defaults to true; false for anything the user did. */
  silent?: boolean;
}

interface Toast extends ToastRequest {
  id: number;
}

interface ToastContextValue {
  /** Raises a toast. */
  notify: (request: ToastRequest) => void;
  /** Whether sounds are on. */
  soundOn: boolean;
  /** Turns sound on or off, and remembers it. */
  setSoundOn: (on: boolean) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const SOUND_KEY = "rms.notify.sound";
const DEFAULT_DURATION = 7000;

/** At most this many on screen. Older ones drop off the top. */
const MAX_VISIBLE = 4;

const TONE_VOICE: Record<ToastTone, ChimeTone> = {
  info: "info",
  alert: "alert",
  success: "settled",
};

/**
 * Holds the toasts for the app.
 *
 * Mounted once, inside the authenticated shell. The queue lives in state here rather
 * than in a module singleton so it is cleared on sign-out along with everything else.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [soundOn, setSoundOnState] = useState(true);
  const nextId = useRef(1);

  // Read once on mount rather than during render, because localStorage is neither
  // available on the server nor a pure thing to touch while rendering.
  useEffect(() => {
    try {
      setSoundOnState(window.localStorage.getItem(SOUND_KEY) !== "off");
    } catch {
      // Storage unavailable. Sound stays on, which is the useful default.
    }

    armChime();
  }, []);

  const setSoundOn = useCallback((on: boolean) => {
    setSoundOnState(on);

    try {
      window.localStorage.setItem(SOUND_KEY, on ? "on" : "off");
    } catch {
      // The preference simply will not survive a reload.
    }

    // Plays on turning it on, so the choice is confirmed by the thing it controls -
    // and it doubles as the gesture that unlocks audio.
    if (on) {
      playChime("info");
    }
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (request: ToastRequest) => {
      const id = nextId.current++;

      setToasts((current) => {
        // A repeat of something already on screen replaces it and keeps its place,
        // rather than pushing a near-identical card underneath it.
        const withoutDuplicate =
          request.dedupeKey === undefined
            ? current
            : current.filter((toast) => toast.dedupeKey !== request.dedupeKey);

        return [...withoutDuplicate, { ...request, id }].slice(-MAX_VISIBLE);
      });

      if (soundOn && request.silent !== true) {
        playChime(TONE_VOICE[request.tone ?? "info"]);
      }
    },
    [soundOn],
  );

  const value = useMemo(
    () => ({ notify, soundOn, setSoundOn }),
    [notify, soundOn, setSoundOn],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/**
 * Raises toasts.
 *
 * Returns a no-op outside the provider rather than throwing. A notification is never
 * the point of the screen it appears on, and a page rendered in isolation - a test, a
 * preview - should not fail because nothing was listening.
 */
export function useToast(): ToastContextValue {
  return (
    useContext(ToastContext) ?? {
      notify: () => {},
      soundOn: false,
      setSoundOn: () => {},
    }
  );
}

/* -------------------------------------------------------------------------- */
/* Rendering                                                                  */
/* -------------------------------------------------------------------------- */

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return null;
  }

  return createPortal(
    // Portalled to the body, because the app shell has a sticky blurred header and a
    // backdrop-filter anywhere above a fixed element makes it measure itself against
    // the blurred box instead of the screen.
    //
    // Full width at the bottom on a phone, where a thumb is, and out of the way in the
    // corner on a desktop. pointer-events are off on the column and back on for each
    // card, so the empty space above the stack never swallows a click.
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-3 sm:inset-x-auto sm:right-0 sm:items-end sm:p-4"
    >
      <div aria-live="polite" aria-atomic="false" className="flex flex-col gap-2">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
    </div>,
    document.body,
  );
}

const TONE_STYLES: Record<
  ToastTone,
  { card: string; badge: string; bar: string; icon: React.ReactNode }
> = {
  info: {
    card: "border-border-strong",
    badge: "bg-surface-3 text-muted",
    bar: "bg-border-strong",
    icon: <ChefHat className="size-4" aria-hidden="true" />,
  },
  alert: {
    card: "border-danger-border",
    badge: "bg-danger-soft text-danger",
    bar: "bg-danger",
    icon: <UserRoundCheck className="size-4" aria-hidden="true" />,
  },
  success: {
    card: "border-success-border",
    badge: "bg-success-soft text-success",
    bar: "bg-success",
    icon: <Check className="size-4" aria-hidden="true" />,
  },
};

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const [held, setHeld] = useState(false);
  const tone = toast.tone ?? "info";
  const styles = TONE_STYLES[tone];

  // Held while somebody is reading it, which is the whole reason this is an effect
  // keyed on `held` rather than a timeout set once when the toast appears.
  useEffect(() => {
    if (held) {
      return;
    }

    const timer = setTimeout(
      () => onDismiss(toast.id),
      toast.duration ?? DEFAULT_DURATION,
    );

    return () => clearTimeout(timer);
  }, [held, toast.id, toast.duration, onDismiss]);

  const body = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          // Lands just after the card, so the two read as one gesture rather
          // than as a finished thing appearing all at once.
          "toast-badge flex size-8 shrink-0 items-center justify-center rounded-full",
          styles.badge,
        )}
      >
        {styles.icon}
      </span>

      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-semibold text-text">{toast.title}</span>

        {toast.description !== undefined && (
          <span className="text-2xs text-muted">{toast.description}</span>
        )}

        {toast.href !== undefined && (
          <span className="mt-0.5 text-2xs font-medium text-primary">
            {toast.actionLabel ?? "Open"} →
          </span>
        )}
      </span>
    </>
  );

  return (
    <div
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      className={cn(
        "toast-in pointer-events-auto relative flex w-[min(24rem,calc(100vw-1.5rem))] items-start gap-3 overflow-hidden rounded-xl border bg-surface p-3 shadow-lg",
        // Rises very slightly under a finger or a cursor, which is the cheapest
        // way to say the whole card is the tap target rather than the link in it.
        "transition-transform duration-200 hover:-translate-y-0.5",
        styles.card,
      )}
    >
      {/* How long is left, draining away.

          Toasts get distrusted because they vanish mid-sentence with no warning;
          this is the warning. It is driven by the same duration the dismiss timer
          uses and paused by the same `held` flag, so the bar and the behaviour
          cannot drift apart - a countdown that lies is worse than none. */}
      <span
        aria-hidden="true"
        // Remounted whenever the hold changes, which is what keeps it truthful.
        // Letting go restarts the dismiss timer at its full duration, so the bar
        // has to start over too; a bar that resumed from a third full while the
        // timer had gone back to the top would empty long before the toast left.
        key={held ? "held" : "running"}
        className={cn(
          "toast-drain absolute inset-x-0 bottom-0 h-0.5 opacity-60",
          styles.bar,
        )}
        style={{
          animationDuration: `${toast.duration ?? DEFAULT_DURATION}ms`,
          animationPlayState: held ? "paused" : "running",
        }}
      />

      {toast.href === undefined ? (
        <span className="flex min-w-0 flex-1 items-start gap-3">{body}</span>
      ) : (
        // A link rather than a button with a router push, so it behaves like a link:
        // middle-click, long-press and open-in-new-tab all work without any handling.
        <Link
          href={toast.href}
          onClick={() => onDismiss(toast.id)}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {body}
        </Link>
      )}

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="-m-1 shrink-0 rounded-md p-1 text-subtle transition-colors hover:bg-surface-3 hover:text-text"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * The mute switch.
 *
 * Lives in the shell rather than in settings, because the moment somebody wants it is
 * the moment a chime went off next to a guest - and that is not a moment for navigating
 * to a preferences page.
 */
export function ToastSoundToggle({ className }: { className?: string }) {
  const { soundOn, setSoundOn } = useToast();

  return (
    <button
      type="button"
      onClick={() => setSoundOn(!soundOn)}
      aria-pressed={soundOn}
      title={soundOn ? "Notification sounds on" : "Notification sounds off"}
      aria-label={
        soundOn ? "Turn notification sounds off" : "Turn notification sounds on"
      }
      className={cn(
        "rounded-md p-2 transition-colors hover:bg-surface-3",
        soundOn ? "text-text" : "text-subtle",
        className,
      )}
    >
      {soundOn ? (
        <Bell className="size-4" aria-hidden="true" />
      ) : (
        <BellOff className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}
