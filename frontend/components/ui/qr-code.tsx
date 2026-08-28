import { encodeQr, QrTooLongError } from "@/lib/qr/encode";
import { cn } from "@/lib/utils/cn";

/**
 * A QR code, drawn as one SVG path.
 *
 * One path rather than a rectangle per module: a version 4 symbol has over a
 * thousand dark modules, and a thousand DOM nodes per table on a page listing twenty
 * of them is a page that takes a second to lay out. The path is also what makes it
 * print cleanly at any size, which is the whole point of putting it on a card.
 *
 * The quiet zone is part of the drawing rather than a margin, because a scanner needs
 * the light border to find the symbol, and a margin can be collapsed by a parent
 * stylesheet or cropped by a printer.
 *
 * Black on white, always, rather than the theme colours. A scanner needs contrast and
 * the right polarity, and a code printed in the palette of a dark theme is a code that
 * does not read.
 */
export function QrCode({
  value,
  size = 160,
  className,
  title,
}: {
  /** What the code resolves to. Usually a full URL. */
  value: string;
  /** Rendered edge in pixels, quiet zone included. */
  size?: number;
  className?: string;
  /** Accessible name. Describe where the code goes, not that it is a QR code. */
  title: string;
}) {
  let symbol;

  try {
    symbol = encodeQr(value);
  } catch (caught) {
    // A link too long to encode is a real possibility if a host name grows, and it
    // must not take the page down with it. The link itself is always shown beside
    // this, so the reader is not left with nothing.
    if (caught instanceof QrTooLongError) {
      return (
        <p
          className={cn(
            "flex items-center justify-center rounded-md border border-border",
            "bg-surface-2 p-3 text-center text-xs text-muted",
            className,
          )}
          style={{ width: size, height: size }}
        >
          This link is too long to turn into a code. Use the link itself.
        </p>
      );
    }

    throw caught;
  }

  const quiet = 4;
  const span = symbol.size + quiet * 2;

  // Built as one path of one-unit squares in symbol coordinates, then scaled by the
  // viewBox, so the drawing carries no pixel arithmetic of its own.
  const path = symbol.modules
    .flatMap((row, rowIndex) =>
      row.map((dark, columnIndex) =>
        dark
          ? `M${columnIndex + quiet} ${rowIndex + quiet}h1v1h-1z`
          : null,
      ),
    )
    .filter((segment) => segment !== null)
    .join("");

  return (
    <svg
      role="img"
      aria-label={title}
      viewBox={`0 0 ${span} ${span}`}
      width={size}
      height={size}
      className={cn("shrink-0 rounded-md", className)}
      // Keeps the modules crisp instead of letting the renderer smooth their edges,
      // which is what turns a small printed code into a blurry one.
      shapeRendering="crispEdges"
    >
      <rect width={span} height={span} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
