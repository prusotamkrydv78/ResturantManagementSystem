import { env } from "@/lib/config/env";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "@/lib/auth/token-store";
import type { AuthResponse } from "@/types/auth";

/** Path of the endpoint that exchanges the refresh cookie for a new access token. */
const REFRESH_PATH = "/api/auth/refresh";

/**
 * Error carrying the HTTP status, the problem detail, and any per-field validation
 * messages so a form can show them next to the offending input.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Whether a failure means the caller manages no restaurant yet.
 *
 * Only sound for a route that carries no identifier of its own, such as
 * `/api/restaurants/mine` or a collection like `/api/tables`. On those, the only
 * thing the server can fail to find is the restaurant behind the account, so a 404
 * is a legitimate state rather than something going wrong.
 *
 * Worth telling apart, because the two need opposite treatment: a genuine error
 * gets a red panel and a retry, and a manager waiting to be assigned a restaurant
 * gets a calm explanation and no button, since retrying will never help.
 */
export function isMissingRestaurant(caught: unknown): boolean {
  return caught instanceof ApiError && caught.status === 404;
}

/** Options accepted by {@link apiFetch} on top of the standard fetch options. */
export interface ApiRequestOptions extends RequestInit {
  /** Attach the in-memory access token. Defaults to true. */
  auth?: boolean;
  /**
   * Internal guard: set once a request has already been retried after a refresh,
   * so a repeatedly failing endpoint cannot cause an endless refresh loop.
   */
  skipRefresh?: boolean;
}

/**
 * A single in-flight refresh call, shared by every caller that needs one at the
 * same moment. Without it, N concurrent 401s (or a session restore racing a 401)
 * would fire N refreshes, and server-side rotation would invalidate all but one.
 */
let refreshInFlight: Promise<AuthResponse | null> | null = null;

/**
 * Exchanges the HttpOnly refresh cookie for a new access token.
 *
 * Returns the full response so callers can also restore the user, or null when
 * there is no usable session. On failure the access token is cleared, which
 * notifies the auth context.
 *
 * Concurrent calls share one request.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${env.apiUrl}${REFRESH_PATH}`, {
        method: "POST",
        // Sends the HttpOnly refresh cookie.
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        clearAccessToken();
        return null;
      }

      const payload = (await response.json()) as AuthResponse;
      setAccessToken(payload.accessToken);
      return payload;
    } catch {
      clearAccessToken();
      return null;
    } finally {
      // Release the lock so a later 401 can refresh again.
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * Fetch wrapper for the backend API.
 *
 * Attaches the in-memory access token, and on a 401 attempts exactly one token
 * refresh before retrying the original request once. If the refresh fails, the
 * authentication state is cleared.
 */
export async function apiFetch<TResponse>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  const { auth = true, skipRefresh = false, ...init } = options;

  const response = await sendRequest(path, init, auth);

  // Only authenticated requests are worth refreshing for, only once per call, and
  // never for the refresh endpoint itself.
  if (response.status === 401 && auth && !skipRefresh && path !== REFRESH_PATH) {
    const refreshed = await refreshSession();

    if (refreshed === null) {
      throw new ApiError("Session expired.", 401);
    }

    // Retry once with the new token; skipRefresh stops any further attempt.
    return apiFetch<TResponse>(path, { ...options, skipRefresh: true });
  }

  if (!response.ok) {
    const { message, fieldErrors } = await readError(response);
    throw new ApiError(message, response.status, fieldErrors);
  }

  return (await readBody<TResponse>(response)) as TResponse;
}

async function sendRequest(
  path: string,
  init: RequestInit,
  auth: boolean,
): Promise<Response> {
  const headers = new Headers(init.headers);

  // FormData is the exception: the browser has to set this header itself, because
  // only it knows the multipart boundary it generated. Setting it here would produce
  // a body the server cannot parse.
  if (
    !headers.has("Content-Type") &&
    init.body !== undefined &&
    !(init.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (auth) {
    const token = getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  return fetch(`${env.apiUrl}${path}`, {
    ...init,
    headers,
    // Needed so the refresh cookie reaches the auth routes that require it.
    credentials: "include",
  });
}

/**
 * Pulls a summary message and any per-field messages out of a ProblemDetails or
 * validation response. Field keys arrive PascalCase from the API and are lowered
 * on the first letter so they match the client field names.
 */
async function readError(
  response: Response,
): Promise<{ message: string; fieldErrors: Record<string, string[]> }> {
  const fallback = `Request failed (${response.status}).`;

  try {
    const problem = (await response.json()) as {
      detail?: string;
      title?: string;
      errors?: Record<string, string[]>;
    };

    const fieldErrors: Record<string, string[]> = {};

    if (problem.errors) {
      for (const [key, messages] of Object.entries(problem.errors)) {
        fieldErrors[key.charAt(0).toLowerCase() + key.slice(1)] = messages;
      }
    }

    const firstFieldMessage = Object.values(fieldErrors).flat()[0];

    return {
      message: firstFieldMessage ?? problem.detail ?? problem.title ?? fallback,
      fieldErrors,
    };
  } catch {
    return { message: fallback, fieldErrors: {} };
  }
}

/** Reads the body as JSON, tolerating the empty 204 responses the API returns. */
async function readBody<TResponse>(
  response: Response,
): Promise<TResponse | undefined> {
  if (response.status === 204) {
    return undefined;
  }

  const text = await response.text();
  return text ? (JSON.parse(text) as TResponse) : undefined;
}
