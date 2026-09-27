"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
import { Check, SlidersHorizontal, X } from "lucide-react";
import { Skeleton, Spinner } from "@/components/ui";
import { useAppearance } from "@/hooks/use-appearance";
import { useUiStore } from "@/lib/stores/ui";
import {
  AccentControl,
  AppearanceBanners,
  DensityControl,
  HintsToggle,
  ProminenceControl,
  ShortcutsToggle,
  ThemeControl,
} from "@/features/settings/appearance-controls";

function TweakRow({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-2.5 max-sm:flex-col max-sm:items-start">
      <span className="text-[12px] font-medium text-muted">{label}</span>
      {children}
    </div>
  );
}

/** Footer status line (W10-D): caption, "Saving…", "Saved", or the silent-409 note (W10-G). */
function SaveFooter(): React.ReactElement {
  const t = useTranslations("tweaks");
  const { status, updatedElsewhere } = useAppearance();
  return (
    <div className="flex items-center gap-1.5 text-[11.5px] text-muted" role="status" aria-live="polite">
      {status === "saving" && (
        <>
          <Spinner size={12} /> {t("saving")}
        </>
      )}
      {status === "saved" && (
        <span className="flex items-center gap-1.5" style={{ color: "var(--success-fg)" }}>
          <Check size={12} aria-hidden /> {t("saved")}
        </span>
      )}
      {status !== "saving" && status !== "saved" && (updatedElsewhere ? t("updatedElsewhere") : t("footerIdle"))}
    </div>
  );
}

/**
 * The Appearance / Tweaks panel (ai.jsx `TweaksPanel`, board W10). Fixed bottom
 * right, 300px. Every control applies instantly and saves on change (no Save
 * button); failures revert with a banner and "Try again"; offline locks the
 * controls. Non-modal: Esc, the X or a click outside closes it and focus returns
 * to where it was. Rows omitted from the jsx: Sidebar and Supplier scoring (D-A2).
 */
export function TweaksPanel(): React.ReactElement {
  const t = useTranslations("tweaks");
  const open = useUiStore((s) => s.tweaksOpen);
  const setOpen = useUiStore((s) => s.setTweaksOpen);
  const { isLoading, canUseAi } = useAppearance();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen} modal={false}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="k-surface fade-in fixed bottom-5 right-5 z-[150] max-h-[calc(100vh-40px)] w-[300px] overflow-y-auto p-4 focus:outline-none max-sm:inset-x-0 max-sm:bottom-0 max-sm:w-auto max-sm:rounded-b-none max-sm:px-4 max-sm:pb-6"
          style={{ borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-xl)" }}
        >
          {/* Phone width (W10-L): the panel is a bottom sheet with a drag handle. */}
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden />
          <div className="mb-3 flex items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center bg-accent text-[var(--accent-fg)]"
              style={{ borderRadius: "var(--r-sm)" }}
              aria-hidden
            >
              <SlidersHorizontal size={12} />
            </div>
            <DialogPrimitive.Title className="flex-1 text-[13px] font-bold">{t("title")}</DialogPrimitive.Title>
            <DialogPrimitive.Close aria-label={t("close")} className="k-btn k-btn-plain k-btn-icon -mr-1.5">
              <X size={16} strokeWidth={1.75} />
            </DialogPrimitive.Close>
          </div>

          <AppearanceBanners />

          {isLoading ? (
            <div className="flex flex-col gap-3.5" aria-busy="true">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-7 w-full" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">
              <TweakRow label={t("theme")}>
                <ThemeControl />
              </TweakRow>
              <TweakRow label={t("density")}>
                <DensityControl />
              </TweakRow>
              <TweakRow label={t("accent")}>
                <AccentControl />
              </TweakRow>
              {canUseAi && (
                <TweakRow label={t("aiProminence")}>
                  <ProminenceControl />
                </TweakRow>
              )}
              <div className="my-0.5 h-px bg-border" />
              <div className="k-overline">{t("keyboard")}</div>
              <TweakRow label={t("keyboardShortcuts")}>
                <ShortcutsToggle />
              </TweakRow>
              <TweakRow label={t("showHints")}>
                <HintsToggle />
              </TweakRow>
            </div>
          )}

          <div className="mt-3.5 border-t border-border pt-3">
            <SaveFooter />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
