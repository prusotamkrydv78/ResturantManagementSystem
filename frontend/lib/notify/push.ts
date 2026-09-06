/**
 * Reaching a guest whose phone is in their pocket.
 *
 * A toast is only a notification if somebody is looking at the screen, and for most of
 * the wait nobody is - the phone is face down on the table or back in a bag. This is the
 * part that actually reaches them: a real notification on the lock screen, from the
 * browser, with no app to install.
 *
 * Deliberately only fired while the page is hidden. Putting a system notification on the
 * screen of somebody already watching the timeline is telling them something they can
 * see, and it is the fastest way to have permission revoked.
 *
 * Permission is never asked for on arrival. A prompt before somebody has ordered is a
 * prompt about nothing, and a refusal is permanent - browsers do not ask twice. It is
 * asked once, after an order exists, in response to a tap.
 *
 * Everything here degrades to nothing. No support, no permission, a browser that throws:
 * the toast, the sound and the timeline all still work.
 */

/** What the browser will let us do right now. */
export type PushState = "unsupported" | "default" | "granted" | "denied";

/** Whether this browser can show notifications at all. */
export function pushState(): PushState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  try {
    return Notification.permission as PushState;
  } catch {
    // Some embedded browsers expose the constructor and throw on the property.
    return "unsupported";
  }
}

/**
 * Asks for permission, once.
 *
 * Must be called from a real tap. Browsers refuse a prompt that did not come from a
 * gesture, and some now hold it against the site if it did not.
 */
export async function askForPush(): Promise<PushState> {
  if (pushState() === "unsupported") {
    return "unsupported";
  }

  try {
    return (await Notification.requestPermission()) as PushState;
  } catch {
    return "denied";
  }
}

/**
 * Shows a notification, but only if the guest is not already looking at the page.
 *
 * The tag collapses updates about one order into a single entry, so a lock screen shows
 * "your food is ready" rather than a stack of five telling the story so far.
 */
export function pushIfHidden(options: {
  title: string;
  body: string;
  /** Groups updates about the same order. */
  tag: string;
}): void {
  if (typeof document === "undefined" || !document.hidden) {
    return;
  }

  if (pushState() !== "granted") {
    return;
  }

  try {
    const notification = new Notification(options.title, {
      body: options.body,
      // Replaces any earlier notification about this order rather than stacking a
      // fifth one telling the story so far. Quietly, by default - the browser only
      // buzzes again for a replacement if asked to, and it is not.
      tag: options.tag,
    });

    // Bringing the page forward is the only useful thing a tap can do here.
    notification.onclick = () => {
      try {
        window.focus();
        notification.close();
      } catch {
        // Nothing to recover. The page is still there to open by hand.
      }
    };
  } catch {
    // Notification construction throws on a few mobile browsers that report support.
  }
}
