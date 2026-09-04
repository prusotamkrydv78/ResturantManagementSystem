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
 * Entirely optional, like every other realtime path in this product. A refused key, a
 * blocked websocket or a sleeping phone leaves the receipt exactly as it was - which is
 * why the stage starts as null and the page reads that as "nothing has happened yet"
 * rather than as an error.
 */
export function useOrderUpdates({
  slug,
  cancelKey,
  onUpdate,
}: {
  slug: string;
  /** The key from placing the order, or null when there is nothing to follow. */
  cancelKey: string | null;
  /**
   * Called for each step forward, for a toast. Held in a ref internally, so an inline
   * arrow does not tear the connection down and rebuild it on every render.
   */
  onUpdate?: (update: CustomerOrderUpdate) => void;
}): { stage: OrderStage | null; live: boolean } {
  const [stage, setStage] = useState<OrderStage | null>(null);
  const [live, setLive] = useState(false);
  const latest = useRef(onUpdate);

  useEffect(() => {
    latest.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (cancelKey === null) {
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
        // Only ever forwards. Events can arrive out of order after a reconnection, and
        // a progress bar that goes backwards makes a guest think something broke.
        setStage((current) => furthest(current, update.stage));
        latest.current?.(update);
      });

      // The group is joined by the connection, not by the account, so a reconnection
      // has to ask again - otherwise a phone that went through a tunnel comes back
      // connected and silent, which is the worst of both.
      const rejoin = async () => {
        try {
          await built.invoke<number | null>("WatchOrder", slug, cancelKey);
        } catch {
          // Refused or unreachable. The receipt stands on its own.
        }
      };

      built.onreconnected(() => {
        setLive(true);
        void rejoin();
      });

      built.onreconnecting(() => setLive(false));
      built.onclose(() => setLive(false));

      try {
        await built.start();

        if (disposed) {
          await built.stop();

          return;
        }

        // Null means the key names no order we may follow - a wrong key, a wrong
        // restaurant, or an order already settled or called off. Told apart from a
        // failed connection because there is no point retrying it.
        const watching = await built.invoke<number | null>(
          "WatchOrder",
          slug,
          cancelKey,
        );

        if (disposed) {
          await built.stop();

          return;
        }

        connection = built;
        setLive(watching !== null);
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
  }, [slug, cancelKey]);

  return { stage, live };
}
