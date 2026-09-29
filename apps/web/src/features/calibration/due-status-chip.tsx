import type { InstrumentDto } from "@kaenal/types";
import { Chip } from "@/components/ui";
import { daysUntil } from "@/lib/format";

/**
 * The register's Status column (`qms-modules.jsx:243-246`) plus the amended
 * failed-calibration severity (Board 1 State C, B3/§5 item 8). Three visually
 * distinct treatments, all within `tokens.css`:
 *  - `ok` — a plain success chip (jsx, unchanged).
 *  - `warn` — amber tint (jsx, unchanged).
 *  - `overdue`, `lastResult !== "fail"` — a red TINT (jsx, unchanged): merely
 *    date-late.
 *  - `overdue`, `lastResult === "fail"` — a solid red FILL, "Failed — overdue"
 *    (new, B3): the instrument may not even be date-overdue yet, so it must
 *    read as a different, higher severity than the plain date-overdue tint.
 */
export function DueStatusChip({ instrument }: { instrument: InstrumentDto }): React.ReactElement {
  const { dueStatus, lastResult, nextDue } = instrument;

  if (dueStatus === "overdue" && lastResult === "fail") {
    return (
      <Chip bg="var(--danger-600)" fg="#fff" style={{ fontWeight: 700 }}>
        ⚠ Failed — overdue
      </Chip>
    );
  }

  if (dueStatus === "overdue") {
    const days = daysUntil(nextDue);
    return (
      <Chip bg="rgba(220,38,38,0.10)" fg="var(--danger-700)">
        Overdue{days !== null ? ` ${Math.abs(days)}d` : ""}
      </Chip>
    );
  }

  if (dueStatus === "warn") {
    const days = daysUntil(nextDue);
    return (
      <Chip bg="rgba(245,158,11,0.12)" fg="var(--warning-700)">
        {days !== null ? `${days}d` : "Due soon"}
      </Chip>
    );
  }

  if (dueStatus === "unscheduled") {
    return <Chip style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>Unscheduled</Chip>;
  }

  return (
    <Chip bg="var(--success-100)" fg="var(--success-700)">
      OK
    </Chip>
  );
}
