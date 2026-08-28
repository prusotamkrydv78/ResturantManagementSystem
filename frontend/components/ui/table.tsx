import { cn } from "@/lib/utils/cn";

/**
 * Table primitives.
 *
 * The wrapper scrolls horizontally on its own so a wide table never makes the
 * page body scroll sideways. Rows are separated by hairlines rather than zebra
 * striping, which stays legible as column counts grow.
 */
export function TableWrap({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>{children}</div>
  );
}

export function Table({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <table className={cn("w-full min-w-[38rem] border-collapse text-left", className)}>
      {children}
    </table>
  );
}

export function Th({
  className,
  children,
  ...thProps
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-border bg-surface-2 px-4 py-2",
        "text-2xs font-semibold tracking-wide text-muted uppercase",
        className,
      )}
      {...thProps}
    >
      {children}
    </th>
  );
}

export function Td({
  className,
  children,
  ...tdProps
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("border-b border-border px-4 py-2.5 align-middle text-sm", className)}
      {...tdProps}
    >
      {children}
    </td>
  );
}

export function Tr({
  className,
  children,
  ...trProps
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("transition-colors hover:bg-surface-2", className)}
      {...trProps}
    >
      {children}
    </tr>
  );
}
