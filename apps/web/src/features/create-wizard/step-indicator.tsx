import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { WIZARD_STEPS } from "@kaenal/core";

/**
 * The 4-dot step indicator (createwizard.jsx `StepIndicator`): a filled dot per
 * completed/current step, a connecting line, and — new for S1-1 — a danger dot
 * with "!" for a step a server 422 failed on (W7-G).
 */
export function StepIndicator({
  current,
  errorStep,
}: {
  current: number;
  errorStep: number | null;
}): React.ReactElement {
  const t = useTranslations("wizard");
  return (
    <div className="flex items-center gap-2" role="group" aria-label={t("steps")}>
      {WIZARD_STEPS.map((label, i) => {
        const hasError = errorStep === i;
        const done = i < current && !hasError;
        const isCurrent = i === current;
        const stateLabel = hasError
          ? t("stepErrors", { name: label })
          : done
            ? t("stepDone", { name: label })
            : isCurrent
              ? t("stepCurrent", { name: label })
              : t("stepTodo", { name: label });
        return (
          <div key={label} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div
                aria-label={stateLabel}
                className="flex items-center justify-center rounded-full text-[11px] font-bold"
                style={{
                  width: 24,
                  height: 24,
                  background: hasError ? "var(--danger-600)" : done || isCurrent ? "var(--accent)" : "var(--bg-subtle)",
                  color: hasError || done || isCurrent ? "white" : "var(--text-muted)",
                  border: isCurrent && !hasError ? "2px solid var(--ring)" : "none",
                  boxShadow: isCurrent && !hasError ? "0 0 0 4px var(--ring)" : "none",
                }}
              >
                {hasError ? "!" : done ? <Check size={12} strokeWidth={3} aria-hidden /> : i + 1}
              </div>
              <span
                className="text-[13px]"
                style={{
                  fontWeight: isCurrent ? 600 : 500,
                  color: hasError ? "var(--danger-600)" : isCurrent || done ? "var(--text)" : "var(--text-muted)",
                }}
              >
                {label}
              </span>
            </div>
            {i < WIZARD_STEPS.length - 1 && (
              <div style={{ width: 32, height: 1, background: i < current ? "var(--accent)" : "var(--border)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
