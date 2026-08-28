import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";

/**
 * Focused single-column layout for sign in and registration. No navigation:
 * there is nothing to navigate to before signing in.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Link
            href="/"
            className="flex items-center justify-center gap-2.5 rounded-md"
          >
            <span
              className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-fg"
              aria-hidden="true"
            >
              <UtensilsCrossed className="size-4.5" />
            </span>
            <span className="text-lg font-semibold text-text">Restaurant OS</span>
          </Link>

          {children}
        </div>
      </div>

      <footer className="px-4 pb-6 text-center text-xs text-subtle">
        Restaurant management platform
      </footer>
    </div>
  );
}
