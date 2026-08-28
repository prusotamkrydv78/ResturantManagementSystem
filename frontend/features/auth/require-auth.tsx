"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/components/ui/states";
import { useAuth } from "@/features/auth/auth-context";
import type { PlatformRole } from "@/types/auth";

interface RequireAuthProps {
  children: React.ReactNode;
  /**
   * When set, the signed-in user must hold one of these platform roles.
   *
   * This only shapes the UI. Every request is authorised independently by the
   * API, which remains the security boundary.
   */
  roles?: readonly PlatformRole[];
}

/**
 * Guards a page or a layout.
 *
 * While the session restore is still running it shows a neutral placeholder
 * rather than redirecting, so a browser refresh on a protected page does not
 * bounce to sign-in before the refresh cookie has been checked.
 */
export function RequireAuth({ children, roles }: RequireAuthProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const hasRole =
    roles === undefined || (user !== null && roles.includes(user.platformRole));

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated) {
      router.replace("/login");
    } else if (!hasRole) {
      // Signed in but not permitted here: send them somewhere they can be.
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, hasRole, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!isAuthenticated || !hasRole) {
    return null;
  }

  return <>{children}</>;
}
