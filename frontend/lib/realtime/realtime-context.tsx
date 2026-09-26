"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
  type IRetryPolicy,
} from "@microsoft/signalr";
import { useAuth } from "@/features/auth/auth-context";
import { refreshSession } from "@/lib/api/client";
import { getAccessToken, isAccessTokenExpiring } from "@/lib/auth/token-store";
import { env } from "@/lib/config/env";

/**
 * The live connection to the restaurant's own service.
 *
 * One socket for the whole app rather than one per screen. Which events reach it is
 * decided entirely by the server from who signed in - a waiter is put in the floor
 * group, a chef in the kitchen group - so there is nothing to subscribe to from here
 * and no way for a client to ask for another restaurant's traffic.
 *
 * Events are handed out through a small subscription rather than React state on purpose.
 * A dozen screens re-rendering because a ticket somewhere changed would be worse than
 * the twenty second poll it replaced; instead each screen says which events it cares
 * about and decides for itself what to do about one.
 *
 * IT DOES NOT GIVE UP
 *
 * The connection used to retry five times over about forty-seven seconds and then stop
 * for good, and never retried at all if the very first attempt failed. That was
 * written when every screen still polled, so a dead socket cost freshness and nothing
 * else. It stopped being true when the order list and the billing queue went fully
 * live: a restaurant's wifi out for a minute, or the API restarting as a tablet opened
 * the app, left those two screens frozen until somebody thought to reload - and nothing
 * on them said so. It now keeps trying for as long as somebody is signed in, tries
 * again at once when the device comes back online or the tab comes back into view, and
 * says when it is down (see LiveUpdatesBanner).
 *
 * AND IT CATCHES UP
 *
 * An event sent while the connection was down is gone; the server does not queue them.
 * So every time the connection comes back after having been up, screens are told to
 * re-read (useRealtimeResync), rather than waiting for an event that already happened.
 */

/** A handler for one named event. */
type Handler = (payload: unknown) => void;

/** A handler for "the connection is back; re-read what you show". */
type ResyncHandler = () => void;

