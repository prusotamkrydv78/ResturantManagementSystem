import type { StaffRole } from "@/types/staff";

/**
 * Platform-level role: what part of the product an account can reach.
 *
 * Distinct from a staff member operational role (Waiter, Chef, Cashier), which
 * lives in types/staff.ts and describes what they do on the floor.
 */
export type PlatformRole = "User" | "SuperAdmin" | "RestaurantManager" | "Staff";

/** The authenticated user as returned by the backend. */
export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  platformRole: PlatformRole;
  /**
   * What a staff member does on the floor, or null for anyone who is not staff.
   * Used to pick the right workspace; never the basis for authorization, which the
   * API decides for itself.
   */
  staffRole: StaffRole | null;
}

/**
 * Response of the login and refresh endpoints. The refresh token is deliberately
 * absent: it lives only in an HttpOnly cookie.
 */
export interface AuthResponse {
  accessToken: string;
  accessTokenExpiresAtUtc: string;
  user: AuthUser;
}

/** Credentials for signing in. */
export interface LoginPayload {
  email: string;
  password: string;
}
