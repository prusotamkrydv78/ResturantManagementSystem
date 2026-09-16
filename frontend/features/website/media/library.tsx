"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { deleteMedia, listMedia, uploadMedia, type Media } from "@/features/website/api";

/**
 * One restaurant's pictures, held once for the whole editor.
 *
 * WHY THIS IS A STORE AND NOT A HOOK PER PICKER
 *
 * A page has a photograph in the hero, one on every dish, one on every gallery tile
 * and one in the spotlight. If each picker fetched its own copy of the library,
 * opening a menu section would fire a request per dish, uploading a picture in one of
 * them would leave the other eleven showing a list without it, and deleting one would
 * leave stale thumbnails everywhere until a reload. None of those are edge cases —
 * they are Tuesday.
 *
 * So the library is loaded once, above everything that uses it, and every picker,
 * every thumbnail and the media tab itself read the same array. Upload anywhere and it
 * appears everywhere in the same frame. That is the whole point of the thing: one
 * store, distributed to every slot on the site.
 *
 * WHAT IT DOES NOT DO
 *
 * It does not know what a page is. Uploading a picture does not put it anywhere, and
 * deleting one does not go looking for slots that referenced it — the server cannot do
 * that either, and the editor deliberately keeps the two apart. What it does do is warn
 * before a delete, because the manager is the only party in this system who knows
 * whether that picture is on their homepage.
 */

/** How many pictures may be added at once, to keep one drop from queueing fifty. */
const MAX_AT_ONCE = 10;

export interface MediaStore {
  items: Media[];
  /** How many are held, and how many may be. Both the server's numbers, not ours. */
  used: number;
  limit: number;
  bytesUsed: number;
  isLoading: boolean;
  /** The library could not be read at all. Distinct from an upload failing. */
  loadError: string | null;
  isUploading: boolean;
  uploadError: string | null;
  isFull: boolean;
  /** Adds pictures and returns the ones that landed, newest first. */
  upload: (files: File[]) => Promise<Media[]>;
  remove: (id: string) => Promise<void>;
  reload: () => void;
  /** Clears an upload failure once it has been read. */
  dismissError: () => void;
}

const MediaContext = createContext<MediaStore | null>(null);

export function MediaLibraryProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Media[]>([]);
  const [used, setUsed] = useState(0);
  const [limit, setLimit] = useState(0);
  const [bytesUsed, setBytesUsed] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);

      try {
        const library = await listMedia();

        if (cancelled) return;

        setItems(library.items);
        setUsed(library.used);
        setLimit(library.limit);
        setBytesUsed(library.bytesUsed);
        setLoadError(null);
      } catch (caught) {
        if (cancelled) return;

        setLoadError(
          caught instanceof Error ? caught.message : "Unable to read your pictures.",
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  /**
   * Adds pictures, one request at a time.
   *
   * Sequential rather than parallel, and that is not laziness. These are photographs:
   * ten at once on a restaurant's broadband is ten uploads all crawling, with the
   * progress of each invisible and the whole thing finishing no sooner. One at a time
   * means each one lands and appears as it lands, which is also the only honest
   * progress indicator available without a streaming upload.
   *
   * A failure stops the run and keeps whatever already landed. Partial success is the
   * truth here, and pretending otherwise would mean deleting pictures that uploaded
   * perfectly well.
   */
  const upload = useCallback(async (files: File[]): Promise<Media[]> => {
    const queue = files.slice(0, MAX_AT_ONCE);

    if (queue.length === 0) {
      return [];
    }

    setIsUploading(true);
    setUploadError(null);

    const added: Media[] = [];

    try {
      for (const file of queue) {
        const media = await uploadMedia(file);

        added.push(media);

        // Written in as each one arrives rather than all at the end, so a picker that
        // is open fills up while the upload is still running.
        setItems((current) => [media, ...current]);
        setUsed((current) => current + 1);
        setBytesUsed((current) => current + media.byteCount);
      }
    } catch (caught) {
      setUploadError(
        caught instanceof Error ? caught.message : "That picture could not be added.",
      );
    } finally {
      setIsUploading(false);
    }

    return added;
  }, []);

  const remove = useCallback(async (id: string) => {
    // Taken out of the list first. The request is the slow part and the outcome is
    // almost never a surprise; putting it back on failure is a better trade than a
    // second of nothing happening after a press.
    const previous = items;

    setItems((current) => current.filter((item) => item.id !== id));
    setUsed((current) => Math.max(0, current - 1));
    setBytesUsed((current) =>
      Math.max(0, current - (previous.find((item) => item.id === id)?.byteCount ?? 0)),
    );

    try {
      await deleteMedia(id);
    } catch (caught) {
      setItems(previous);
      setUsed(previous.length);
      setBytesUsed(previous.reduce((total, item) => total + item.byteCount, 0));
      setUploadError(
        caught instanceof Error ? caught.message : "That picture could not be removed.",
      );
    }
  }, [items]);

  const store = useMemo<MediaStore>(
    () => ({
      items,
      used,
      limit,
      bytesUsed,
      isLoading,
      loadError,
      isUploading,
      uploadError,
      isFull: limit > 0 && used >= limit,
      upload,
      remove,
      reload: () => setReloadKey((key) => key + 1),
      dismissError: () => setUploadError(null),
    }),
    [
      items,
      used,
      limit,
      bytesUsed,
      isLoading,
      loadError,
      isUploading,
      uploadError,
      upload,
      remove,
    ],
  );

  return <MediaContext value={store}>{children}</MediaContext>;
}

/**
 * The library.
 *
 * Throws rather than returning an empty one when there is no provider above. A picker
 * silently showing no pictures is the hardest kind of bug to see, because it looks
 * exactly like a restaurant that has not uploaded any.
 */
export function useMediaLibrary(): MediaStore {
  const store = useContext(MediaContext);

  if (store === null) {
    throw new Error("useMediaLibrary needs a MediaLibraryProvider above it.");
  }

  return store;
}

/** A size a person can read. Kilobytes and megabytes; nothing here is larger. */
export function readableBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
