"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Surface, SurfaceHeader } from "@/components/ui/surface";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { SETTINGS_SECTIONS } from "@/components/layout/settings-nav";

/**
 * The landing page of the settings area.
 *
 * The rail beside it can reach every one of these in a click, so this page is not
 * a menu: it is the description the rail has no room for. Somebody who knows where
 * they are going uses the rail; somebody who does not reads this and finds out
 * what "Inventory" holds before spending a click on it.
 *
 * Role is enforced by the layout, which wraps this and every screen in the area.
 */
export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="The parts of the restaurant you set up once and revisit occasionally."
        crumbs={[{ label: "Workspace", href: "/dashboard" }, { label: "Settings" }]}
      />

      <PageBody>
        {SETTINGS_SECTIONS.map((section) => (
          <Surface key={section.title}>
            <SurfaceHeader title={section.title} description={section.description} />

            <ul className="divide-y divide-border">
              {section.links.map((link) => {
                const Icon = link.icon;

                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                    >
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-muted"
                        aria-hidden="true"
                      >
                        <Icon className="size-4" />
                      </span>

                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-sm font-medium text-text">
                          {link.label}
                        </span>
                        <span className="text-xs text-muted">{link.description}</span>
                      </span>

                      <ChevronRight
                        className="size-4 shrink-0 text-subtle"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Surface>
        ))}
      </PageBody>
    </>
  );
}
