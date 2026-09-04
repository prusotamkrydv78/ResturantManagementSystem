/**
 * How far along a customer's own order is, and how to say it to them.
 *
 * The stages come from the server; every word here is the client's. That split is
 * deliberate: a server deciding how a phone reads would be the one part of this product
 * that could not be translated, and the wording is the part most likely to change.
 *
 * Nothing here mentions a waiter, a chef, a ticket or a table. A guest waiting for food
 * wants to know where their food is, and which member of staff pressed which button is a
 * fact about the restaurant's staff.
 */

/** The stages, in the order they happen. Mirrors CustomerOrderStage on the API. */
export const ORDER_STAGES = [
  "Confirmed",
  "WithKitchen",
  "BeingPrepared",
  "Ready",
  "Served",
] as const;

export type OrderStage = (typeof ORDER_STAGES)[number];

/** One step forward on a customer's order, as it arrives from the hub. */
export interface CustomerOrderUpdate {
  orderNumber: number;
  stage: OrderStage;
}

/** How each stage reads on a phone. */
export const STAGE_COPY: Record<
  OrderStage,
  { title: string; detail: string; done: string }
> = {
  Confirmed: {
    title: "Your order is confirmed",
    detail: "A member of staff has checked it over. It is going to the kitchen next.",
    done: "Confirmed with a member of staff",
  },
  WithKitchen: {
    title: "The kitchen has your order",
    detail: "It is in the queue to be cooked.",
    done: "Sent to the kitchen",
  },
  BeingPrepared: {
    title: "Your food is being cooked",
    detail: "The kitchen has started on it.",
    done: "Being cooked",
  },
  Ready: {
    title: "Your food is ready",
    detail: "It is coming out to you now.",
    done: "Ready",
  },
  Served: {
    title: "Enjoy your meal",
    detail: "Everything you ordered has been brought over.",
    done: "Brought to your table",
  },
};

/**
 * Whether one stage is at least as far along as another.
 *
 * Used to keep the timeline monotonic. Events can in principle arrive out of order - a
 * dropped socket reconnecting, or two tickets on one order moving independently - and a
 * progress bar that goes backwards makes a guest think something has gone wrong.
 */
export function isAtLeast(current: OrderStage | null, target: OrderStage): boolean {
  if (current === null) {
    return false;
  }

  return ORDER_STAGES.indexOf(current) >= ORDER_STAGES.indexOf(target);
}

/** The later of two stages, so progress only ever moves forward. */
export function furthest(
  a: OrderStage | null,
  b: OrderStage,
): OrderStage {
  return a === null || ORDER_STAGES.indexOf(b) > ORDER_STAGES.indexOf(a) ? b : a;
}
