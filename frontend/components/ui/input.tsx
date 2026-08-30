import { cn } from "@/lib/utils/cn";

/**
 * Shared visual treatment for every entry control, so inputs, textareas and the
 * dropdown in `select.tsx` cannot drift apart.
 */
export const controlClasses = cn(
  "w-full rounded-md border bg-surface px-2.5 text-base text-text",
  "border-border-strong placeholder:text-subtle",
  "transition-colors duration-100",
  "hover:border-border-strong",
  "disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-muted",
  "aria-[invalid=true]:border-danger",
);

export function Input({
  className,
  ...inputProps
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClasses, "h-9", className)} {...inputProps} />;
}

export function Textarea({
  className,
  rows = 3,
  ...textareaProps
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={rows}
      className={cn(controlClasses, "resize-y py-2", className)}
      {...textareaProps}
    />
  );
}

// The dropdown lives in `select.tsx` and is not a native `select`. The list a
// native one opens is drawn by the operating system, which meant a white strip on
// a dark page with no CSS anywhere that could reach it.
