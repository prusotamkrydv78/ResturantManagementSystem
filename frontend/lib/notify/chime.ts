/**
 * The sound a notification makes.
 *
 * Synthesised rather than played from a file, for three reasons that all matter here.
 * There is no asset to ship, cache or 404. It starts instantly, where an audio file on
 * a phone on restaurant wifi may not. And the shape of it can be tuned in code instead
 * of by re-exporting a sample.
 *
 * Two soft sine tones a fifth apart, each with a quick attack and a long gentle decay -
 * a marimba rather than an alarm. This is a sound a waiter will hear a few hundred times
 * a shift, so anything sharp or buzzy becomes something they turn off, and a muted alert
 * is worse than a quiet one.
 *
 * Browsers refuse to start audio before somebody has interacted with the page, and there
 * is no way around that and no reason to want one. The context is created lazily on the
 * first attempt and unlocked by the first real gesture; a chime that arrives before any
 * interaction is simply skipped rather than queued, because a sound with no visible cause
 * is worse than silence.
 */

/** How loud, as a fraction of full scale. Deliberately gentle. */
const PEAK = 0.16;

/** Note pitches in hertz, per tone. A perfect fifth reads as pleasant in every key. */
const VOICES = {
  /** Something arrived and wants attention. Rising, which reads as "look at this". */
  alert: [660, 990],
  /** Something finished. Falling, which reads as "that is dealt with". */
  settled: [880, 587],
  /** Neutral acknowledgement. */
  info: [784, 784],
} as const;

/** Which of the three voices to use. */
export type ChimeTone = keyof typeof VOICES;

type AudioContextConstructor = new () => AudioContext;

let context: AudioContext | null = null;
let unlockBound = false;

/** The one AudioContext, created on first use. */
function ensureContext(): AudioContext | null {
  if (context !== null) {
    return context;
  }

  if (typeof window === "undefined") {
    return null;
  }

  // Safari still only has the prefixed constructor on older versions, and it is one
  // line to support rather than a class of phones that never make a sound.
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor })
      .webkitAudioContext;

  if (Ctor === undefined) {
    return null;
  }

  try {
    context = new Ctor();
  } catch {
    // Some embedded webviews throw outright. Silence is an acceptable outcome.
    return null;
  }

  return context;
}

/**
 * Lets the next gesture unlock audio.
 *
 * Called once, early. Until a person has tapped something the context stays suspended
 * and every chime is skipped; after that it plays. Registered against several event
 * types because which one counts as a gesture differs between browsers, and removed as
 * soon as any of them fires.
 */
export function armChime(): void {
  if (unlockBound || typeof window === "undefined") {
    return;
  }

  unlockBound = true;

  const unlock = () => {
    void ensureContext()?.resume().catch(() => {
      // Still refused. Nothing to do; chimes stay silent and the app is unaffected.
    });

    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };

  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true });
}

/**
 * Plays one chime, or does nothing.
 *
 * Never throws and never awaits. A notification that could not make a sound is still a
 * notification, and the toast beside it carries the whole message on its own.
 */
export function playChime(tone: ChimeTone = "info"): void {
  const audio = ensureContext();

  if (audio === null || audio.state === "suspended") {
    // Not yet unlocked by a gesture. Skipped rather than queued: a sound arriving
    // minutes later, attached to nothing on screen, is just confusing.
    return;
  }

  try {
    const now = audio.currentTime;
    const notes = VOICES[tone];

    notes.forEach((frequency, index) => {
      // The second note lands just behind the first, so the pair reads as one sound
      // rather than as two beeps.
      const start = now + index * 0.09;

      const oscillator = audio.createOscillator();
      const gain = audio.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      // Shaped by hand rather than left as a square on/off, which is what makes the
      // difference between a note and a click.
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(PEAK, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);

      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.45);
    });
  } catch {
    // As above.
  }
}
