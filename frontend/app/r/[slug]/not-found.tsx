/**
 * Nothing at this address.
 *
 * Reached by `notFound()` from the page, so it is served with a real 404 rather than
 * being a 200 that happens to say no. That distinction is the whole point of it: an
 * unknown label is not a page, and every machine that reads status codes - a crawler,
 * a monitor, a cache - should be told so in the one field they all agree on.
 *
 * Deliberately plain, and deliberately not branded as this product. Somebody who
 * mistyped a restaurant's address is not a prospect for restaurant software, and a
 * page that used their mistake as a billboard would be the worst first impression
 * either business could make.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-2 bg-canvas px-6 text-center">
      <h1 className="text-lg font-semibold text-text">Nothing here yet</h1>
      <p className="max-w-sm text-sm text-muted">
        There is no page at this address. If you were looking for a restaurant, check
        the link you followed.
      </p>
    </main>
  );
}
