/**
 * The message to show for a failed query, or null while there is none.
 *
 * Queries hand back an unknown error; screens want a sentence.
 */
export function errorMessage(error: unknown, fallback: string): string | null {
  if (error === null || error === undefined) {
    return null;
  }

  return error instanceof Error ? error.message : fallback;
}
