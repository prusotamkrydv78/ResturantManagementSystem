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
