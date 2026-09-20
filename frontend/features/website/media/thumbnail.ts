/**
 * A small copy of a picture, made in the browser before it is uploaded.
 *
 * WHY HERE AND NOT ON THE SERVER
 *
 * The editor draws the library as a grid of squares about a hundred points across — in
 * the Pictures tab, and again inside every photograph field on the page. Drawing that
 * grid from the originals meant sixty four-megabyte photographs downloaded to paint
 * sixty thumbnails, several times over on a section with several photograph fields in
 * it. It needed a small copy.
 *
 * Making it on the server would mean an imaging library there, which this product does
 * not have: a real dependency, with a real licence, carried for one downscale. The
 * browser doing the upload has already decoded the picture in order to show it to the
 * person choosing it. It can produce the small copy for nothing.
 *
 * NOTHING HERE IS ALLOWED TO FAIL AN UPLOAD
 *
 * Every step is wrapped and every failure returns null. A browser without
 * `createImageBitmap`, a canvas that refuses to encode, an image the decoder will not
 * take — all of them end with the original being uploaded on its own, which the server
 * accepts and serves. The cost of that is a slower grid, and the cost of the
 * alternative is a photograph the manager cannot upload at all.
 */

/** The longest edge of the small copy. Matches `RestaurantMedia.ThumbnailEdge`. */
const EDGE = 320;

/**
 * WebP first.
 *
 * It keeps transparency, which JPEG does not — a logo on a clear background would
 * otherwise come back with a black square behind it — and it is a third of the size at
 * the same quality. JPEG is the fallback for anything that will not encode it, and
 * both are on the server's whitelist.
 */
const TYPES = ["image/webp", "image/jpeg"] as const;

/** How hard to compress. High enough that a thumbnail does not look like a mistake. */
const QUALITY = 0.75;

/**
 * A small copy of the picture, or null if this browser cannot make one.
 *
 * The result is a `File` rather than a `Blob` so it can go straight into the same
 * `FormData` as the original.
 */
export async function makeThumbnail(file: File): Promise<File | null> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return null;
  }

  let bitmap: ImageBitmap | null = null;

  try {
    // `from-image` applies the EXIF rotation a phone writes instead of rotating the
    // pixels. Without it a portrait photograph is stored upright and thumbnailed on
    // its side, which reads as the editor having mangled it.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

    const scale = Math.min(1, EDGE / Math.max(bitmap.width, bitmap.height));

    // Already small. Uploading a second copy of the same bytes under a different
    // column would spend the storage twice for nothing.
    if (scale === 1 && file.size <= 256 * 1024) {
      return null;
    }

    const canvas = document.createElement("canvas");

    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext("2d");

    if (context === null) {
      return null;
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const type of TYPES) {
      const blob = await encode(canvas, type);

      // A canvas asked for a type it cannot encode answers in PNG instead of failing,
      // so the answer is checked rather than trusted.
      if (blob !== null && blob.type === type) {
        return new File([blob], thumbnailName(file.name, type), { type });
      }
    }

    return null;
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}

function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob(resolve, type, QUALITY);
    } catch {
      resolve(null);
    }
  });
}

/** Named after the original, so a row in the database is still traceable to a file. */
function thumbnailName(name: string, type: string): string {
  const stem = name.replace(/\.[^.]+$/, "").slice(0, 96);

  return `${stem}-thumb.${type === "image/webp" ? "webp" : "jpg"}`;
}

/**
 * Whether a file is small enough to send.
 *
 * Checked before the request rather than after. The server refuses an oversized upload
 * either way, but it refuses it once the browser has spent a minute pushing twelve
 * megabytes up a restaurant's broadband, and the answer is the same as it would have
 * been instantly.
 */
export function isWithinLimit(file: File, maxBytes: number): boolean {
  return maxBytes <= 0 || file.size <= maxBytes;
}
