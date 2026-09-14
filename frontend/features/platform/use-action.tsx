"use client";

import { useState } from "react";
import { FormError } from "@/components/ui/states";

/**
 * One card's worth of "in progress, worked, or failed".
 *
 * Per card rather than per page, which is the whole reason it exists. The dialogs
 * these admin screens replaced had a single pair of messages at the top for four
 * different actions, so confirming a password reset meant reading a line four
 * sections above where you clicked.
 */
export interface Action {
  busy: boolean;
  error: string | null;
  notice: string | null;
  run: (work: () => Promise<void>, done?: string) => Promise<void>;
  /** Sets the notice from inside the work, where the wording depends on the result. */
  say: (notice: string) => void;
}

/** Tracks one button's attempt and whatever it had to say afterwards. */
export function useAction(): Action {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(work: () => Promise<void>, done?: string) {
    setError(null);
    setNotice(null);
    setBusy(true);

    try {
      await work();

      if (done !== undefined) {
        setNotice(done);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The action failed.");
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, notice, run, say: setNotice };
}

/** Whatever the last attempt had to say, shown where it happened. */
export function Report({ action }: { action: Action }) {
  if (action.error !== null) {
    return <FormError message={action.error} />;
  }

  if (action.notice !== null) {
    return (
      <p
        role="status"
        className="rounded-md border border-success-border bg-success-soft px-3 py-2 text-sm text-success"
      >
        {action.notice}
      </p>
    );
  }

  return null;
}
