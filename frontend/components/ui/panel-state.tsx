"use client";

import { ApiError } from "@/lib/api/client";

/**
 * What one panel of a detail page is doing.
 *
 * Detail pages in the settings area are several unrelated jobs side by side — edit
 * these fields, suspend this thing, replace that credential, delete it — and each
 * one succeeds or fails on its own. State per panel rather than per page is what
 * makes that true: a single shared message meant a password reset silently wiped
 * the confirmation from a save that had just succeeded above it, and a failure in
 * one panel put an error banner over three others that were fine.
 *
 * Shared from here because the staff and table pages are the same shape, and a
 * second copy of this is a second place for the two to drift.
 */
export type PanelState =
  | { status: "idle" }
  | { status: "busy" }
  | { status: "done"; message: string }
  | { status: "error"; message: string; fieldErrors: Record<string, string[]> };

export const idle: PanelState = { status: "idle" };

/**
 * Turns whatever was thrown into a panel state.
 *
 * An ApiError carries the per-field messages the server sent, which is the only
 * way the form under it can mark the field that was actually wrong. Anything else
 * is a network or programming failure and gets the caller's own wording.
 */
export function failure(caught: unknown, fallback: string): PanelState {
  if (caught instanceof ApiError) {
    return {
      status: "error",
      message: caught.message,
      fieldErrors: caught.fieldErrors,
    };
  }

  return {
    status: "error",
    message: caught instanceof Error ? caught.message : fallback,
    fieldErrors: {},
  };
}

/** The server's complaint about one field, if it made one. */
export function fieldError(state: PanelState, field: string): string | undefined {
  return state.status === "error" ? state.fieldErrors[field]?.[0] : undefined;
}

/**
 * The confirmation beside a button, once its action has succeeded.
 *
 * Beside rather than as a banner: on a page there is nothing to close, so the only
 * sign an action worked is the text next to the control that was just pressed.
 */
export function Notice({ state }: { state: PanelState }) {
  if (state.status !== "done") {
    return null;
  }

  return (
    <p role="status" className="text-sm text-success">
      {state.message}
    </p>
  );
}
