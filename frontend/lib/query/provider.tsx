"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { onAccessTokenCleared } from "@/lib/auth/token-store";

/**
 * One cache for every screen.
 *
 * WHY THIS EXISTS
 *
 * Every screen used to fetch its own data in an effect when it mounted and throw it
 * away when it unmounted. Navigating is unmounting, so moving from the restaurants
 * list to a restaurant and back fetched the list again from nothing - a skeleton, a
 * request, then the page - every time. That round trip was the flicker between routes.
 *
 * With a shared cache a screen that has been seen renders at once from what is
 * already known, and refreshes behind the page if the data is old enough to be worth
 * asking again. Two screens that need the same list share one request rather than
 * sending two.
 *
 * THE DEFAULTS
 *
 * Thirty seconds before data counts as stale: long enough that moving between pages
 * does not refetch, short enough that a figure on screen is never far behind. Window
 * focus refetches stale data, which replaces the hand-written focus listeners that
 * several screens carried. A 4xx is an answer rather than a failure - a missing
 * restaurant stays missing - so only server and network errors are retried, once.
 */
function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status < 500) && failureCount < 1,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Created once per browser tab, in state rather than at module scope, so a
  // server render never shares a cache between two visitors.
  const [client] = useState(createClient);

  // The cache belongs to the account that filled it. Signing out - or a refresh
  // that fails - empties it, so the next person to sign in on this machine never
  // sees the previous one's restaurants for a frame before their own arrive.
  useEffect(() => onAccessTokenCleared(() => client.clear()), [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
