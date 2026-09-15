"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Surface } from "@/components/ui/surface";
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
 * Three columns rather than three stacked panels, which is the only thing that
 * changed here. Six links as full-width rows meant six bands of mostly empty paper:
 * a 16px glyph and half a line of text stretched across a widescreen monitor, three
 * times over, and the page read as though it had failed to load. Grouped into
 * columns the same six sit in a third of the height, the group headings stop being
 * panel chrome and start being signposts, and each destination gets a shape big
 * enough to be aimed at.
 *
 * Role is enforced by the layout, which wraps this and every screen in the area.
 */
export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="The parts of the restaurant you set up once and revisit occasionally."
      />

      <PageBody>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {SETTINGS_SECTIONS.map((section) => (
            <section key={section.title} className="flex flex-col gap-2.5">
              {/* A heading in the page rather than a header on a panel. The grouping
                  is a way of thinking about the area - what the business is, the room
                  it runs in, the records behind it - and a border around it made it
                  look like a container that might hold something else. */}
              <div className="flex flex-col gap-0.5 px-0.5">
                <h2 className="text-2xs font-semibold tracking-wider text-subtle uppercase">
                  {section.title}
                </h2>
                <p className="text-xs text-muted">{section.description}</p>
              </div>

              <ul className="flex flex-col gap-2.5">
                {section.links.map((link) => {
                  const Icon = link.icon;

                  return (
                    <li key={link.href} className="flex">
                      <Surface className="group flex flex-1 transition-colors hover:border-primary-border">
                        <Link
                          href={link.href}
                          className="flex flex-1 flex-col gap-2.5 rounded-lg p-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          <span className="flex items-center gap-2.5">
                            {/* Tinted rather than grey. On a page that is entirely
                                navigation, the glyphs are the only thing the eye can
                                aim at, and six inert grey squares give it nothing. */}
                            <span
                              className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary"
                              aria-hidden="true"
                            >
                              <Icon className="size-4" />
                            </span>

                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">
                              {link.label}
                            </span>

                            {/* Steps toward the reader on hover. The arrow is always
                                present, so nothing shifts and nothing appears from
                                nowhere; it only stops being quiet. */}
                            <ArrowRight
                              className="size-4 shrink-0 text-subtle transition-all group-hover:translate-x-0.5 group-hover:text-primary"
                              aria-hidden="true"
                            />
                          </span>

                          <span className="text-xs text-muted">{link.description}</span>
                        </Link>
                      </Surface>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </PageBody>
    </>
  );
}
