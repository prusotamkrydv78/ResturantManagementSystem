import { Fraunces } from "next/font/google";
import { RequireAuth } from "@/features/auth/require-auth";

/**
 * A display serif, loaded only for the pages that are pages.
 *
 * The application is set in Inter, which is the right choice for a dense operations
 * tool and the wrong one for a restaurant. Every landing page on the internet is set
 * in a geometric sans, and a restaurant selling a room and a menu has to look like
 * somewhere rather than like software. The headline face is where that happens — it
 * is most of what separates a page that looks designed from a page that looks
 * generated.
 *
 * Fraunces rather than a plain old-style serif: it carries a little of the wonk and
 * warmth of a sign painted on a window, which is the register a dining room wants,
 * and it holds up at display sizes where a text serif goes thin and polite.
 *
 * Declared here rather than in the root layout, so the application itself never
 * downloads it.
 */
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display-face",
  display: "swap",
  // The optical-size axis is what stops a display serif looking like a book at 64px.
  axes: ["opsz"],
});

/**
 * The frame for screens that are a page rather than a screen of the application.
 *
 * No sidebar, no settings rail, no page header: a website preview judged inside
 * application chrome is a website judged with a hundred pixels of somebody else's
 * navigation beside it, and every opinion about its margins would be wrong.
 *
 * Still behind RequireAuth. These are a manager's own pages before anybody has
 * decided to publish them, and nothing here is public.
 */
export default function PreviewLayout({ children }: LayoutProps<"/">) {
  return (
    <RequireAuth roles={["RestaurantManager"]}>
      <div className={display.variable}>{children}</div>
    </RequireAuth>
  );
}
