import type { Metadata } from "next";

/**
 * The frame for the pages a guest reaches by scanning a table.
 *
 * Deliberately empty of chrome. There is no shell, no navigation, no account menu and
 * no route into the rest of the application: a guest holding a table code is not a user
 * of this product, and showing them the edge of a manager interface would be both
 * confusing and an invitation.
 *
 * `noindex` because these links are private to a table. They are not secret in the
 * cryptographic sense once printed on a card, but they should certainly not end up in a
 * search index where somebody who was never in the restaurant can find them.
 */
export const metadata: Metadata = {
  title: "Order at your table",
  description: "Order from your table.",
  robots: { index: false, follow: false },
};

export default function PublicOrderingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex min-h-full flex-col bg-surface-2">{children}</div>;
}
