"use client";

import { useTranslations } from "next-intl";
import { Check, CloudOff, TriangleAlert } from "lucide-react";
import type { AccentKey, UserPreferencesSettings } from "@kaenal/types";
import { Segmented, Tooltip } from "@/components/ui";
import { useAppearance } from "@/hooks/use-appearance";
import { useTheme } from "@/lib/theme";
import { Toggle } from "./settings-bits";

/**
 * The individual appearance controls shared by the Tweaks panel and the
 * Preferences cards (board W10). Each one reads and writes the same per-user
 * preference through `useAppearance`, so changing one place updates the other
 * instantly. Related small components live together on purpose.
 */

const ACCENTS: readonly AccentKey[] = ["ink", "indigo", "teal", "orange"];

/** Locks its children when offline: 50% opacity, inert, and a tooltip on hover and focus (W10-F). */
export function OfflineGuard({ children }: { children: React.ReactNode }): React.ReactElement {
  const t = useTranslations("tweaks");
  const { offline } = useAppearance();
  if (!offline) return <>{children}</>;
  return (
    <Tooltip content={t("offlineTip")}>
      <div tabIndex={0} role="group" aria-label={t("offlineTip")} className="opacity-50">
        <div inert className="pointer-events-none">
          {children}
        </div>
      </div>
    </Tooltip>
  );
}

function fieldLabel(t: ReturnType<typeof useTranslations>, failed: Partial<UserPreferencesSettings>): string {
  if (failed.density !== undefined) return t("fieldDensity");
  if (failed.accent !== undefined) return t("fieldAccent");
  if (failed.aiProminence !== undefined) return t("fieldAiProminence");
  if (failed.keyboardShortcuts !== undefined) return t("fieldKeyboardShortcuts");
  if (failed.showKeyboardHints !== undefined) return t("fieldShowKeyboardHints");
  return t("fieldLocale");
}

/** The offline warning, the "couldn't save" banner (with Try again) and the load-error banner (W10-E/F/G). */
export function AppearanceBanners(): React.ReactElement {
  const t = useTranslations("tweaks");
  const { offline, failed, retry, isError, reload } = useAppearance();
  return (
    <>
      {offline && (
        <div
          className="mb-3 flex items-start gap-2 rounded-md px-3 py-2 text-[12px]"
          style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}
        >
          <CloudOff size={14} className="mt-px shrink-0" aria-hidden />
          {t("offlineBanner")}
        </div>
      )}
      {failed !== null && (
        <div
          className="mb-3 flex items-start gap-2 rounded-md px-3 py-2 text-[12px]"
          style={{ background: "var(--danger-bg)", color: "var(--danger-fg)" }}
          role="alert"
        >
          <TriangleAlert size={14} className="mt-px shrink-0" aria-hidden />
          <span className="flex-1">{t("failedTitle", { field: fieldLabel(t, failed) })}</span>
          <button type="button" onClick={retry} className="font-semibold underline">
            {t("tryAgain")}
          </button>
        </div>
      )}
      {isError && (
        <div
          className="mb-3 flex items-start gap-2 rounded-md px-3 py-2 text-[12px]"
          style={{ background: "var(--danger-bg)", color: "var(--danger-fg)" }}
          role="alert"
        >
          <TriangleAlert size={14} className="mt-px shrink-0" aria-hidden />
          <span className="flex-1">{t("loadError")}</span>
          <button type="button" onClick={reload} className="font-semibold underline">
            {t("tryAgain")}
          </button>
        </div>
      )}
    </>
  );
}

export function ThemeControl({ size = "sm" }: { size?: "sm" | "md" }): React.ReactElement {
  const t = useTranslations("tweaks");
  const { theme, setTheme } = useTheme();
  return (
    <Segmented
      size={size}
      ariaLabel={t("theme")}
      value={theme}
      onChange={setTheme}
      options={[
        { value: "light", label: t("light") },
        { value: "dark", label: t("dark") },
      ]}
    />
  );
}

export function DensityControl({ size = "sm" }: { size?: "sm" | "md" }): React.ReactElement {
  const t = useTranslations("tweaks");
  const { values, save } = useAppearance();
  return (
    <OfflineGuard>
      <Segmented
        size={size}
        ariaLabel={t("density")}
        value={values.density}
        onChange={(density) => save({ density })}
        options={[
          { value: "comfortable", label: t("comfortable") },
          { value: "compact", label: t("compact") },
        ]}
      />
    </OfflineGuard>
  );
}

export function AccentControl({ swatch = 24 }: { swatch?: number }): React.ReactElement {
  const t = useTranslations("tweaks");
  const { values, save } = useAppearance();
  const labels: Record<AccentKey, string> = {
    ink: t("accentInk"),
    indigo: t("accentIndigo"),
    teal: t("accentTeal"),
    orange: t("accentOrange"),
  };
  return (
    <OfflineGuard>
      <div role="radiogroup" aria-label={t("accent")} className="flex gap-1.5">
        {ACCENTS.map((key) => {
          const active = values.accent === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={labels[key]}
              title={labels[key]}
              onClick={() => save({ accent: key })}
              className="flex items-center justify-center rounded-full"
              style={{
                width: swatch,
                height: swatch,
                background: `var(--swatch-${key})`,
                border: active ? "2px solid var(--text)" : "2px solid transparent",
                outline: "1px solid var(--border)",
              }}
            >
              {/* A check mark, so the selected swatch is never signalled by colour alone. */}
              {active && <Check size={swatch > 24 ? 14 : 12} strokeWidth={3} style={{ color: "var(--surface)" }} aria-hidden />}
            </button>
          );
        })}
      </div>
    </OfflineGuard>
  );
}

export function ProminenceControl({ size = "sm" }: { size?: "sm" | "md" }): React.ReactElement {
  const t = useTranslations("tweaks");
  const { values, save } = useAppearance();
  return (
    <OfflineGuard>
      <Segmented
        size={size}
        ariaLabel={t("aiProminence")}
        value={values.aiProminence}
        onChange={(aiProminence) => save({ aiProminence })}
        options={[
          { value: "front", label: t("front") },
          { value: "normal", label: t("normal") },
          { value: "quiet", label: t("quiet") },
        ]}
      />
    </OfflineGuard>
  );
}

export function ShortcutsToggle(): React.ReactElement {
  const t = useTranslations("tweaks");
  const { values, save, offline } = useAppearance();
  return (
    <OfflineGuard>
      <Toggle
        on={values.keyboardShortcuts}
        label={t("keyboardShortcuts")}
        disabled={offline}
        onChange={(keyboardShortcuts) => save({ keyboardShortcuts })}
      />
    </OfflineGuard>
  );
}

export function HintsToggle(): React.ReactElement {
  const t = useTranslations("tweaks");
  const { values, save, offline } = useAppearance();
  return (
    <OfflineGuard>
      <Toggle
        on={values.showKeyboardHints}
        label={t("showHints")}
        disabled={offline}
        onChange={(showKeyboardHints) => save({ showKeyboardHints })}
      />
    </OfflineGuard>
  );
}
