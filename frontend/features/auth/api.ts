import { apiFetch, refreshSession } from "@/lib/api/client";
import type { AuthResponse, AuthUser, LoginPayload } from "@/types/auth";

/**
 * Every authentication call the frontend makes, in one place. Components go
 * through the auth context rather than calling these directly.
 *
 * There is no call to create an account, because the product has no way to. A
 * platform administrator issues a restaurant its manager, and that manager issues
 * their own staff; every account therefore arrives already attached to a restaurant
 * and a role.
 */

/** Signs in with email and password. */
export function login(payload: LoginPayload): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
    auth: false,
  });
}

/** Revokes the refresh token and clears the cookie. */
export function logout(): Promise<void> {
  return apiFetch<void>("/api/auth/logout", {
    method: "POST",
    auth: false,
  });
}

/** Loads the user the access token belongs to. */
export function getCurrentUser(): Promise<AuthUser> {
  return apiFetch<AuthUser>("/api/auth/me");
}

/**
 * Restores a session from the refresh cookie. Re-exported from the API client so
 * every refresh in the app shares the same de-duplicated request.
 */
export { refreshSession };
