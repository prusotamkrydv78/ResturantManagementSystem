"use client";

import { ArrowRight } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { homeFor } from "@/components/layout/nav-config";
import { useAuth } from "@/features/auth/auth-context";
import { cn } from "@/lib/utils/cn";

/**
 * The front door's one button: sign in, or carry on where you left off.
 *
 * Somebody who is already signed in and lands on the marketing page is not there to
 * read it - they have followed a bookmark, or a link somebody sent them, and what
 * they want is their work. Sending them to a sign-in form to type a password the
 * browser already has a session for is the kind of small tax that gets paid dozens of
 * times a week.
 *
 * The destination is asked for by role rather than hardcoded, so a waiter, a chef, a
 * manager and a platform administrator each land where their own navigation begins.
 *
 * A client component inside a server-rendered page, because the session lives in the
 * browser. The server therefore renders the signed-out button and the signed-in one
 * replaces it after the session is restored. That order is deliberate: signed out is
 * the safe thing to show to someone who turns out to be signed out, and the flip is a
 * single label change rather than a layout shift.
 */
export function WorkspaceLink({
  /** What the button says to somebody with no session. */
  signedOutLabel = "Sign in",
  size,
  className,
}: {
  signedOutLabel?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const { user, isAuthenticated, isLoading } = useAuth();

  // While the refresh cookie is still being checked, the signed-out button stands.
  // Showing a spinner here would put a loading state in the header of a public page
  // for everybody, including the majority who are not signed in at all.
  if (isLoading || !isAuthenticated || user === null) {
    return (
      <LinkButton
        href="/login"
        size={size}
        icon={<ArrowRight />}
        className={className}
      >
        {signedOutLabel}
      </LinkButton>
    );
  }

  return (
    <LinkButton
      href={homeFor(user.platformRole, user.staffRole)}
      size={size}
      icon={<ArrowRight />}
      className={className}
    >
      Go to your dashboard
    </LinkButton>
  );
}

/**
 * The same decision as a plain text link, for the footer.
 *
 * Separate from the button rather than a variant of it: the footer link is not a
 * call to action and should not grow a button's weight just to answer the same
 * question about the session.
 */
export function WorkspaceTextLink({ className }: { className?: string }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  const signedIn = !isLoading && isAuthenticated && user !== null;

  return (
    <a
      href={signedIn ? homeFor(user.platformRole, user.staffRole) : "/login"}
      className={cn(
        "rounded text-sm font-medium text-primary hover:underline",
        className,
      )}
    >
      {signedIn ? "Your dashboard" : "Sign in"}
    </a>
  );
}
