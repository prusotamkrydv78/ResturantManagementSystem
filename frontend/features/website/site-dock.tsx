"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Check, MapPin, ShoppingBag, UtensilsCrossed, X } from "lucide-react";
import { requestPublicBooking, type PublicBooking } from "@/features/public/api";

/**
 * What a visitor can do on any restaurant's page, whichever design it wears.
 *
 * A small bar floating at the foot of the screen: the menu, a table, an order, and the
 * way there. It is the one piece every design shares, which is deliberate - the four
 * designs differ in how they look, and none of them should differ in whether a guest
 * can actually book or order. It is also the mobile navigation: on a phone, where the
 * designs fold their menus away, this is how somebody reaches the menu at all.
 *
 * Booking opens a sheet with a short form. The request goes straight into the
 * restaurant's reservations as pending, and the restaurant calls to confirm - which
 * the sheet says, so nobody reads a request as a promise. Every "Book" and "Reserve"
 * button in the designs opens the same sheet (they link to #book).
 */
export function SiteDock({
  slug,
  name,
  address,
  canOrder,
  hasMenu,
}: {
  slug: string;
  name: string;
  /** The full address, for directions; null hides that button. */
  address: string | null;
  /** Whether the restaurant is taking orders online right now. */
  canOrder: boolean;
  /** Whether the page has a menu section to jump to. */
  hasMenu: boolean;
}) {
  const [isBooking, setIsBooking] = useState(false);
  const router = useRouter();

  // Any link to #book anywhere on the page opens the sheet rather than jumping.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.('a[href="#book"]');

      if (link !== null && link !== undefined) {
        event.preventDefault();
        setIsBooking(true);
      }
    };

    document.addEventListener("click", onClick);

    return () => document.removeEventListener("click", onClick);
  }, []);

  const directions =
    address === null ? null : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${address}`)}`;

  return (
    <>
      <nav
        aria-label="Book, order and find us"
        className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-fit max-w-[calc(100%-1.5rem)] items-center gap-1 rounded-full bg-[#141414]/92 p-1.5 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-md"
      >
        {hasMenu && (
          <a href="#menu" className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors hover:bg-white/10">
            <UtensilsCrossed className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Menu</span>
          </a>
        )}
        <button
          type="button"
          onClick={() => setIsBooking(true)}
          className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#141414] transition-transform hover:scale-[1.03]"
        >
          <CalendarCheck className="size-4" aria-hidden="true" />
          Book a table
        </button>
        {canOrder && (
          <a
            href={`/r/${encodeURIComponent(slug)}/order`}
            onClick={(event) => {
              // On the restaurant's own address the proxy already maps "/" to this
              // page, so the ordering page there is plain "/order"; the /r/ path is
              // for the shared address only.
              if (!window.location.pathname.startsWith("/r/")) {
                event.preventDefault();
                router.push("/order");
              }
            }}
            className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors hover:bg-white/10"
          >
            <ShoppingBag className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Order online</span>
            <span className="sm:hidden">Order</span>
          </a>
        )}
        {directions !== null && (
          <a
            href={directions}
            target="_blank"
            rel="noreferrer"
            aria-label="Directions"
            title="Directions"
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors hover:bg-white/10"
          >
            <MapPin className="size-4" aria-hidden="true" />
            <span className="hidden md:inline">Directions</span>
          </a>
        )}
      </nav>

      {isBooking && <BookingSheet slug={slug} name={name} onClose={() => setIsBooking(false)} />}
    </>
  );
}

/** Tomorrow at seven, as the value a datetime-local input wants. */
function defaultWhen(): string {
  const when = new Date();
  when.setDate(when.getDate() + 1);
  when.setHours(19, 0, 0, 0);

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T${pad(when.getHours())}:${pad(when.getMinutes())}`;
}

function BookingSheet({ slug, name, onClose }: { slug: string; name: string; onClose: () => void }) {
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [when, setWhen] = useState(defaultWhen);
  const [guests, setGuests] = useState(2);
  const [notes, setNotes] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<PublicBooking | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSending(true);

    try {
      setBooked(
        await requestPublicBooking(slug, {
          name: guestName.trim(),
          phone: phone.trim(),
          reservedForUtc: new Date(when).toISOString(),
          guestCount: guests,
          notes: notes.trim() === "" ? undefined : notes.trim(),
        }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That did not go through. Please try again, or call us.");
    } finally {
      setIsSending(false);
    }
  }

  const field =
    "w-full rounded-xl border border-black/15 bg-white px-3 py-2.5 text-sm text-[#141414] outline-none focus:border-black focus:ring-2 focus:ring-black/10";

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-3 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-[#faf8f5] p-5 text-[#141414] shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="booking-title" className="text-xl font-semibold tracking-tight">
              {booked === null ? "Book a table" : "Request sent"}
            </h2>
            <p className="mt-1 text-sm text-black/60">{name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-black/50 hover:bg-black/5 hover:text-black">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {booked !== null ? (
          <div className="mt-6 flex flex-col items-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#1f7a4d] text-white">
              <Check className="size-6" aria-hidden="true" />
            </span>
            <p className="text-sm">
              We have your request for <strong>{booked.guestCount}</strong> on{" "}
              <strong>
                {new Date(booked.reservedForUtc).toLocaleString(undefined, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </strong>
              .
            </p>
            <p className="text-sm text-black/60">The restaurant will call you to confirm it.</p>
            <button type="button" onClick={onClose} className="mt-2 rounded-full bg-[#141414] px-5 py-2.5 text-sm font-semibold text-white">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={send} className="mt-5 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-black/70">
              Your name
              <input required minLength={2} maxLength={120} value={guestName} onChange={(event) => setGuestName(event.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-black/70">
              Phone, so we can confirm
              <input required type="tel" minLength={5} maxLength={32} value={phone} onChange={(event) => setPhone(event.target.value)} className={field} />
            </label>
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-black/70">
                When
                <input required type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} className={field} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-black/70">
                Guests
                <input
                  required
                  type="number"
                  min={1}
                  max={20}
                  value={guests}
                  onChange={(event) => setGuests(Number(event.target.value))}
                  className={field}
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-xs font-medium text-black/70">
              Anything we should know (optional)
              <textarea rows={2} maxLength={400} value={notes} onChange={(event) => setNotes(event.target.value)} className={field} />
            </label>

            {error !== null && (
              <p role="alert" className="rounded-xl bg-[#b3261e]/10 px-3 py-2 text-sm text-[#b3261e]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSending}
              className="mt-1 rounded-full bg-[#141414] px-5 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            >
              {isSending ? "Sending…" : "Request this table"}
            </button>
            <p className="text-center text-2xs text-black/50">
              This is a request. The restaurant confirms it by phone. Parties over 20, please call.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
