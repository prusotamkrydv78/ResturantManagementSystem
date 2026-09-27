"use client";

import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useCallback } from "react";

/**
 * Marks some of the restaurant's cached reads stale after a change this screen made.
 *
 * Takes the key families the change touches - `managerKeys.menu` after a dish is
 * edited, `managerKeys.billing` and `managerKeys.service` after a bill is settled -
 * so a screen says what it changed rather than reloading everything. Only the reads
 * a screen is showing refetch now; the rest refetch when next opened.
 */
export function useInvalidateRestaurant() {
  const client = useQueryClient();

  return useCallback(
    async (...keys: QueryKey[]): Promise<void> => {
      await Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })));
    },
    [client],
  );
}
