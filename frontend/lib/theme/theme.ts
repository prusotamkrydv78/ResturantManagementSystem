/**
 * The theme contract.
 *
 * Everything that decides which palette the product wears is here: the names, the
 * key they are stored under, the attribute they are written to, and the script that
 * applies the stored one before the first paint. The CSS in `app/globals.css` reads
 * the attribute and nothing else, so these two files are the whole system.
 *
 * Plain module rather than a React one on purpose. The blocking script in the
 * document head has to be built from the same constants the hook uses, and that
 * script runs long before React exists.
 */

/**
 * Every theme the product offers.
 *
 * `system` is not a palette; it is the absence of a choice, and it means the
 * attribute is removed so the CSS falls back to `prefers-color-scheme`. It is first
 * because it is the default: somebody who has expressed no preference here has
 * usually expressed one to their operating system already.
 *
 * A named theme added to `globals.css` goes in this list too, and the switcher
 * picks it up without any further change.
 */
export const THEMES = ["system", "light", "dark"] as const;

export type ThemePreference = (typeof THEMES)[number];

/** What each choice is called in the interface. */
export const THEME_LABELS: Record<ThemePreference, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

/**
 * Where the choice is kept.
 *
 * The browser rather than the account, and deliberately: a theme is about the
 * screen and the room it is in. The same manager wants dark on the pass at night
 * and light in a sunlit office, and an account-level setting would fight that.
 *
 * Namespaced with the `rms.` prefix the navigation preferences already use.
 */
export const THEME_STORAGE_KEY = "rms.theme";

/** The attribute the CSS keys off. */
export const THEME_ATTRIBUTE = "data-theme";

export function isThemePreference(value: unknown): value is ThemePreference {
  return (
    typeof value === "string" && (THEMES as readonly string[]).includes(value)
  );
}

/**
 * Writes a preference onto the document.
 *
 * `system` removes the attribute rather than setting it to something, because the
 * absence is what makes the media query in the stylesheet win. Setting an attribute
 * named "system" would need a third CSS rule saying what the first two already say.
 */
export function applyTheme(theme: ThemePreference): void {
  const root = document.documentElement;

  if (theme === "system") {
    root.removeAttribute(THEME_ATTRIBUTE);
    return;
  }

  root.setAttribute(THEME_ATTRIBUTE, theme);
}

/**
 * The script that runs before the page is painted.
 *
 * Without it a manager who has chosen light gets a dark flash on every navigation:
 * the server has no way to know the preference, so the first paint is whatever the
 * operating system says, and React only corrects it after hydration. That flash is
 * the single most visible thing a theme switcher gets wrong.
 *
 * Built from the constants above rather than written out, so the key and the
 * attribute cannot drift from the ones the hook uses. It is deliberately small and
 * total: a browser with site data blocked throws on the read itself, and a theme is
 * not worth a blank page, so every failure means "no preference".
 *
 * `JSON.parse` because the value is written through the same stored-preference hook
 * as the rest of the interface, which stores JSON.
 */
export const THEME_SCRIPT = `(function(){try{var raw=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(!raw)return;var t=JSON.parse(raw);if(t==="light"||t==="dark"){document.documentElement.setAttribute(${JSON.stringify(
  THEME_ATTRIBUTE,
)},t);}}catch(e){}})();`;
