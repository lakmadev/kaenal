import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

type Variant = "primary" | "ghost" | "plain" | "danger";
type Size = "md" | "sm" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary: "k-btn-primary",
  ghost: "k-btn-ghost",
  plain: "k-btn-plain",
  danger: "k-btn-danger",
};

const SIZES: Record<Size, string> = {
  md: "",
  sm: "k-btn-sm",
  icon: "k-btn-icon",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and disables the button; use for pending mutations. */
  loading?: boolean;
}

/**
 * The one button. Composes the `.k-btn` token classes (so a restyle is central)
 * rather than re-declaring colours. `loading` disables + shows a spinner, the
 * standard pending-mutation affordance.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "ghost", size = "md", loading = false, disabled, children, type, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={disabled ?? loading}
      className={cn("k-btn", VARIANTS[variant], SIZES[size], className)}
      {...props}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
});
