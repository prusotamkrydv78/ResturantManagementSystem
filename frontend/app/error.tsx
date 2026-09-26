"use client";

import { CrashScreen } from "@/components/ui/crash-screen";

/**
 * A crash anywhere outside the signed-in app: sign-in, a guest ordering at a table, a
 * restaurant's public website.
 */
export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="flex min-h-svh flex-col bg-canvas">
      <CrashScreen error={error} retry={retry} title="Something went wrong" />
    </main>
  );
}
