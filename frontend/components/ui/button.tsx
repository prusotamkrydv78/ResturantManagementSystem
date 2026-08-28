import Link from "next/link";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-fg border border-primary hover:bg-primary-hover active:bg-primary-active",
  secondary:
    "bg-surface text-text border border-border-strong hover:bg-surface-3 active:bg-surface-3",
  ghost:
    "bg-transparent text-muted border border-transparent hover:bg-surface-3 hover:text-text",
  danger:
    "bg-danger text-white border border-danger hover:bg-danger-hover active:bg-danger-hover",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-2.5 text-sm gap-1.5",
  md: "h-9 px-3.5 text-base gap-2",
};

/** Shared button appearance, so a link that acts as a button matches exactly. */
export function buttonClasses(
  variant: Variant = "primary",
  size: Size = "md",
  className?: string,
): string {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-md font-medium",
    "transition-colors duration-100",
    "disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Leading icon. Pass a lucide icon element. */
  icon?: React.ReactNode;
}

/** The single button in the product. Every action uses one of its variants. */
export function Button({
  variant = "primary",
  size = "md",
  icon,
  className,
  type = "button",
  children,
  ...buttonProps
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      {...buttonProps}
    >
      {icon !== undefined && (
        <span className="shrink-0 [&_svg]:size-4" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}

interface LinkButtonProps extends React.ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
  icon?: React.ReactNode;
}

/**
 * A navigation action that looks like a button. Renders an anchor, because a
 * link inside a button is invalid and breaks keyboard and middle-click
 * behaviour.
 */
export function LinkButton({
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  ...linkProps
}: LinkButtonProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...linkProps}>
      {icon !== undefined && (
        <span className="shrink-0 [&_svg]:size-4" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </Link>
  );
}
