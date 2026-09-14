/**
 * How the platform screens write numbers and dates.
 *
 * Gathered because five files had grown their own `money` and three their own
 * `formatDate`, and the copies had already drifted: some rounded to whole units,
 * some to two places, and one took the precision as an argument. A reader comparing
 * a figure on the report with the same figure on a restaurant page should not have to
 * work out which of them is rounding.
 */

/**
 * An amount, grouped.
 *
 * Whole units by default, because that is what a chart label and a table column want:
 * two decimal places on a fortnight of takings is four characters of noise in a figure
 * nobody is reconciling. Ask for decimals where the paisa genuinely count — a receipt,
 * a bill, the headline on a financial report.
 */
export function money(amount: number, decimals = 0): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** A date, written the way it is said. Em dash when the server sent nothing usable. */
export function formatDate(isoString: string): string {
  const parsed = new Date(isoString);

  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

/** A clock time, to the minute. */
export function formatTime(isoString: string): string {
  const parsed = new Date(isoString);

  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
