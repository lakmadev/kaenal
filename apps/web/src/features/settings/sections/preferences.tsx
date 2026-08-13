"use client";

import { useState } from "react";
import { useTheme } from "@/lib/theme";
import { Segmented } from "@/components/ui";
import { SettingsPage, SettingsCard, SettingsRow, Toggle } from "../settings-bits";

/** Preferences (settings.jsx `Preferences`): appearance + behaviour. The theme
 *  selector is wired to the real theme provider (light/dark); the rest is local
 *  until a user-prefs endpoint exists. */
export function PreferencesSection(): React.ReactElement {
  const { theme, setTheme } = useTheme();
  const [density, setDensity] = useState("comfortable");
  const [docOpen, setDocOpen] = useState("modal");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [shortcuts, setShortcuts] = useState(true);
  const [hints, setHints] = useState(true);

  const THEMES: { id: "light" | "dark"; label: string; bg: string }[] = [
    { id: "light", label: "Light", bg: "#ffffff" },
    { id: "dark", label: "Dark", bg: "#0f172a" },
  ];

  return (
    <SettingsPage title="Preferences" subtitle="Personal display and behavior">
      <SettingsCard title="Appearance">
        <SettingsRow label="Theme">
          <div className="flex gap-2.5">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className="flex items-center gap-2 rounded-md p-2.5"
                style={{
                  border: theme === t.id ? "2px solid var(--accent)" : "1px solid var(--border)",
                  background: "var(--surface)",
                }}
              >
                <span className="rounded" style={{ width: 32, height: 22, background: t.bg, border: "1px solid var(--border)" }} />
                <span className="text-[13px]">{t.label}</span>
              </button>
            ))}
          </div>
        </SettingsRow>
        <SettingsRow label="Density">
          <Segmented
            value={density}
            onChange={setDensity}
            options={[
              { value: "compact", label: "Compact" },
              { value: "comfortable", label: "Comfortable" },
              { value: "spacious", label: "Spacious" },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Accent color">
          <div className="flex gap-1.5">
            {["#18181b", "#2563eb", "#7c3aed", "#0d9488", "#dc2626", "#ea580c"].map((c, i) => (
              <button
                key={c}
                className="rounded-full"
                style={{ width: 28, height: 28, background: c, border: i === 0 ? "2px solid var(--text)" : "2px solid transparent", outline: "1px solid var(--border)" }}
              />
            ))}
          </div>
        </SettingsRow>
        <SettingsRow label="Reduce motion" hint="Minimizes animations across the app">
          <Toggle on={reduceMotion} onChange={setReduceMotion} />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Behavior">
        <SettingsRow label="Default landing page">
          <select className="k-input">
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
        <SettingsRow label="Keyboard shortcuts">
          <Toggle on={shortcuts} onChange={setShortcuts} />
        </SettingsRow>
        <SettingsRow label="Show keyboard hints">
          <Toggle on={hints} onChange={setHints} />
        </SettingsRow>
      </SettingsCard>
    </SettingsPage>
  );
}
