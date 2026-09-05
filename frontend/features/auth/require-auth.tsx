"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/components/ui/states";
import { homeFor } from "@/components/layout/nav-config";
import { useAuth } from "@/features/auth/auth-context";
import type { PlatformRole } from "@/types/auth";
import type { StaffRole } from "@/types/staff";

interface RequireAuthProps {
  children: React.ReactNode;
  /**
   * When set, the signed-in user must hold one of these platform roles.
   *
   * This only shapes the UI. Every request is authorised independently by the
   * API, which remains the security boundary.
   */
  roles?: readonly PlatformRole[];
  /**
   * When set, a staff account must also do one of these jobs on the floor.
   *
   * Needed because the platform role does not say enough. A chef and a waiter are both
   * Staff, and the endpoints behind their screens are not: the kitchen rail is gated on
   * Chef and the order pad on Waiter. Guarding on the platform role alone let each of
   * them open the other's screen and meet a wall of refusals, which reads as the product
   * being broken rather than as the page not being theirs.
   */
  staffRoles?: readonly StaffRole[];
}

/**
 * Guards a page or a layout.
 *
 * While the session restore is still running it shows a neutral placeholder
 * rather than redirecting, so a browser refresh on a protected page does not
 * bounce to sign-in before the refresh cookie has been checked.
 */
export function RequireAuth({ children, roles, staffRoles }: RequireAuthProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const hasRole =
    roles === undefined || (user !== null && roles.includes(user.platformRole));

  // Only asked of staff. A manager on a screen shared with waiters holds no staff role
  // at all, and demanding one would lock them out of their own floor view.
  const hasStaffRole =
    staffRoles === undefined ||
    user === null ||
    user.platformRole !== "Staff" ||
    (user.staffRole !== null && staffRoles.includes(user.staffRole));

  const permitted = hasRole && hasStaffRole;

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated) {
      router.replace("/login");
    } else if (!permitted) {
      // Sent to the home their own navigation starts at, rather than to a fixed
      // address. This used to be "/dashboard", which worked only because that page
      // happens to carry no gate of its own - a coincidence, and one that would turn
      // into a redirect loop the day somebody gated it.
      router.replace(homeFor(user?.platformRole, user?.staffRole));
    }
  }, [isAuthenticated, isLoading, permitted, router, user]);

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!isAuthenticated || !permitted) {
    return null;
  }

  return <>{children}</>;
}
