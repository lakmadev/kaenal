"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Check, Database, Lock, Play, Upload } from "lucide-react";
import type {
  DedupePolicy,
  ImportRowResult,
  ImportRunDto,
  ImportTargetDto,
} from "@kaenal/types";
import { ApiRequestError } from "@kaenal/api-client";
import { useCan } from "@/hooks/use-me";
import { useCommitImportRun, useCreateImportRun, useImportTargets } from "@/hooks/use-import";
import { EmptyState, Spinner, useToast } from "@/components/ui";
import { SettingsPage } from "../settings-bits";

/**
 * Bulk import (operations.jsx `BulkImport`, design rule #9) wired to the real
 * pipeline (09 §6). The five steps — Source → Map fields → Validate → Dry run →
 * Commit — run against the live engine: create-run validates + dry-runs the
 * pasted rows (writing nothing) and returns the counts + row-level results; only
 * Commit writes, idempotently by natural key. Admin/manager only (`import:run`).
 */

const STEPS = ["Source", "Map fields", "Validate", "Dry run", "Commit"] as const;

const SAMPLE_CSV = `Code,Name,Status,Risk,Tier
IMP-ACME-01,Acme Stamping,active,low,1
IMP-ACME-02,Bolt & Nut Co,active,medium,2
IMP-ACME-03,,active,high,2
IMP-ACME-04,Precision Cast,frozen,low,1`;

/** Minimal CSV parse (comma-separated, first row = headers). Good enough for the
 *  paste box; a production importer streams the uploaded file server-side. */
function parseCsv(text: string): { columns: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { columns: [], rows: [] };
  const columns = splitLine(lines[0]!);
  const rows = lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const row: Record<string, string> = {};
    columns.forEach((col, i) => (row[col] = cells[i] ?? ""));
    return row;
  });
  return { columns, rows };
}

function splitLine(line: string): string[] {
  return line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
}

const DEDUPE: { value: DedupePolicy; label: string }[] = [
  { value: "update", label: "Update existing" },
  { value: "skip", label: "Skip existing" },
  { value: "create", label: "Always create" },
];

