"use client";

import { useEffect } from "react";
import { useStoredPreference } from "@/lib/hooks/use-stored-preference";
import {
  THEME_STORAGE_KEY,
  applyTheme,
  isThemePreference,
  type ThemePreference,
} from "@/lib/theme/theme";

/**
 * Reads and writes the theme.
 *
 * Built on the same stored-preference hook the folded rails use, which already
 * solves the three hard parts: a server snapshot that does not touch localStorage,
 * a storage listener so a second tab follows along, and a read that survives a
 * browser configured to block site data.
 *
 * The effect writes to the DOM rather than to state, which is why it is allowed to
 * exist — it is the one direction React cannot express declaratively, because the
 * attribute lives on `<html>`, outside the tree. It also covers the case the click
 * handler cannot: another tab changing the theme arrives as a storage event, not as
 * a call to `setTheme` here.
 */
export function useTheme(): {
  theme: ThemePreference;
  setTheme: (next: ThemePreference) => void;
} {
  const [stored, setStored] = useStoredPreference<ThemePreference>(
    THEME_STORAGE_KEY,
    "system",
  );

  // A value written by an older build, or edited by hand, should not leave the
  // interface pointing at a theme that no longer exists.
  const theme = isThemePreference(stored) ? stored : "system";

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return { theme, setTheme: setStored };
}
