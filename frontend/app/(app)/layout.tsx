import { AppShell } from "@/components/layout/app-shell";
import { RequireAuth } from "@/features/auth/require-auth";

/**
 * Every authenticated page shares this frame, so the shell is declared once
 * rather than repeated per page. Pages that need a specific role add their own
 * RequireAuth with `roles` inside this one.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
