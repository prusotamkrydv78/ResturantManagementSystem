"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as authApi from "@/features/auth/api";
import {
  clearAccessToken,
  onAccessTokenCleared,
  setAccessToken,
} from "@/lib/auth/token-store";
import type { AuthUser, LoginPayload } from "@/types/auth";

interface AuthContextValue {
  /** The signed-in user, or null when anonymous. */
  user: AuthUser | null;
  /** True until the initial session restore attempt has finished. */
  isLoading: boolean;
  /** Convenience flag derived from {@link AuthContextValue.user}. */
  isAuthenticated: boolean;
  /**
   * Signs in and returns the account.
   *
   * Returns it rather than only storing it, because the caller usually needs to
   * route on the role immediately and the context has not re-rendered by the time
   * the awaiting handler continues.
   */
  signIn: (payload: LoginPayload) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  /**
   * Re-reads the signed-in account from the API.
   *
   * For the one screen that can edit it. Without this, changing your own name leaves
   * the greeting in the header addressing whoever you used to be until the next full
   * page load, which reads as the change not having worked.
   */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Holds the authenticated user for the app.
 *
 * On mount it tries to restore the session through the refresh endpoint, which
 * succeeds while the browser still holds a valid HttpOnly refresh cookie. That is
 * what makes a session survive a page reload without the access token ever being
 * written to persistent storage.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      // Returns null rather than throwing when there is no usable cookie, which
      // is the normal path on a first visit.
      const restored = await authApi.refreshSession();

      if (cancelled) {
        return;
      }

      setUser(restored?.user ?? null);
      setIsLoading(false);
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // The API client clears the token when a refresh fails mid-session; drop the
  // user here too so protected pages react immediately.
  useEffect(() => onAccessTokenCleared(() => setUser(null)), []);

  const signIn = useCallback(async (payload: LoginPayload) => {
    const result = await authApi.login(payload);
    setAccessToken(result.accessToken);
    setUser(result.user);

    return result.user;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // Clear locally even if the call failed, so the UI never shows a session
      // the user has asked to end.
      clearAccessToken();
      setUser(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    setUser(await authApi.getCurrentUser());
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      signIn,
      signOut,
      refresh,
    }),
    [user, isLoading, signIn, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Reads the authentication context. Throws when used outside the provider. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error("useAuth must be used inside an AuthProvider.");
  }

  return context;
}
