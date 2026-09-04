import { AppShell } from "@/components/layout/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { RequireAuth } from "@/features/auth/require-auth";
import { ServiceToasts } from "@/features/notifications/service-toasts";
import { RealtimeProvider } from "@/lib/realtime/realtime-context";

/**
 * Every authenticated page shares this frame, so the shell is declared once
 * rather than repeated per page. Pages that need a specific role add their own
 * RequireAuth with `roles` inside this one.
 *
 * The live connection and the toasts sit here rather than in the root layout, inside
 * RequireAuth and so only ever open for somebody who is signed in. Which events a
 * connection receives is decided by the server from that account, which is also why it
 * must not outlive it.
 *
 * They wrap the shell rather than sitting beside it so that any screen can raise a
 * toast of its own, not only the service events.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <RequireAuth>
      <RealtimeProvider>
        <ToastProvider>
          <ServiceToasts />
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </RealtimeProvider>
    </RequireAuth>
  );
}
