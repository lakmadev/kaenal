import { useTranslations } from "next-intl";
import { WIZARD_TYPES, WIZARD_TYPE_ORDER, type WizardType } from "@kaenal/core";
import { WIZARD_ICON, WIZARD_COLOR } from "./wizard-meta";

/**
 * Step 0 — "What would you like to create?" (createwizard.jsx `renderStep0` /
 * `TypeCard`). Only the caller's creatable types are offered (capability gate);
 * the grid still renders 2 columns as in the jsx.
 */
export function TypeStep({
  types,
  selected,
  onSelect,
}: {
  types: readonly WizardType[];
  selected: WizardType | null;
  onSelect: (t: WizardType) => void;
}): React.ReactElement {
  const t = useTranslations("wizard");
  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "24px 32px" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>{t("typeTitle")}</h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 8 }}>{t("typeSub")}</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        {WIZARD_TYPE_ORDER.filter((k) => types.includes(k)).map((k) => {
          const def = WIZARD_TYPES[k];
          const Icon = WIZARD_ICON[k];
          const color = WIZARD_COLOR[k];
          const isSelected = selected === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onSelect(k)}
              aria-pressed={isSelected}
              style={{
                padding: 20,
                textAlign: "left",
                background: isSelected ? `${color}08` : "var(--surface)",
                border: `2px solid ${isSelected ? color : "var(--border)"}`,
                borderRadius: "var(--r-lg)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                cursor: "pointer",
                boxShadow: isSelected ? `0 0 0 4px ${color}14` : "none",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "var(--r-md)",
                  background: `${color}18`,
                  color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={20} strokeWidth={1.75} aria-hidden />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{def.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{def.desc}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
