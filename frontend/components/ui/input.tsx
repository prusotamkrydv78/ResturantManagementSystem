import { cn } from "@/lib/utils/cn";

/**
 * Shared visual treatment for every text-entry control, so inputs, selects and
 * textareas cannot drift apart.
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

export function Select({
  className,
  children,
  ...selectProps
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(controlClasses, "h-9 pr-8", className)} {...selectProps}>
      {children}
    </select>
  );
}
