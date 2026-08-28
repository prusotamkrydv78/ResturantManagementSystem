/**
 * Joins conditional class names. Avoids pulling in a dependency for something
 * this small; swap for clsx/tailwind-merge if variant handling grows.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
