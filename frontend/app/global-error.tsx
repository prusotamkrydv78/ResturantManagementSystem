"use client";

import { CrashScreen } from "@/components/ui/crash-screen";
import "./globals.css";

/**
 * The last resort: the root layout itself failed.
 *
 * It replaces the whole document, so it has to bring its own <html>, <body> and
 * stylesheet. The theme script in the root layout does not run here, so this follows
 * the operating system's light or dark setting rather than the one chosen in the app.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-svh bg-canvas antialiased">
        <title>Something went wrong</title>
        <CrashScreen error={error} retry={retry} title="Something went wrong" />
      </body>
    </html>
  );
}
