"use client";

import { CrashScreen } from "@/components/ui/crash-screen";

/**
 * A crash inside a signed-in screen.
 *
 * Placed here rather than only at the root so it sits inside the app shell: the
 * sidebar, the live connection and the toasts all survive, and staff can move to
 * another screen without reloading. Before there was no boundary anywhere, so one card
 * failing to render blanked the whole app - on a kitchen screen, mid-service, with no
 * way back but a reload.
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <CrashScreen error={error} retry={retry} />;
}
