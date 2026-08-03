"use client";

import { useState } from "react";
import { Target, Sparkles, GitBranch } from "lucide-react";
import type { NcrDto } from "@kaenal/types";
import { EmptyState, Skeleton } from "@/components/ui";
import { useEightD } from "@/hooks/use-eightd";
import { stepData } from "@/features/eightd/eightd-bits";

interface WhyRow {
  why?: string;
  answer?: string;
}

/**
 * NCR Investigation tab (ncr.jsx `NCRInvestigation`): a free-text root-cause field
 * with an AI-suggest affordance, plus the 5-Whys chain sourced from the NCR's
 * linked 8D (D4). Root cause is local until an NCR root-cause endpoint exists
 * (05 — parity with the prototype, which also holds it client-side); the 5-Whys
 * are read live from the 8D so the two stay in sync.
 */
export function NcrInvestigationTab({ ncr }: { ncr: NcrDto }): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <RootCauseCard eightDId={ncr.eightDId} />
      <div className="k-surface p-5">
        <div className="mb-3 text-[15px] font-semibold">5 Whys (linked from 8D)</div>
        {ncr.eightDId !== null ? (
          <FiveWhysFromEightD eightDId={ncr.eightDId} />
        ) : (
          <EmptyState
            icon={GitBranch}
            title="No linked 8D"
            body="Start an 8D from this NCR to run a structured 5-Whys root-cause analysis."
          />
        )}
      </div>
    </div>
  );
}

const AI_SUGGESTION =
  "Solder-paste viscosity drift on SMT line 3 caused by an ambient-humidity excursion " +
  "(62% RH vs. spec ≤45% RH). Underlying cause: the HVAC dehumidifier coil was fouled — the " +
  "PM interval was extended in Q3 without verification. Corroborated by the linked 8D (D4, " +
  "3 of 5 Whys converge here).";

function RootCauseCard({ eightDId }: { eightDId: string | null }): React.ReactElement {
  const [rootCause, setRootCause] = useState(
    eightDId !== null ? "Pending — investigation underway via the linked 8D." : "",
  );
  const [suggesting, setSuggesting] = useState(false);

  const suggest = (): void => {
    setSuggesting(true);
    window.setTimeout(() => {
      setRootCause(AI_SUGGESTION);
      setSuggesting(false);
    }, 850);
  };

  return (
    <div className="k-surface p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <Target size={18} />
        <div className="text-[15px] font-semibold">Root cause</div>
        <button
          type="button"
          className="k-btn k-btn-sm ml-auto"
          onClick={suggest}
          disabled={suggesting}
          style={{
            background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(219,39,119,0.15))",
            color: "var(--accent)",
            border: "1px solid var(--border)",
            cursor: suggesting ? "wait" : "pointer",
          }}
        >
          <Sparkles size={12} /> {suggesting ? "Thinking…" : "Suggest with AI"}
        </button>
      </div>
      <textarea
        className="k-input"
        rows={3}
        style={{ height: "auto", padding: 12 }}
        placeholder="Document the verified root cause…"
        value={rootCause}
        onChange={(e) => setRootCause(e.target.value)}
      />
    </div>
  );
}

function FiveWhysFromEightD({ eightDId }: { eightDId: string }): React.ReactElement {
  const { data: report, isLoading, isError } = useEightD(eightDId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  }
  if (isError || report === undefined) {
    return <EmptyState icon={GitBranch} title="Couldn't load the linked 8D" body="Please retry in a moment." />;
  }

  const rows = ((stepData(report, "d4")["fiveWhys"] ?? []) as WhyRow[]).filter((r) => r.why);
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={GitBranch}
        title="5-Whys not started"
        body={`The linked 8D (${report.code}) hasn't captured its D4 root-cause chain yet.`}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <div
            className="flex shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
            style={{ width: 28, height: 28, background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            {i + 1}
          </div>
          <div className="flex-1 rounded-md p-3" style={{ background: "var(--bg-subtle)" }}>
            <div className="mb-0.5 text-[12px] text-muted">{row.why}</div>
            <div className="text-[13px] font-medium">→ {row.answer}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
