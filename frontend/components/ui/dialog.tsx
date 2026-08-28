"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Modal dialog.
 *
 * Built on Radix so focus trapping, escape handling, scroll locking and the
 * aria wiring are correct rather than approximated. Used for the create and
 * assign flows, and for the mobile navigation drawer.
 */

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

export function DialogContent({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]",
          "data-[state=open]:animate-in data-[state=open]:fade-in",
        )}
      />
      <RadixDialog.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg",
          "-translate-x-1/2 -translate-y-1/2",
          "max-h-[calc(100vh-3rem)] overflow-y-auto",
          "rounded-lg border border-border bg-surface shadow-lg",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <RadixDialog.Title className="text-lg font-semibold text-text">
              {title}
            </RadixDialog.Title>
            {description !== undefined && (
              <RadixDialog.Description className="text-xs text-muted">
                {description}
              </RadixDialog.Description>
            )}
          </div>
          <RadixDialog.Close
            className="-mr-1 -mt-0.5 shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-surface-3 hover:text-text"
            aria-label="Close"
          >
            <X className="size-4" aria-hidden="true" />
          </RadixDialog.Close>
        </div>

        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

/** Action row pinned to the bottom of a dialog. */
export function DialogFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-2 px-4 py-3">
      {children}
    </div>
  );
}

/**
 * Side drawer, used for navigation on small screens. Same accessibility
 * guarantees as the centred dialog.
 */
export function DrawerContent({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
      <RadixDialog.Content
        className={cn(
          "fixed top-0 left-0 z-50 flex h-full w-72 max-w-[85vw] flex-col",
          "border-r border-border bg-surface shadow-lg",
        )}
      >
        <RadixDialog.Title className="sr-only">{title}</RadixDialog.Title>
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
