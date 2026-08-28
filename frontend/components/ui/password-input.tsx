"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

/**
 * A password field that can be read.
 *
 * Every password in this product is typed by somebody setting up an account for
 * another person: a platform administrator issuing a manager, a manager issuing a
 * waiter. They have to read it back to say it out loud or write it down, and a field
 * that cannot be read turns that into a guess. Hiding it by default is still right —
 * a screen in a kitchen or behind a bar is not private — so it starts masked and
 * unmasking is a deliberate press.
 *
 * The toggle is a real button with `type="button"`, which matters more than it looks:
 * inside a form, a button without it submits, so revealing a password would have
 * created the account.
 *
 * Everything else passes straight through to {@link Input}, so a caller keeps its own
 * id, validation, autocomplete and aria wiring. The only prop this component owns is
 * the type.
 */
export function PasswordInput({
  className,
  ...inputProps
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [isVisible, setIsVisible] = useState(false);

  // Ties the button to the field it belongs to for a screen reader. The caller id is
  // used when there is one, so the relationship survives being reused on a page with
  // several password fields.
  const fallbackId = useId();
  const fieldId = inputProps.id ?? fallbackId;

  return (
    <div className="relative">
      <Input
        {...inputProps}
        id={fieldId}
        type={isVisible ? "text" : "password"}
        // Room for the button, so a long password does not run underneath it.
        className={cn("pr-10", className)}
      />

      <button
        type="button"
        // Not `aria-hidden`: somebody using a screen reader has as much reason to check
        // what they typed as anybody else.
        aria-label={isVisible ? "Hide password" : "Show password"}
        aria-pressed={isVisible}
        aria-controls={fieldId}
        // -1 would be tidier visually but takes the control off the keyboard, which is
        // the one way somebody who cannot use a mouse would reach it.
        className={cn(
          "absolute inset-y-0 right-0 flex w-10 items-center justify-center",
          "rounded-r-md text-subtle transition-colors",
          "hover:text-text focus-visible:text-text",
        )}
        onClick={() => setIsVisible((visible) => !visible)}
      >
        {isVisible ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