export function BulkImportSection(): React.ReactElement {
  const canImport = useCan("import:run");
  const toast = useToast();
  const targetsQ = useImportTargets();
  const createRun = useCreateImportRun();
  const commitRun = useCommitImportRun();

  const [step, setStep] = useState(0);
  const [csv, setCsv] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dedupe, setDedupe] = useState<DedupePolicy>("update");
  const [run, setRun] = useState<ImportRunDto | null>(null);

  const target: ImportTargetDto | undefined = targetsQ.data?.items[0];
  const parsed = useMemo(() => parseCsv(csv), [csv]);

  if (!canImport || (targetsQ.isError && !targetsQ.isPending)) {
    return (
      <SettingsPage title="Bulk import" subtitle="Migrate masters data from CSV / Excel">
        <div className="k-surface">
          <EmptyState
            icon={Lock}
            title="Restricted to admins & managers"
            body="Running a bulk import writes masters data across the workspace and requires the Import capability."
          />
        </div>
      </SettingsPage>
    );
  }

  if (targetsQ.isPending || target === undefined) {
    return (
      <SettingsPage title="Bulk import" subtitle="Migrate masters data from CSV / Excel">
        <div className="flex items-center justify-center py-20 text-muted">
          <Spinner /> <span className="ml-2 text-[13px]">Loading targets…</span>
        </div>
      </SettingsPage>
    );
  }

  const naturalKey = target.fields.find((f) => f.naturalKey);

  /** Auto-suggest a mapping by matching column names to field keys/labels. */
  const autoMap = (): void => {
    const next: Record<string, string> = {};
    for (const field of target.fields) {
      const hit = parsed.columns.find(
        (c) => c.toLowerCase() === field.key.toLowerCase() || c.toLowerCase() === field.label.toLowerCase(),
      );
      if (hit !== undefined) next[field.key] = hit;
    }
    setMapping(next);
  };

  const goToMap = (): void => {
    if (parsed.rows.length === 0) {
      toast.error("Paste at least a header row and one data row");
      return;
    }
    autoMap();
    setStep(1);
  };

  const runValidation = (): void => {
    if (naturalKey !== undefined && mapping[naturalKey.key] === undefined) {
      toast.error(`Map the natural key (${naturalKey.label}) before validating`);
      return;
    }
    createRun.mutate(
      { targetEntity: target.id, mapping, dedupePolicy: dedupe, rows: parsed.rows, transform: {} },
      {
        onSuccess: (created) => {
          setRun(created);
          setStep(2);
        },
        onError: (err) => {
          const msg = err instanceof ApiRequestError && err.status === 422 ? "Mapping is invalid — check the natural key" : "Validation failed";
          toast.error(msg);
        },
      },
    );
  };

  const doCommit = (): void => {
    if (run === null) return;
    commitRun.mutate(
      { id: run.id, body: { version: run.lockVersion } },
      {
        onSuccess: (done) => {
          setRun(done);
          setStep(4);
          toast.success(`Imported — ${done.counts.created} created, ${done.counts.updated} updated`);
        },
        onError: (err) => {
          const stale = err instanceof ApiRequestError && err.status === 409;
          toast.error(stale ? "This run changed — re-validate and try again" : "Commit failed");
        },
      },
    );
  };

  return (
    <SettingsPage
      title="Bulk import"
      subtitle="Migrate masters data from legacy systems (QAD, SAP QM) or a new plant — CSV / Excel."
    >
      <Stepper step={step} />

      {step === 0 && (
        <SourceStep
          csv={csv}
          onChange={setCsv}
          rowCount={parsed.rows.length}
          onSample={() => setCsv(SAMPLE_CSV)}
          onNext={goToMap}
        />
      )}
      {step === 1 && (
        <MapStep
          target={target}
          columns={parsed.columns}
          mapping={mapping}
          dedupe={dedupe}
          onDedupe={setDedupe}
          onMap={(key, col) => setMapping((m) => ({ ...m, ...(col === "" ? removeKey(m, key) : { [key]: col }) }))}
          onBack={() => setStep(0)}
          onNext={runValidation}
          busy={createRun.isPending}
        />
      )}
      {step === 2 && run !== null && (
        <ValidateStep run={run} parsed={parsed} target={target} onBack={() => setStep(1)} onNext={() => setStep(3)} />
      )}
      {step === 3 && run !== null && (
        <DryRunStep run={run} dedupe={dedupe} onBack={() => setStep(2)} onCommit={doCommit} busy={commitRun.isPending} />
      )}
      {step === 4 && run !== null && (
        <CommitStep
          run={run}
          onReset={() => {
            setStep(0);
            setCsv("");
            setMapping({});
            setRun(null);
          }}
        />
      )}
    </SettingsPage>
  );
}

function removeKey(map: Record<string, string>, key: string): Record<string, string> {
  const next = { ...map };
  delete next[key];
  return next;
}

function Stepper({ step }: { step: number }): React.ReactElement {
  return (
    <div className="mb-5 flex items-center rounded-md border border-border bg-surface p-4">
      {STEPS.map((label, i) => (
        <div key={label} className="flex flex-1 items-center last:flex-none">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[12px] font-bold"
              style={{
                background: i < step ? "#22c55e" : i === step ? "var(--accent)" : "var(--bg-subtle)",
                color: i <= step ? "white" : "var(--text-muted)",
              }}
            >
              {i < step ? <Check size={13} strokeWidth={3} /> : i + 1}
            </div>
            <div>
              <div className="text-[11px] text-muted">Step {i + 1}</div>
              <div className="text-[13px] font-semibold">{label}</div>
            </div>
          </div>
          {i < STEPS.length - 1 && (
            <div className="mx-3.5 h-0.5 flex-1 self-center" style={{ background: i < step ? "#22c55e" : "var(--border)" }} />
          )}
        </div>
      ))}
    </div>
  );
}

