import { expect } from "vitest";

/**
 * The checks that catch the class of bug builds cannot see.
 *
 * TypeScript cannot help here. A response reaches the app through an unchecked cast,
 * so the compiler believes whatever the type says while the wire carries something
 * else. That is exactly how an enum serialised as a number survived four phases: the
 * field was present, the response parsed, and every comparison against a name
 * silently answered false.
 *
 * So these assert on values, not on types.
 */

/**
 * The member of a string union, as a value.
 *
 * The single most valuable check in this suite. Any enum arriving as a number, or as
 * a name the frontend does not know, fails here rather than turning into a branch
 * that never runs.
 */
export function expectUnion<T extends string>(
  actual: unknown,
  allowed: readonly T[],
  field: string,
): asserts actual is T {
  expect(
    typeof actual,
    `${field} should arrive as a string, not ${typeof actual} (${JSON.stringify(actual)}). ` +
      "A number here means the API is serialising an enum by value.",
  ).toBe("string");

  expect(
    allowed as readonly string[],
    `${field} was ${JSON.stringify(actual)}, which the frontend has no case for.`,
  ).toContain(actual as string);
}

/** A field that must be present and a number, including zero. */
export function expectNumber(actual: unknown, field: string): asserts actual is number {
  expect(typeof actual, `${field} should be a number, got ${typeof actual}`).toBe(
    "number",
  );
  expect(Number.isFinite(actual as number), `${field} should be finite`).toBe(true);
}

/** A field that must be present and a non-empty string. */
export function expectText(actual: unknown, field: string): asserts actual is string {
  expect(typeof actual, `${field} should be a string, got ${typeof actual}`).toBe(
    "string",
  );
  expect((actual as string).length, `${field} should not be empty`).toBeGreaterThan(0);
}

/** A field that must be a parseable instant. */
export function expectInstant(actual: unknown, field: string): asserts actual is string {
  expectText(actual, field);
  expect(
    Number.isNaN(new Date(actual as string).getTime()),
    `${field} was ${JSON.stringify(actual)}, which is not a date the browser can read`,
  ).toBe(false);
}

/** A field that must be a boolean rather than a truthy stand-in. */
export function expectFlag(actual: unknown, field: string): asserts actual is boolean {
  expect(typeof actual, `${field} should be a boolean, got ${typeof actual}`).toBe(
    "boolean",
  );
}

/**
 * A nullable field: either genuinely null, or valid.
 *
 * Undefined is not accepted. The frontend narrows these with `!== null`, so a missing
 * key would slip through that check and blow up further down.
 */
export function expectNullable(
  actual: unknown,
  field: string,
  check: (value: unknown, field: string) => void,
): void {
  expect(actual === undefined, `${field} should be present, even if null`).toBe(false);

  if (actual !== null) {
    check(actual, field);
  }
}

/** Every key the frontend reads must exist, even when its value is null. */
export function expectKeys(actual: object, keys: readonly string[], what: string): void {
  for (const key of keys) {
    expect(
      Object.hasOwn(actual, key),
      `${what} is missing "${key}", which the frontend reads`,
    ).toBe(true);
  }
}

/**
 * The first element of a collection the API should not have returned empty.
 *
 * `noUncheckedIndexedAccess` is on, so indexing gives `T | undefined` and a test that
 * reached straight for `[0]` would either not compile or lie about what it checked.
 * This makes the emptiness itself an assertion with a message, which is usually the
 * more useful failure anyway.
 */
export function first<T>(items: readonly T[], what: string): T {
  expect(items.length, `${what} should not be empty`).toBeGreaterThan(0);

  return items[0] as T;
}

/**
 * The one element matching a predicate, asserted to exist.
 *
 * Used wherever a test has just created something and needs it back out of a list.
 */
export function only<T>(
  items: readonly T[],
  match: (item: T) => boolean,
  what: string,
): T {
  const found = items.find(match);

  expect(found, `${what} should be present`).toBeDefined();

  return found as T;
}
