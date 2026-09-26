/**
 * The hour it is in Nepal, from the clock the server sent.
 *
 * Read off the server rather than the browser deliberately: an admin looking at this
 * from another country still needs the column that is lit to be the hour the
 * restaurants are living in, not the hour their own laptop thinks it is.
 */
export function nepalHourOf(serverUtcNow: string): number {
  const parsed = new Date(serverUtcNow).getTime();

  if (Number.isNaN(parsed)) {
    return -1;
  }

  return new Date(parsed + NEPAL_OFFSET_MINUTES * 60_000).getUTCHours();
}

/** UTC+05:45. The one boundary every daily figure in this product is counted against. */
export const NEPAL_OFFSET_MINUTES = 345;
