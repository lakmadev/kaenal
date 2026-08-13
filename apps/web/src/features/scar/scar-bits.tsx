import { AlertTriangle } from "lucide-react";
import type { ChargebackStatus, ScarSeverity, ScarStatus } from "@kaenal/types";
import { SCAR_D_STEPS } from "@kaenal/core";
import { Chip } from "@/components/ui";

/** SCAR lifecycle colours. `awaiting_d4`/`d5_review` in the visual spec are a
 *  display composition of (status, currentD) — see {@link StageLabel}. */
const STATUS_STYLES: Record<ScarStatus, { label: string; bg: string; fg: string; dot: string }> = {
  draft: { label: "Draft", bg: "rgba(100,116,139,0.16)", fg: "#475569", dot: "#94a3b8" },
  open: { label: "Open", bg: "rgba(245,158,11,0.14)", fg: "#b45309", dot: "#f59e0b" },
  responded: { label: "Responded", bg: "rgba(59,130,246,0.12)", fg: "#1d4ed8", dot: "#3b82f6" },
  closed: { label: "Closed", bg: "rgba(34,197,94,0.14)", fg: "#15803d", dot: "#22c55e" },
  rejected: { label: "Rejected", bg: "rgba(220,38,38,0.12)", fg: "#b91c1c", dot: "#dc2626" },
  cancelled: { label: "Cancelled", bg: "var(--bg-subtle)", fg: "var(--text-muted)", dot: "#cbd5e1" },
};

export function ScarStatusBadge({ status }: { status: ScarStatus }): React.ReactElement {
  const s = STATUS_STYLES[status];
  return (
    <Chip bg={s.bg} fg={s.fg} dot={s.dot} style={{ fontWeight: 600 }}>
      {s.label}
    </Chip>
  );
}

/** The 8D discipline name for the current step (e.g. "D4 · Root Cause"). */
export function stageLabel(currentD: number): string {
  const step = SCAR_D_STEPS.find((s) => s.id === currentD);
  return step ? `D${step.id} · ${step.name}` : `D${currentD}`;
}

const SEVERITY_STYLES: Record<ScarSeverity, { bg: string; fg: string }> = {
  critical: { bg: "rgba(220,38,38,0.10)", fg: "#b91c1c" },
  major: { bg: "rgba(234,88,12,0.10)", fg: "#9a3412" },
  minor: { bg: "rgba(245,158,11,0.12)", fg: "#92400e" },
};

export function SeverityChip({ severity }: { severity: ScarSeverity }): React.ReactElement {
  const s = SEVERITY_STYLES[severity];
  return (
    <Chip bg={s.bg} fg={s.fg} style={{ textTransform: "capitalize" }}>
      {severity}
    </Chip>
  );
}

/** 8D progress: eight squares, green behind, amber on the current step, muted ahead
 *  (matches the `suppliers-ppap.jsx` DSteps). */
export function DSteps({ current, size = 16 }: { current: number; size?: number }): React.ReactElement {
  return (
    <div className="flex gap-0.5">
      {SCAR_D_STEPS.map(({ id }) => {
        const done = id < current;
        const here = id === current;
        return (
          <div
            key={id}
            title={stageLabel(id)}
            className="flex items-center justify-center font-bold"
            style={{
              width: size,
              height: size,
              borderRadius: 3,
              fontSize: size * 0.56,
              background: done ? "#16a34a" : here ? "#f59e0b" : "var(--bg-subtle)",
              color: id <= current ? "white" : "var(--text-muted)",
            }}
          >
            {id}
          </div>
        );
      })}
    </div>
  );
}

const CHARGEBACK_STYLES: Record<ChargebackStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: "Pending", bg: "rgba(245,158,11,0.12)", fg: "#92400e" },
  debit_issued: { label: "Debit issued", bg: "rgba(99,102,241,0.10)", fg: "#4338ca" },
  closed: { label: "Recovered", bg: "rgba(34,197,94,0.10)", fg: "#15803d" },
};

export function ChargebackBadge({ status }: { status: ChargebackStatus | null }): React.ReactElement {
  if (status === null) {
    return (
      <Chip bg="var(--bg-subtle)" fg="var(--text-muted)" style={{ fontSize: 9.5 }}>
        None
      </Chip>
    );
  }
  const s = CHARGEBACK_STYLES[status];
  return (
    <Chip bg={s.bg} fg={s.fg} style={{ fontSize: 9.5 }}>
      {s.label}
    </Chip>
  );
}

export function OverdueChip(): React.ReactElement {
  return (
    <Chip bg="rgba(220,38,38,0.10)" fg="#b91c1c">
      <AlertTriangle size={10} />
      Overdue
    </Chip>
  );
}

/** Format a whole-dollar chargeback amount (no cents) — `$22,400`. */
export function formatMoney(amount: number | null, currency = "USD"): string {
  if (amount === null) return "—";
  const symbol = currency === "USD" ? "$" : `${currency} `;
  return `${symbol}${Math.round(amount).toLocaleString()}`;
}
