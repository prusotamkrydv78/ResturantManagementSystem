/**
 * Holds the access token in module memory only.
 *
 * It is never written to localStorage or sessionStorage, so a XSS payload cannot
 * read it out of persistent storage and it disappears when the tab closes. The
 * session survives a page reload through the HttpOnly refresh cookie instead.
 */

let accessToken: string | null = null;

/** Listeners notified when the token is cleared, so UI state can follow. */
const clearListeners = new Set<() => void>();

/** Returns the current access token, or null when not signed in. */
export function getAccessToken(): string | null {
  return accessToken;
}

/** Stores the access token in memory. */
/**
 * Whether a token is gone or will be within the next minute.
 *
 * Read from the token's own expiry claim. Nothing is trusted from it - the server
 * verifies the signature on every use - this only decides whether it is worth
 * presenting or should be refreshed first.
 *
 * Anything unreadable counts as expiring, so the answer to a malformed token is a
 * refresh rather than a request that is bound to be refused.
 */
export function isAccessTokenExpiring(token: string, marginSeconds = 60): boolean {
  try {
    const part = token.split(".")[1];

    if (part === undefined) return true;

    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const { exp } = JSON.parse(json) as { exp?: unknown };

    return typeof exp !== "number" || exp * 1000 - Date.now() < marginSeconds * 1000;
  } catch {
    return true;
  }
}

export function setAccessToken(token: string): void {
  accessToken = token;
}

/** Drops the access token and notifies listeners. */
export function clearAccessToken(): void {
  accessToken = null;
  for (const listener of clearListeners) {
    listener();
  }
}

/**
 * Registers a callback invoked whenever the token is cleared. Returns an
 * unsubscribe function suitable for use as a React effect cleanup.
 */
export function onAccessTokenCleared(listener: () => void): () => void {
  clearListeners.add(listener);

  return () => {
    clearListeners.delete(listener);
  };
}
