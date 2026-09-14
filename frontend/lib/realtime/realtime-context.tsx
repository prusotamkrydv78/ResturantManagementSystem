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
  type HubConnection,
} from "@microsoft/signalr";
import { useAuth } from "@/features/auth/auth-context";
import { getAccessToken } from "@/lib/auth/token-store";
import { env } from "@/lib/config/env";

/**
 * The live connection to the restaurant's own service.
 *
 * One socket for the whole app rather than one per screen. Which events reach it is
 * decided entirely by the server from who signed in - a waiter is put in the floor
 * group, a chef in the kitchen group - so there is nothing to subscribe to from here
 * and no way for a client to ask for another restaurant's traffic.
 *
 * Deliberately additive. Every screen still loads its own data through the ordinary
 * endpoints and two of them still poll, because a socket is the thing most likely to be
 * missing: a phone in a pocket, a tunnel, a laptop that slept. This makes the good case
 * instant and leaves the bad case exactly as it was.
 *
 * Events are handed out through a small subscription rather than React state on purpose.
 * A dozen screens re-rendering because a ticket somewhere changed would be worse than
 * the twenty second poll it replaced; instead each screen says which events it cares
 * about and decides for itself what to do about one.
 */

/** A handler for one named event. */
type Handler = (payload: unknown) => void;

interface RealtimeContextValue {
  /**
   * Listens for one event for as long as the caller is mounted.
   *
   * Returns the unsubscribe, so it composes with an effect's cleanup.
   */
  subscribe: (eventName: string, handler: Handler) => () => void;
  /** Whether the socket is currently up. Shown to staff, not acted on. */
  connected: boolean;
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
 * Opens the connection while somebody is signed in.
 *
 * Torn down on sign-out, because the groups a connection sits in were decided from the
 * account that opened it - keeping it alive across a change of user would keep
 * delivering the previous one's restaurant.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [connected, setConnected] = useState(false);

  // Handlers live in a ref, so subscribing does not re-render anybody and does not
  // rebuild the connection. The socket is expensive; a listener is not.
  const handlers = useRef(new Map<string, Set<Handler>>());

  const subscribe = useCallback((eventName: string, handler: Handler) => {
    const existing = handlers.current.get(eventName) ?? new Set<Handler>();

    existing.add(handler);
    handlers.current.set(eventName, existing);

    return () => {
      existing.delete(handler);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let connection: HubConnection | null = null;
    let disposed = false;

    async function open() {
      const built = new HubConnectionBuilder()
        .withUrl(`${env.apiUrl}/hubs/operations`, {
          // Read fresh on every connect and reconnect rather than captured once. The
          // access token is short lived and the refresh flow replaces it in place, so a
          // captured one would fail every reconnection after the first few minutes.
          accessTokenFactory: () => getAccessToken() ?? "",
        })
        // Backs off on its own: a restaurant's wifi drops, and a waiter should not have
        // to reload the app to start hearing about their tables again.
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(LogLevel.Warning)
        .build();

      // Registered before starting, so nothing sent during the handshake is missed.
      for (const eventName of REALTIME_EVENTS) {
        built.on(eventName, (payload: unknown) => {
          for (const handler of handlers.current.get(eventName) ?? []) {
            try {
              handler(payload);
            } catch {
              // One screen's handler throwing must not stop the others from hearing it.
            }
          }
        });
      }

      built.onreconnected(() => setConnected(true));
      built.onreconnecting(() => setConnected(false));
      built.onclose(() => setConnected(false));

      try {
        await built.start();

        if (disposed) {
          // Signed out while the handshake was in flight.
          await built.stop();

          return;
        }

        connection = built;
        setConnected(true);
      } catch {
        // Nothing to report and nothing to retry by hand. The screens all poll or
        // reload for themselves, so a failed socket costs freshness and not function.
        setConnected(false);
      }
    }

    void open();

    return () => {
      disposed = true;
      setConnected(false);

      if (connection !== null && connection.state !== HubConnectionState.Disconnected) {
        void connection.stop();
      }
    };
  }, [isAuthenticated]);

  const value = useMemo(() => ({ subscribe, connected }), [subscribe, connected]);

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

/** Whether the live connection is up. */
export function useRealtimeConnected(): boolean {
  return useContext(RealtimeContext)?.connected ?? false;
}