function Panel({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="k-surface p-0">
      <div className="border-b border-border px-5 py-4">
        <div className="text-[14px] font-semibold">{title}</div>
        {desc !== undefined && <div className="mt-0.5 text-[12px] text-muted">{desc}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function SourceStep({
  csv,
  onChange,
  rowCount,
  onSample,
  onNext,
}: {
  csv: string;
  onChange: (v: string) => void;
  rowCount: number;
  onSample: () => void;
  onNext: () => void;
}): React.ReactElement {
  return (
    <Panel title="Source data" desc="Paste CSV (first row = column headers). A production run streams an uploaded file or a connector drop.">
      <textarea
        className="k-input w-full font-mono text-[12px]"
        rows={10}
        style={{ height: "auto" }}
        placeholder="Code,Name,Status&#10;ACME-1,Acme Stamping,active"
        value={csv}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="mt-3 flex items-center gap-2">
        <button className="k-btn k-btn-ghost" onClick={onSample}>
          <Upload size={12} /> Use sample data
        </button>
        <span className="text-[12px] text-muted">{rowCount} data row{rowCount === 1 ? "" : "s"} detected</span>
        <button className="k-btn k-btn-primary ml-auto" onClick={onNext} disabled={rowCount === 0}>
          Map fields <ArrowRight size={13} />
        </button>
      </div>
    </Panel>
  );
}

function MapStep({
  target,
  columns,
  mapping,
  dedupe,
  onDedupe,
  onMap,
  onBack,
  onNext,
  busy,
}: {
  target: ImportTargetDto;
  columns: string[];
  mapping: Record<string, string>;
  dedupe: DedupePolicy;
  onDedupe: (d: DedupePolicy) => void;
  onMap: (key: string, col: string) => void;
  onBack: () => void;
  onNext: () => void;
  busy: boolean;
}): React.ReactElement {
  return (
    <Panel title={`Map to ${target.label}`} desc="Match each incoming column to a target field. The natural key is required for duplicate detection.">
      <div className="flex flex-col gap-2">
        {target.fields.map((field) => (
          <div key={field.key} className="grid items-center gap-3 border-b border-border py-2 last:border-b-0 sm:[grid-template-columns:220px_1fr]">
            <div className="flex items-center gap-1.5 text-[13px] font-medium">
              {field.label}
              {field.required && <span className="text-[color:var(--danger-600,#dc2626)]">*</span>}
              {field.naturalKey && (
                <span className="k-chip" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                  <Database size={9} /> key
                </span>
              )}
            </div>
            <select
              className="k-input"
              value={mapping[field.key] ?? ""}
              onChange={(e) => onMap(field.key, e.target.value)}
            >
              <option value="">— unmapped —</option>
              {columns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted">On duplicate:</span>
          <select className="k-input" style={{ width: 160 }} value={dedupe} onChange={(e) => onDedupe(e.target.value as DedupePolicy)}>
            {DEDUPE.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <button className="k-btn k-btn-ghost ml-auto" onClick={onBack}>
          Back
        </button>
        <button className="k-btn k-btn-primary" onClick={onNext} disabled={busy}>
          {busy ? "Validating…" : "Validate"} <ArrowRight size={13} />
        </button>
      </div>
    </Panel>
  );
}

/** Aggregate per-row messages into {message → count}, most frequent first. */
function aggregate(results: ImportRowResult[], kind: "errors" | "warnings"): { msg: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of results) for (const m of r[kind]) map.set(m, (map.get(m) ?? 0) + 1);
  return [...map.entries()].map(([msg, count]) => ({ msg, count })).sort((a, b) => b.count - a.count);
}

function Stat({ label, value, color }: { label: string; value: number; color: string }): React.ReactElement {
  return (
    <div className="rounded-md p-3" style={{ background: "var(--bg-subtle)" }}>
      <div className="text-[10.5px] font-semibold uppercase text-muted">{label}</div>
      <div className="text-[22px] font-bold" style={{ color }}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function ValidateStep({
  run,
  parsed,
  target,
  onBack,
  onNext,
}: {
  run: ImportRunDto;
  parsed: { columns: string[]; rows: Record<string, string>[] };
  target: ImportTargetDto;
  onBack: () => void;
  onNext: () => void;
}): React.ReactElement {
  const errors = aggregate(run.result, "errors");
  const warnings = aggregate(run.result, "warnings");
  const mappedFields = target.fields.filter((f) => run.mapping[f.key] !== undefined);

  return (
    <Panel title="Validation results" desc={`Dry-run validation on ${run.counts.total.toLocaleString()} rows — no records written yet`}>
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Total rows" value={run.counts.total} color="var(--text-muted)" />
        <Stat label="Will import" value={run.counts.valid} color="#16a34a" />
        <Stat label="Errors" value={run.counts.errors} color="#dc2626" />
        <Stat label="Warnings" value={run.counts.warnings} color="#f59e0b" />
      </div>

      {errors.length > 0 && (
        <>
          <div className="k-overline mb-2">Errors (blocking — {run.counts.errors})</div>
          <div className="mb-4 rounded-md border p-3" style={{ borderColor: "rgba(220,38,38,0.2)", background: "rgba(220,38,38,0.05)" }}>
            {errors.map((e) => (
              <div key={e.msg} className="flex items-start gap-2.5 py-1">
                <span className="mono shrink-0 rounded px-2 py-px text-[11px] font-bold text-white" style={{ background: "#dc2626" }}>
                  {e.count}×
                </span>
                <span className="text-[12px]" style={{ color: "#7f1d1d" }}>{e.msg}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {warnings.length > 0 && (
        <>
          <div className="k-overline mb-2">Warnings (non-blocking — {run.counts.warnings})</div>
          <div className="mb-4 rounded-md border p-3" style={{ borderColor: "rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.05)" }}>
            {warnings.map((w) => (
              <div key={w.msg} className="flex items-start gap-2.5 py-1">
                <span className="mono shrink-0 rounded px-2 py-px text-[11px] font-bold text-white" style={{ background: "#f59e0b" }}>
                  {w.count}×
                </span>
                <span className="text-[12px]" style={{ color: "#92400e" }}>{w.msg}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="k-overline mb-2">Sample preview (first 4 rows)</div>
      <div className="overflow-auto rounded-md border border-border">
        <table className="w-full text-[12px]" style={{ minWidth: 560 }}>
          <thead style={{ background: "var(--bg-subtle)" }}>
            <tr>
              {mappedFields.map((f) => (
                <th key={f.key} className="px-2.5 py-2 text-left text-[10px] uppercase text-muted">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parsed.rows.slice(0, 4).map((row, i) => (
              <tr key={i} className="border-b border-border last:border-b-0">
                {mappedFields.map((f) => (
                  <td key={f.key} className="px-2.5 py-2">
                    {row[run.mapping[f.key] ?? ""] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button className="k-btn k-btn-ghost" onClick={onBack}>
          Back
        </button>
        <button className="k-btn k-btn-primary ml-auto" onClick={onNext}>
          <Play size={12} /> Continue to dry run
        </button>
      </div>
    </Panel>
  );
}

function DryRunStep({
  run,
  dedupe,
  onBack,
  onCommit,
  busy,
}: {
  run: ImportRunDto;
  dedupe: DedupePolicy;
  onBack: () => void;
  onCommit: () => void;
  busy: boolean;
}): React.ReactElement {
  const blocked = run.counts.errors > 0;
  return (
    <Panel title="Dry run" desc={`Diff by natural key under the "${dedupe}" policy. Committing writes only the ${run.counts.valid.toLocaleString()} valid rows.`}>
      <div className="mb-4 grid grid-cols-3 gap-2.5">
        <Stat label="Create" value={run.counts.created} color="#16a34a" />
        <Stat label="Update" value={run.counts.updated} color="#2563eb" />
        <Stat label="Skip" value={run.counts.skipped} color="#64748b" />
      </div>
      {blocked && (
        <div className="mb-4 flex items-center gap-2 rounded-md border p-3 text-[12px]" style={{ borderColor: "rgba(220,38,38,0.2)", background: "rgba(220,38,38,0.05)", color: "#7f1d1d" }}>
          <AlertTriangle size={14} /> {run.counts.errors} row(s) have blocking errors and will be excluded from the commit.
        </div>
      )}
      <div className="flex items-center gap-2">
        <button className="k-btn k-btn-ghost" onClick={onBack}>
          Back
        </button>
        <button className="k-btn k-btn-primary ml-auto" onClick={onCommit} disabled={busy || run.counts.valid === 0}>
          {busy ? "Committing…" : `Commit ${run.counts.valid.toLocaleString()} rows`} <Check size={13} />
        </button>
      </div>
    </Panel>
  );
}

function CommitStep({ run, onReset }: { run: ImportRunDto; onReset: () => void }): React.ReactElement {
  return (
    <Panel title="Import complete" desc="Rows were upserted idempotently by natural key — re-running the same file updates in place.">
      <div className="mb-4 grid grid-cols-3 gap-2.5">
        <Stat label="Created" value={run.counts.created} color="#16a34a" />
        <Stat label="Updated" value={run.counts.updated} color="#2563eb" />
        <Stat label="Skipped" value={run.counts.skipped} color="#64748b" />
      </div>
      <div className="flex items-center gap-2 rounded-md border border-border p-3 text-[13px]">
        <span className="flex h-6 w-6 items-center justify-center rounded-full text-white" style={{ background: "#22c55e" }}>
          <Check size={13} strokeWidth={3} />
        </span>
        Committed {(run.counts.created + run.counts.updated).toLocaleString()} rows to the workspace.
        <button className="k-btn k-btn-ghost ml-auto" onClick={onReset}>
          New import
        </button>
      </div>
    </Panel>
  );
}
