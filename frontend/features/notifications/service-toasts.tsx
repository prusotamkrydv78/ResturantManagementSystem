"use client";

import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/auth-context";
import {
  useRealtimeEvent,
  type OrderConfirmedPayload,
  type OrderPlacedPayload,
  type TicketPayload,
} from "@/lib/realtime/realtime-context";

/**
 * Turns what happened in the restaurant into something a person notices.
 *
 * Mounted once in the authenticated shell, so a waiter hears about a table wherever
 * they happen to be in the app - which is the entire point. A notification that only
 * arrives on the page it concerns is a notification nobody needed.
 *
 * Renders nothing. It exists purely to listen.
 *
 * The judgement here is about what deserves an interruption, and most things do not.
 * The server already decides who hears what by role, and this narrows it further to the
 * events somebody has to act on:
 *
 *   a customer ordered          - alert, because a person is sitting there waiting
 *   food is at the pass         - alert, because it is going cold
 *   a ticket reached the rail   - quiet, because the chef is looking at the rail
 *   somebody else confirmed     - quiet, so two waiters do not walk to one table
 *   somebody else served        - silent, it is only there to clear a stale toast
 *
 * The alternative - a chime for all six - trains people to ignore the sound, and then
 * the two that mattered are lost with the rest.
 */
export function ServiceToasts() {
  const { notify } = useToast();
  const { user } = useAuth();

  // The name is how "somebody else did this" is told apart from "I did this". Without
  // it a waiter confirming an order is immediately congratulated on confirming it.
  const me = user?.fullName;

  useRealtimeEvent<OrderPlacedPayload>("orderPlaced", (event) => {
    notify({
      tone: "alert",
      title: `${event.tableName} ordered from their phone`,
      description: `Order #${event.orderNumber} · ${event.itemCount} ${
        event.itemCount === 1 ? "item" : "items"
      } · ${event.subtotal.toFixed(2)} — check it with them to confirm`,
      href: `/orders/${event.orderId}`,
      actionLabel: "Open the order",
      // Held longer than the rest. This is the one where nobody has done anything yet,
      // and a waiter mid-table needs it to still be there when they look up.
      duration: 12000,
      dedupeKey: `order:${event.orderId}`,
    });
  });

  useRealtimeEvent<OrderConfirmedPayload>("orderConfirmed", (event) => {
    // The person who confirmed it does not need telling. They pressed the button and
    // watched the panel disappear.
    if (event.confirmedByName === me) {
      return;
    }

    notify({
      tone: "info",
      title: `${event.tableName} is confirmed`,
      description: `${event.confirmedByName} agreed order #${event.orderNumber} with the table.`,
      // Quiet: it exists so nobody walks to a table somebody else has handled, which
      // does not warrant a sound.
      silent: true,
      duration: 5000,
      dedupeKey: `order:${event.orderId}`,
    });
  });

  useRealtimeEvent<TicketPayload>("ticketQueued", (event) => {
    notify({
      tone: "info",
      title: `KOT #${event.ticketNumber} · ${event.tableName}`,
      description: `${event.itemCount} ${
        event.itemCount === 1 ? "item" : "items"
      } just came in.`,
      href: "/kitchen",
      actionLabel: "Open the rail",
      duration: 6000,
      dedupeKey: `ticket:${event.ticketId}`,
    });
  });

  useRealtimeEvent<TicketPayload>("ticketStarted", (event) => {
    notify({
      tone: "info",
      title: `KOT #${event.ticketNumber} started`,
      description: `${event.tableName} is being cooked.`,
      // Silent and short. Its only job is to stop a second chef reaching for the same
      // ticket, and the rail beside it already shows the change.
      silent: true,
      duration: 4000,
      dedupeKey: `ticket:${event.ticketId}`,
    });
  });

  useRealtimeEvent<TicketPayload>("ticketReady", (event) => {
    notify({
      tone: "alert",
      title: `${event.tableName} is ready to go out`,
      description: `KOT #${event.ticketNumber} · ${event.itemCount} ${
        event.itemCount === 1 ? "item" : "items"
      } waiting at the pass`,
      href: "/pass",
      actionLabel: "Open the pass",
      duration: 12000,
      dedupeKey: `ticket:${event.ticketId}`,
    });
  });

  useRealtimeEvent<TicketPayload>("ticketServed", (event) => {
    // Deliberately quiet and brief. Its real work is the dedupe key: it replaces the
    // "ready to go out" toast for this ticket, so a waiter who is still holding a stale
    // alert for food a colleague already carried sees it resolve rather than chasing it.
    notify({
      tone: "success",
      title: `${event.tableName} served`,
      description: `KOT #${event.ticketNumber} went out.`,
      silent: true,
      duration: 3500,
      dedupeKey: `ticket:${event.ticketId}`,
    });
  });

  return null;
}
