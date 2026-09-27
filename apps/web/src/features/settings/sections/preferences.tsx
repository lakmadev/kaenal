"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "@/lib/theme";
import { Segmented, Skeleton } from "@/components/ui";
import { useAppearance } from "@/hooks/use-appearance";
import { SettingsPage, SettingsCard, SettingsRow, Toggle } from "../settings-bits";
import {
  AccentControl,
  AppearanceBanners,
  DensityControl,
  HintsToggle,
  ProminenceControl,
  ShortcutsToggle,
} from "../appearance-controls";

const THEMES: { id: "light" | "dark"; bg: string }[] = [
  { id: "light", bg: "var(--preview-light)" },
  { id: "dark", bg: "var(--preview-dark)" },
];

/**
 * Preferences (settings.jsx `Preferences`, board W10-K). Theme is local to the
 * browser; density, accent, AI prominence and the two keyboard toggles are the
 * signed-in user's saved preferences, the same values the Tweaks panel edits.
 * "Reduce motion", landing page and document-open are unchanged from the design
 * and are not part of S1-9.
 */
export function PreferencesSection(): React.ReactElement {
  const t = useTranslations("tweaks");
  const { theme, setTheme } = useTheme();
  const { isLoading, canUseAi } = useAppearance();
  const [docOpen, setDocOpen] = useState("modal");
  const [reduceMotion, setReduceMotion] = useState(false);

  return (
    <SettingsPage title="Preferences" subtitle="Personal display and behavior">
      <AppearanceBanners />
      {isLoading ? (
        <div className="k-surface mb-4 space-y-4 p-5" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : (
        <>
          <SettingsCard title="Appearance">
            <SettingsRow label={t("theme")}>
              <div className="flex gap-2.5" role="radiogroup" aria-label={t("theme")}>
                {THEMES.map((th) => (
                  <button
                    key={th.id}
                    type="button"
                    role="radio"
                    aria-checked={theme === th.id}
                    onClick={() => setTheme(th.id)}
                    className="flex items-center gap-2 rounded-md p-2.5"
                    style={{
                      border: theme === th.id ? "2px solid var(--accent)" : "1px solid var(--border)",
                      background: "var(--surface)",
                    }}
                  >
                    <span className="rounded" style={{ width: 32, height: 22, background: th.bg, border: "1px solid var(--border)" }} />
                    <span className="text-[13px]">{th.id === "light" ? t("light") : t("dark")}</span>
                  </button>
                ))}
              </div>
            </SettingsRow>
            <SettingsRow label={t("density")} hint="Compact tightens tables and buttons">
              <DensityControl size="md" />
            </SettingsRow>
            <SettingsRow label="Accent color">
              <AccentControl swatch={28} />
            </SettingsRow>
            {canUseAi && (
              <SettingsRow label={t("aiProminence")} hint="How visible the AI button is in the top bar">
                <ProminenceControl size="md" />
              </SettingsRow>
            )}
            <SettingsRow label="Reduce motion" hint="Minimizes animations across the app">
              <Toggle on={reduceMotion} onChange={setReduceMotion} label="Reduce motion" />
            </SettingsRow>
          </SettingsCard>

          <SettingsCard title="Behavior">
            <SettingsRow label="Default landing page">
              <select className="k-input" aria-label="Default landing page">
                <option>Dashboard</option>
                <option>My assignments</option>
                <option>Inspections</option>
                <option>Last visited</option>
              </select>
            </SettingsRow>
            <SettingsRow label="Open documents in">
              <Segmented
                value={docOpen}
                onChange={setDocOpen}
                options={[
                  { value: "modal", label: "Side panel" },
                  { value: "tab", label: "New tab" },
                  { value: "page", label: "Full page" },
                ]}
              />
            </SettingsRow>
            <SettingsRow label={t("keyboardShortcuts")} hint="Turns global key bindings on or off">
              <ShortcutsToggle />
            </SettingsRow>
            <SettingsRow label={t("showHints")} hint="Shows key chips next to actions">
              <HintsToggle />
            </SettingsRow>
          </SettingsCard>
        </>
      )}
    </SettingsPage>
  );
}
