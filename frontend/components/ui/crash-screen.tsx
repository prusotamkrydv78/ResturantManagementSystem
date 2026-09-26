"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * What an error boundary shows instead of the page that failed.
 *
 * Shared by the app's boundaries so a crash reads the same wherever it happens. Two
 * ways out, because they fix different things: trying again re-renders just this part
 * and usually clears a hiccup in the data, and reloading starts the app afresh when
 * the problem is the app's own state.
 *
 * The reference is Next's digest for errors raised on the server, which matches the
 * server's log. Shown small, for whoever gets asked about it; nothing else about the
 * error is, because the message can carry details a stranger has no business reading.
 */
export function CrashScreen({
  error,
  retry,
  title = "This screen hit a problem",
}: {
  error: Error & { digest?: string };
  retry: () => void;
  title?: string;
}) {
  useEffect(() => {
    // The only record of a client-side crash. The console is where a developer or a
    // support session looks, and the boundary otherwise swallows the error whole.
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="flex min-h-[60svh] flex-col items-center justify-center gap-4 px-6 py-12 text-center"
    >
      <span
        className="flex size-10 items-center justify-center rounded-lg border border-danger-border bg-danger-soft text-danger"
        aria-hidden="true"
      >
        <AlertTriangle className="size-5" />
      </span>
      <div className="flex max-w-md flex-col gap-1">
        <h1 className="text-lg font-semibold text-text">{title}</h1>
        <p className="text-sm text-muted">
          Something went wrong while showing this page. Anything already saved is safe;
          this only affects what is on the screen.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => retry()}>Try again</Button>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Reload the page
        </Button>
      </div>
      {error.digest !== undefined && (
        <p className="font-mono text-2xs text-subtle">Reference {error.digest}</p>
      )}
    </div>
  );
}
