"use client";

import { useEffect, useRef, useState } from "react";
import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
  type HubConnection,
} from "@microsoft/signalr";
import { env } from "@/lib/config/env";
import {
  furthest,
  type CustomerOrderUpdate,
  type OrderStage,
} from "@/features/public/order-progress";

/**
 * Follows a customer's own order while they have the page open.
 *
 * Anonymous, because a customer has no account anywhere in this product. What they have
 * is the key handed back when they placed the order, and presenting it to the hub is what
 * puts the connection in that order's group. Until it is accepted the socket is in no
 * group and receives nothing, so being connected grants nothing on its own.
 *
 * Only ever the one order. There is no way from here to ask about another, because the
 * group is chosen by the server from the key rather than named by the client.
 *
 * Entirely optional, like every other realtime path in this product. A blocked websocket
 * or a sleeping phone leaves the receipt exactly as it was.
 */

/** What the hub answers when a key is accepted. */
interface WatchHandle {
  orderNumber: number;
  /** Where the order already stands, or null when nothing has happened to it yet. */
  stage: OrderStage | null;
}

export function useOrderUpdates({
  slug,
  orderKey,
  onUpdate,
}: {
  slug: string;
  /** The key from placing the order, or null when there is nothing to follow. */
  orderKey: string | null;
  /**
   * Called for each step forward, for a toast. Held in a ref internally, so an inline
   * arrow does not tear the connection down and rebuild it on every render.
   *
   * Only for steps that arrive while the page is open. The stage the order was already
   * at when the page loaded is not announced: telling somebody their food is ready the
   * instant they open a page, about something that happened twenty minutes ago, is a
   * notification about the past.
   */
  onUpdate?: (update: CustomerOrderUpdate) => void;
}): {
  /** The furthest stage reached, or null while nothing has happened yet. */
  stage: OrderStage | null;
  /** Whether the socket is up and following the order. */
  live: boolean;
  /**
   * Whether the restaurant says this order is no longer running.
   *
   * Told apart from a failed connection deliberately. A settled, cancelled or unknown
   * order will never come back, so the page can offer to start a fresh one instead of
   * showing a receipt that can no longer do anything.
   */
  closed: boolean;
} {
  const [stage, setStage] = useState<OrderStage | null>(null);
  const [live, setLive] = useState(false);
  const [closed, setClosed] = useState(false);
  const latest = useRef(onUpdate);

  useEffect(() => {
    latest.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (orderKey === null) {
      return;
    }

    let connection: HubConnection | null = null;
    let disposed = false;

    async function open() {
      const built = new HubConnectionBuilder()
        .withUrl(`${env.apiUrl}/hubs/customer`)
        .withAutomaticReconnect([0, 3000, 10000, 30000])
        .configureLogging(LogLevel.Error)
        .build();

      built.on("customerOrderUpdate", (update: CustomerOrderUpdate) => {
        // A cancellation is an ending rather than a step, so it closes the order
        // instead of advancing the rail. Pushing it onto the timeline would draw a
        // line down to steps that are never coming.
        // Bound to a const first: narrowing a property does not survive into the
        // updater closure below, and the compiler is right to say so.
        const next = update.stage;

        if (next === "Cancelled") {
          setClosed(true);
        } else {
          // Only ever forwards. Events can arrive out of order after a reconnection,
          // and a progress bar that goes backwards makes a guest think something broke.
          setStage((current) => furthest(current, next));
        }

        latest.current?.(update);
      });

      // The group is joined by the connection, not by the account, so a reconnection
      // has to ask again - otherwise a phone that went through a tunnel comes back
      // connected and silent, which is the worst of both.
      //
      // The answer also carries where the order has got to, which is how a page that
      // was closed catches up on everything it missed.
      const join = async () => {
        try {
          const handle = await built.invoke<WatchHandle | null>(
            "WatchOrder",
            slug,
            orderKey,
          );

          if (disposed) {
            return false;
          }

          if (handle === null) {
            // The order is not running any more, or the key names nothing. Neither
            // will change, so there is nothing to retry.
            setClosed(true);
            setLive(false);

            return false;
          }

          setClosed(false);

          if (handle.stage !== null) {
            setStage((current) => furthest(current, handle.stage!));
          }

          return true;
        } catch {
          // Unreachable rather than refused. The receipt stands on its own.
          return false;
        }
      };

      built.onreconnected(() => void join().then(setLive));
      built.onreconnecting(() => setLive(false));
      built.onclose(() => setLive(false));

      try {
        await built.start();

        if (disposed) {
          await built.stop();

          return;
        }

        const following = await join();

        if (disposed) {
          await built.stop();

          return;
        }

        connection = built;
        setLive(following);
      } catch {
        setLive(false);
      }
    }

    void open();

    return () => {
      disposed = true;
      setLive(false);

      if (connection !== null && connection.state !== HubConnectionState.Disconnected) {
        void connection.stop();
      }
    };
  }, [slug, orderKey]);

  return { stage, live, closed };
}
