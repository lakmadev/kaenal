"use client";

import { forwardRef } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { useOnline } from "@/hooks/use-online";
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
  { className, variant = "ghost", size = "md", loading, disabled, children, type, title, ...props },
  ref,
) {
  const online = useOnline();
  const t = useTranslations("offline");
  // A button that shows a pending state (`loading` given) or submits a form is a
  // write control: it is disabled offline with the reason (S1-5), never silent.
  const isWrite = loading !== undefined || type === "submit";
  const offlineBlocked = isWrite && !online;
  const reason = t("writeDisabledReason");
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={offlineBlocked || (disabled ?? loading === true)}
      title={offlineBlocked ? reason : title}
      aria-description={offlineBlocked ? reason : undefined}
      className={cn("k-btn", VARIANTS[variant], SIZES[size], className)}
      {...props}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
});
