"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Dialog, DialogTrigger, DrawerContent } from "@/components/ui/dialog";
import {
  Brand,
  Sidebar,
  SidebarNav,
  UserPanel,
} from "@/components/layout/sidebar";

/**
 * The authenticated application frame: sidebar on large screens, a drawer
 * behind a menu button below that.
 *
 * The mobile experience is a real drawer rather than a narrowed sidebar, so the
 * content column keeps its full width on a phone.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-svh bg-canvas">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header. The desktop context bar lives in PageHeader. */}
        <div className="flex items-center gap-2 border-b border-border bg-surface px-2 py-2 lg:hidden">
          <Dialog open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label="Open navigation"
                className="rounded-md p-2 text-muted transition-colors hover:bg-surface-3 hover:text-text"
              >
                <Menu className="size-5" aria-hidden="true" />
              </button>
            </DialogTrigger>

            <DrawerContent title="Navigation">
              <Brand />
              <SidebarNav onNavigate={() => setIsDrawerOpen(false)} />
              <UserPanel />
            </DrawerContent>
          </Dialog>

          <Brand />
        </div>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
