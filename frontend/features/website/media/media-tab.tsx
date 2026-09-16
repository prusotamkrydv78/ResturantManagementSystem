"use client";

import { useRef, useState } from "react";
import { CircleAlert, ImageUp, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mediaSrc } from "@/features/website/photos";
import { cn } from "@/lib/utils/cn";
import { readableBytes, useMediaLibrary } from "./library";
import type { Media } from "@/features/website/api";

/**
 * The picture library, as a tab in the editor panel.
 *
 * WHY IT LIVES BESIDE THE PAGE AND NOT ON A SETTINGS SCREEN
 *
 * Because uploading a picture is almost never the job. The job is "this dish needs a
 * photograph", and a library on another screen turns that into: leave the page, find
 * the upload screen, upload, come back, find the dish again, open it, pick the
 * picture. Here it is a tab away from the field that needs it, the page stays on
 * screen the whole time, and the picture that arrives is immediately in every picker
 * on the site because they all read the same store.
 *
 * ONE LIBRARY, NOT ONE PER SLOT
 *
 * A restaurant photographs its room once and uses that photograph in the hero, in the
 * gallery and on the page next year. Uploading it per slot would be the same file
 * three times against a sixty-picture limit.
 */
export function MediaTab() {
  const library = useMediaLibrary();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3.5">
        <UploadControl />

        {library.uploadError !== null && (
          <p
            role="alert"
            className="flex items-start gap-1.5 rounded-md bg-danger-soft px-2.5 py-2 text-xs text-danger"
          >
            <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">{library.uploadError}</span>
            <button
              type="button"
              onClick={library.dismissError}
              className="shrink-0 font-medium underline underline-offset-2"
            >
              Dismiss
            </button>
          </p>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {library.isLoading ? (
          <p className="flex items-center gap-2 py-6 text-xs text-muted">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            Reading your pictures…
          </p>
        ) : library.loadError !== null ? (
          <div className="flex flex-col items-start gap-2 rounded-lg border border-border bg-surface-2 p-3">
            <p className="text-xs text-danger">{library.loadError}</p>
            <Button
              size="sm"
              variant="secondary"
              icon={<RefreshCw />}
              onClick={library.reload}
            >
              Try again
            </Button>
          </div>
        ) : library.items.length === 0 ? (
          <Empty />
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {library.items.map((item) => (
              <li key={item.id}>
                <Thumbnail
                  item={item}
                  isConfirming={pendingDelete === item.id}
                  onAskDelete={() => setPendingDelete(item.id)}
                  onCancelDelete={() => setPendingDelete(null)}
                  onDelete={() => {
                    setPendingDelete(null);
                    void library.remove(item.id);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="border-t border-border bg-surface-2 px-4 py-3">
        <p className="text-2xs leading-relaxed text-muted">
          Everything here can be used anywhere on the page — the hero, any dish, any
          gallery tile. Open a section and choose it under{" "}
          <span className="font-medium text-text">Your pictures</span>.
        </p>
      </footer>
    </div>
  );
}

/**
 * The way in: a button, and the whole strip as a drop target.
 *
 * Both, because they are used by different people on different days. Dragging a
 * folder of photographs in is the fast path for somebody who has just come back from
 * a shoot; the button is for everybody who has never discovered that a drop target
 * was there, which is most people.
 */
function UploadControl() {
  const library = useMediaLibrary();
  const input = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);

  const accept = (list: FileList | null) => {
    if (list === null) return;

    // Filtered here rather than trusted to the accept attribute, which a drop
    // bypasses entirely. The server checks too; this is so the manager finds out
    // now rather than after a round trip.
    const files = Array.from(list).filter((file) => file.type.startsWith("image/"));

    if (files.length > 0) void library.upload(files);
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsOver(false);
        accept(event.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border border-dashed p-4 text-center transition-colors",
        isOver ? "border-primary bg-primary-soft" : "border-border-strong bg-surface-2",
      )}
    >
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          accept(event.target.files);
          // Cleared so choosing the same file twice in a row still fires a change.
          event.target.value = "";
        }}
      />

      <Button
        size="sm"
        variant="secondary"
        icon={library.isUploading ? <Loader2 className="animate-spin" /> : <ImageUp />}
        disabled={library.isUploading || library.isFull}
        onClick={() => input.current?.click()}
      >
        {library.isUploading ? "Uploading…" : "Add pictures"}
      </Button>

      <p className="text-2xs text-muted">
        {library.isFull ? (
          <>Your library is full. Remove one to add another.</>
        ) : (
          <>or drop them here — JPEG, PNG or WebP, up to 4 MB each</>
        )}
      </p>

      {library.limit > 0 && (
        <p className="tabular text-2xs text-subtle">
          {library.used} of {library.limit} used · {readableBytes(library.bytesUsed)}
        </p>
      )}
    </div>
  );
}

/**
 * One picture, with the only destructive control in the editor.
 *
 * Confirmed in place rather than in a dialog. Nothing on the server knows whether this
 * picture is on the page, so the warning has to be the honest one — it says what
 * cannot be undone and leaves the judgement with the person who knows.
 */
function Thumbnail({
  item,
  isConfirming,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  item: Media;
  isConfirming: boolean;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group/tile relative aspect-square overflow-hidden rounded-md border border-border bg-surface-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mediaSrc(item.id)}
        alt={item.fileName}
        title={`${item.fileName} · ${readableBytes(item.byteCount)}`}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 block h-full w-full object-cover"
      />

      {isConfirming ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-[#171717]/85 p-2 text-center">
          <p className="text-2xs leading-tight font-medium text-white">
            Delete for good?
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onDelete}
              className="rounded px-1.5 py-0.5 text-2xs font-semibold text-white bg-danger-solid"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="rounded bg-white/15 px-1.5 py-0.5 text-2xs font-medium text-white"
            >
              Keep
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onAskDelete}
          aria-label={`Delete ${item.fileName}`}
          className={cn(
            "absolute top-1 right-1 rounded-md bg-[#171717]/70 p-1 text-white transition-opacity",
            "opacity-0 group-hover/tile:opacity-100 focus-visible:opacity-100",
          )}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-4 py-8 text-center">
      <ImageUp className="size-5 text-subtle" aria-hidden="true" />
      <p className="text-sm font-medium text-text">No pictures yet</p>
      <p className="max-w-56 text-xs leading-relaxed text-muted">
        Your page is showing sample photographs. Add your own and they become available
        in every photograph slot on the site.
      </p>
    </div>
  );
}
