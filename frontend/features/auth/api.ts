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

/**
 * Changes the signed-in account's own name and email.
 *
 * Every account in the product has somebody who can maintain it for them — a manager
 * has the platform administrator, staff have their manager — except the platform
 * administrator, who has nobody. These three calls exist so the account at the top of
 * the tree is not the only one that cannot be maintained from inside the product.
 */
export function updateMyProfile(payload: {
  fullName: string;
  email: string;
}): Promise<AuthUser> {
  return apiFetch<AuthUser>("/api/auth/me", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/**
 * Replaces the signed-in account's own password.
 *
 * Asks for the current one, unlike an administrator resetting somebody else: a stolen
 * access token would otherwise be enough to take an account permanently, and a token
 * is the easier of the two to steal. Every session is revoked on success, this one
 * included, so the caller has to sign in again.
 */
export function changeMyPassword(payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  return apiFetch<void>("/api/auth/me/password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Revokes every refresh token this account holds, on every device. */
export function signOutEverywhere(): Promise<{ sessionsEnded: number }> {
  return apiFetch<{ sessionsEnded: number }>("/api/auth/me/sign-out-everywhere", {
    method: "POST",
  });
}
