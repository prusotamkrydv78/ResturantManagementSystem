import { cn } from "@/lib/utils/cn";

interface FieldProps {
  /** Must match the id of the control inside. */
  htmlFor: string;
  label: string;
  /** Guidance shown under the control while the value is valid. */
  hint?: string;
  /** Validation message. Replaces the hint and marks the control invalid. */
  error?: string;
  /** Marks the label and lets screen readers announce the requirement. */
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Label, control, and message in one place.
 *
 * Pass `aria-describedby={describedBy(htmlFor, …)}` and `aria-invalid` on the
 * control so the message is announced; the helpers below build the ids.
 */
export function Field({
  htmlFor,
  label,
  hint,
  error,
  required = false,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-text">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children}

      {error !== undefined ? (
        <p id={errorId(htmlFor)} className="text-xs text-danger">
          {error}
        </p>
      ) : (
        hint !== undefined && (
          <p id={hintId(htmlFor)} className="text-xs text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** Id of the error message belonging to a field. */
export function errorId(fieldId: string): string {
  return `${fieldId}-error`;
}

/** Id of the hint belonging to a field. */
export function hintId(fieldId: string): string {
  return `${fieldId}-hint`;
}

/** Builds the aria-describedby value for a control, given what is showing. */
export function describedBy(
  fieldId: string,
  options: { hasError?: boolean; hasHint?: boolean },
): string | undefined {
  if (options.hasError === true) {
    return errorId(fieldId);
  }

  return options.hasHint === true ? hintId(fieldId) : undefined;
}