interface RealtimeContextValue {
  /**
   * Listens for one event for as long as the caller is mounted.
   *
   * Returns the unsubscribe, so it composes with an effect's cleanup.
   */
  subscribe: (eventName: string, handler: Handler) => () => void;
  /** Listens for the connection coming back after a gap. */
  subscribeResync: (handler: ResyncHandler) => () => void;
  /** Whether the socket is currently up. */
  connected: boolean;
  /**
   * Whether this account has a live feed at all.
   *
   * A platform administrator belongs to no restaurant, so the server refuses the
   * connection outright - and a client that retried forever would hammer it for
   * nothing and show a "paused" warning that could never clear.
   */
  enabled: boolean;
  /** Skips the wait and tries to reconnect now. */
  retryNow: () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

/** Every event the server can send. Mirrors RealtimeEventNames on the API. */
export const REALTIME_EVENTS = [
  "orderPlaced",
  "orderConfirmed",
  "ticketQueued",
  "ticketStarted",
  "ticketReady",
  // Omitted for a long time, and invisibly: the provider registers one handler per
  // name in this list, so an event the server sends and this list forgets is dropped
  // without a word. A recalled ticket therefore never reached the floor or the rail,
  // which was investigated as a server bug and reported fixed twice before anybody
  // looked here. The unit test beside this file now reads the names out of the C# so
  // the two cannot drift apart again.
  "ticketRecalled",
  "ticketServed",
  "billRequested",
  // The opposite failure: the order list and billing queue subscribed to these for a
  // long time while the server only ever told the guest. Both directions are now
  // covered - the server sends them to staff, and the test holds this list to it.
  "orderSettled",
  "orderCancelled",
] as const;

/** A customer's order landing on the floor. */
export interface OrderPlacedPayload {
  orderId: string;
  orderNumber: number;
  tableName: string;
  itemCount: number;
  subtotal: number;
}

/** A customer's order having been agreed with the table. */
export interface OrderConfirmedPayload {
  orderId: string;
  orderNumber: number;
  tableName: string;
  confirmedByName: string;
}

/** A table asking to pay. */
export interface BillRequestedPayload {
  orderId: string;
  orderNumber: number;
  tableName: string;
  total: number;
}

/** An order leaving the floor: paid in full, or called off. */
export interface OrderClosedPayload {
  orderId: string;
  orderNumber: number;
}

/** A ticket moving through the kitchen, and then off it. */
export interface TicketPayload {
  ticketId: string;
  ticketNumber: number;
  orderId: string;
  orderNumber: number;
  tableName: string;
  itemCount: number;
  /**
   * How many units are cooked and still sitting at the pass.
   *
   * Not the same as `itemCount`, and the difference is what per-dish progress is for.
   * A slip of momo and samosa announces itself when the samosa is done, and saying
   * "3 items waiting" when one of them is would send a waiter looking for food that
   * is still on the stove.
   */
  waitingAtPassCount: number;
  /** Whether every dish on the ticket is cooked. */
  isFullyReady: boolean;
}

/**
 * How long to wait before each attempt, and then forever after the last.
 *
 * Quick at first, because most drops are a moment of wifi. Capped at thirty seconds,
 * with a little jitter so a dining room of tablets that lost the same router does not
 * reconnect in the same instant when it comes back.
 */
const RETRY_DELAYS_MS = [0, 2_000, 5_000, 10_000];
const MAX_RETRY_DELAY_MS = 30_000;

function retryDelay(attempt: number): number {
  return (
    RETRY_DELAYS_MS[attempt] ?? MAX_RETRY_DELAY_MS + Math.floor(Math.random() * 5_000)
  );
}

/**
 * Never returns null, so SignalR's own reconnect never gives up. Returning null is how
 * the library is told to stop, and the old fixed list of delays did that on its fifth.
 */
const RETRY_FOREVER: IRetryPolicy = {
  nextRetryDelayInMilliseconds: ({ previousRetryCount }) => retryDelay(previousRetryCount),
};

/**
 * Opens the connection while somebody with a live feed is signed in.
 *
 * Torn down on sign-out, because the groups a connection sits in were decided from the
 * account that opened it - keeping it alive across a change of user would keep
 * delivering the previous one's restaurant.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const enabled = isAuthenticated && user !== null && user.platformRole !== "SuperAdmin";

  const [connected, setConnected] = useState(false);

  // Handlers live in refs, so subscribing does not re-render anybody and does not
  // rebuild the connection. The socket is expensive; a listener is not.
  const handlers = useRef(new Map<string, Set<Handler>>());
  const resyncHandlers = useRef(new Set<ResyncHandler>());
  const retryNowRef = useRef<() => void>(() => {});

  const subscribe = useCallback((eventName: string, handler: Handler) => {
    const existing = handlers.current.get(eventName) ?? new Set<Handler>();

    existing.add(handler);
    handlers.current.set(eventName, existing);

    return () => {
      existing.delete(handler);
    };
  }, []);

  const subscribeResync = useCallback((handler: ResyncHandler) => {
    resyncHandlers.current.add(handler);

    return () => {
      resyncHandlers.current.delete(handler);
    };
  }, []);

  const retryNow = useCallback(() => retryNowRef.current(), []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let disposed = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Whether this connection has ever been up. The first success is the screens'
    // own initial load, so it is not a reason to re-read; every one after it is.
    let hasBeenLive = false;

    const connection = new HubConnectionBuilder()
      .withUrl(`${env.apiUrl}/hubs/operations`, {
        // Read fresh on every connect and reconnect rather than captured once. The
        // access token is short lived and the refresh flow replaces it in place, so a
        // captured one would fail every reconnection after the first few minutes.
        //
        // Refreshed here when it is about to lapse. The server closes the connection
        // when its token expires, and the floor and kitchen screens make no other
        // requests while they sit showing live updates - so nothing else would refresh
        // an idle screen's token, and every reconnect would present the expired one and
        // be refused. Skipped while offline, because a refresh that cannot reach the
        // server is treated as signing out.
        accessTokenFactory: async () => {
          const current = getAccessToken();

          if (current !== null && !isAccessTokenExpiring(current)) {
            return current;
          }

          if (typeof navigator !== "undefined" && !navigator.onLine) {
            return current ?? "";
          }

          const session = await refreshSession();

          return session?.accessToken ?? current ?? "";
        },
      })
      .withAutomaticReconnect(RETRY_FOREVER)
      .configureLogging(LogLevel.Warning)
      .build();

    // Registered before starting, so nothing sent during the handshake is missed.
    for (const eventName of REALTIME_EVENTS) {
      connection.on(eventName, (payload: unknown) => {
        for (const handler of handlers.current.get(eventName) ?? []) {
          try {
            handler(payload);
          } catch {
            // One screen's handler throwing must not stop the others from hearing it.
          }
        }
      });
    }

    function markLive() {
      attempt = 0;
      setConnected(true);

      if (hasBeenLive) {
        for (const handler of resyncHandlers.current) {
          try {
            handler();
          } catch {
            // As above: one screen failing to re-read must not stop the rest.
          }
        }
      }

      hasBeenLive = true;
    }

    // SignalR's automatic reconnect only covers a connection that was up and dropped
    // with an error. It does nothing when the first start fails, and nothing when the
    // server closes the connection cleanly - which is how an expired token ends. This
    // covers both, on the same schedule.
    function scheduleStart() {
      if (disposed) {
        return;
      }

      clearTimeout(timer);
      timer = setTimeout(() => void start(), retryDelay(attempt));
      attempt += 1;
    }

    async function start() {
      if (disposed || connection.state !== HubConnectionState.Disconnected) {
        return;
      }

      try {
        await connection.start();

        if (disposed) {
          // Signed out while the handshake was in flight.
          await connection.stop();

          return;
        }

        markLive();
      } catch {
        setConnected(false);
        scheduleStart();
      }
    }

    connection.onreconnecting(() => setConnected(false));
    connection.onreconnected(() => markLive());
    connection.onclose(() => {
      setConnected(false);
      scheduleStart();
    });

    // Waiting out a thirty-second backoff when the device can plainly see the network
    // again is exactly the delay a waiter notices.
    function tryAgainNow() {
      if (disposed || connection.state !== HubConnectionState.Disconnected) {
        return;
      }

      clearTimeout(timer);
      attempt = 0;
      void start();
    }

    function onVisible() {
      if (document.visibilityState === "visible") {
        tryAgainNow();
      }
    }

    retryNowRef.current = tryAgainNow;
    window.addEventListener("online", tryAgainNow);
    document.addEventListener("visibilitychange", onVisible);

    void start();

    return () => {
      disposed = true;
      clearTimeout(timer);
      retryNowRef.current = () => {};
      window.removeEventListener("online", tryAgainNow);
      document.removeEventListener("visibilitychange", onVisible);
      setConnected(false);

      if (connection.state !== HubConnectionState.Disconnected) {
        void connection.stop();
      }
    };
  }, [enabled]);

  const value = useMemo(
    () => ({ subscribe, subscribeResync, connected, enabled, retryNow }),
    [subscribe, subscribeResync, connected, enabled, retryNow],
  );

  return (
    <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
  );
}

/**
 * Reacts to one live event.
 *
 * The handler is held in a ref internally, so a caller can pass an inline arrow without
 * resubscribing on every render - which is the mistake this hook exists to prevent.
 *
 * A no-op outside the provider. A screen rendered on its own should still work; it just
 * will not hear anything.
 */
export function useRealtimeEvent<TPayload>(
  eventName: string,
  handler: (payload: TPayload) => void,
): void {
  const context = useContext(RealtimeContext);
  const latest = useRef(handler);

  useEffect(() => {
    latest.current = handler;
  }, [handler]);

  useEffect(() => {
    if (context === null) {
      return;
    }

    return context.subscribe(eventName, (payload) => {
      latest.current(payload as TPayload);
    });
  }, [context, eventName]);
}

/**
 * Runs when the live connection comes back after a gap.
 *
 * Every screen that keeps itself current from events should re-read here, because the
 * events sent while it was disconnected are not coming. Not called for the first
 * connection: the screen has only just loaded.
 */
export function useRealtimeResync(handler: () => void): void {
  const context = useContext(RealtimeContext);
  const latest = useRef(handler);

  useEffect(() => {
    latest.current = handler;
  }, [handler]);

  useEffect(() => {
    if (context === null) {
      return;
    }

    return context.subscribeResync(() => latest.current());
  }, [context]);
}

/** Whether the live connection is up. */
export function useRealtimeConnected(): boolean {
  return useContext(RealtimeContext)?.connected ?? false;
}

/**
 * The connection's state, for the one component that tells staff about it.
 *
 * Null outside the provider.
 */
export function useRealtimeStatus(): Pick<
  RealtimeContextValue,
  "connected" | "enabled" | "retryNow"
> | null {
  const context = useContext(RealtimeContext);

  return context === null
    ? null
    : { connected: context.connected, enabled: context.enabled, retryNow: context.retryNow };
}
