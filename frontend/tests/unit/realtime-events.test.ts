import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { REALTIME_EVENTS } from "@/lib/realtime/realtime-context";

/**
 * The client listens for exactly what the server sends.
 *
 * This exists because it did not, and the failure was invisible: the provider calls
 * connection.on once per name in REALTIME_EVENTS, so an event the server sends and the
 * list omits is dropped in silence. "ticketRecalled" was missing for long enough that
 * a recalled ticket appeared to be a server bug, was investigated as one, and was
 * reported fixed twice.
 *
 * Read out of the C# rather than duplicated here, so the two cannot drift apart
 * without this failing.
 */
describe("realtime event names", () => {
  const source = readFileSync(
    "../backend/src/RestaurantManagement.Application/Realtime/RealtimeEvents.cs",
    "utf8",
  );

  const sent = [...source.matchAll(/public const string \w+ = "(\w+)";/g)]
    .map((match) => match[1])
    .filter((name): name is string => name !== undefined);

  it("finds the server names", () => {
    expect(sent.length).toBeGreaterThan(5);
  });

  it("listens for every event the operations hub can send", () => {
    // The customer hub is a separate connection with its own handler, so it is not
    // part of this contract.
    const operational = sent.filter((name) => name !== "customerOrderUpdate");
    const missing = operational.filter(
      (name) => !(REALTIME_EVENTS as readonly string[]).includes(name),
    );

    expect(missing).toEqual([]);
  });
});
