"use client";

import { forwardRef } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { useOnline } from "@/hooks/use-online";
import { Spinner } from "./spinner";
import { Tooltip } from "./tooltip";

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
  /** Why the button is disabled; shown in a tooltip and announced (aria-description). */
  disabledReason?: string | undefined;
}

/**
 * The one button. Composes the `.k-btn` token classes (so a restyle is central)
 * rather than re-declaring colours. `loading` disables + shows a spinner, the
 * standard pending-mutation affordance.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "ghost", size = "md", loading, disabled, children, type, disabledReason, ...props },
  ref,
) {
  const online = useOnline();
  const t = useTranslations("offline");
  // A button that shows a pending state (`loading` given) or submits a form is a
  // write control: it is disabled offline with the reason (S1-5), never silent.
  const isWrite = loading !== undefined || type === "submit";
  const offlineBlocked = isWrite && !online;
  const isDisabled = offlineBlocked || (disabled ?? loading === true);
  const reason = offlineBlocked ? t("writeDisabledReason") : disabledReason;
  const showReason = isDisabled && reason !== undefined;
  const button = (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={isDisabled}
      aria-description={showReason ? reason : undefined}
      className={cn("k-btn", VARIANTS[variant], SIZES[size], className)}
      {...props}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
  if (!showReason) return button;
  // A disabled <button> takes no pointer or focus events, so the tooltip hangs
  // off a focusable wrapper (D-T1); the button keeps aria-description for AT.
  return (
    <Tooltip content={reason}>
      <span tabIndex={0} className="inline-flex">
        {button}
      </span>
    </Tooltip>
  );
});
