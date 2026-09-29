"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import type { RiskControlInput, RiskControlKind, RiskControlStrength, RiskDto } from "@kaenal/types";
import { useUpdateRisk } from "@/hooks/use-risks";
import { Button, EmptyState, useToast } from "@/components/ui";
import { apiErrorInfo } from "@/lib/api-error";
import { useOnline } from "@/hooks/use-online";

const KIND_OPTIONS: { id: RiskControlKind; label: string }[] = [
  { id: "detective", label: "Detective" },
  { id: "preventive", label: "Preventive" },
  { id: "corrective", label: "Corrective" },
  { id: "contingency", label: "Contingency" },
];

const STRENGTH_OPTIONS: { id: RiskControlStrength; label: string }[] = [
  { id: "strong", label: "strong" },
  { id: "medium", label: "medium" },
  { id: "weak", label: "weak" },
];

const STRENGTH_STYLE: Record<RiskControlStrength, { bg: string; fg: string }> = {
  strong: { bg: "rgba(34,197,94,0.12)", fg: "var(--success-700)" },
  medium: { bg: "rgba(245,158,11,0.12)", fg: "#92400e" },
  weak: { bg: "rgba(220,38,38,0.1)", fg: "#b91c1c" },
};

interface Row {
  id?: string;
  kind: RiskControlKind;
  description: string;
  strength: RiskControlStrength;
}

function toRows(risk: RiskDto): Row[] {
  return [...risk.controls]
    .sort((a, b) => a.seq - b.seq)
    .map((c) => ({ id: c.id, kind: c.kind, description: c.description, strength: c.strength }));
}

/**
 * R2 — the risk detail card's "Controls" sub-list. Real per-risk add/edit/
 * remove/reorder, submitted as a full `controls[]` replace on the SAME
 * `PATCH /v1/risks/:id` that edits the parent risk (R2 AC2) — every save here
 * re-sends the risk's own current field values unchanged, so a controls-only
 * edit never touches category/title/score/etc. Keyed by `risk.id` from the
 * parent so its local draft resets cleanly when the selected risk changes,
 * rather than an effect syncing it.
 */
export function RiskControlsEditor({ risk, canManage }: { risk: RiskDto; canManage: boolean }): React.ReactElement {
  const toast = useToast();
  const online = useOnline();
  const update = useUpdateRisk();
  const canWrite = canManage && online;
  const [rows, setRows] = useState<Row[]>(() => toRows(risk));
  const [editing, setEditing] = useState<{ index: number | null; kind: RiskControlKind; description: string; strength: RiskControlStrength } | null>(
    null,
  );
  const [err, setErr] = useState("");

  function save(next: Row[]): void {
    const controls: RiskControlInput[] = next.map((r, i) => ({
      ...(r.id !== undefined ? { id: r.id } : {}),
      kind: r.kind,
      description: r.description,
      strength: r.strength,
      seq: i,
    }));
    update.mutate(
      {
        id: risk.id,
        body: {
          category: risk.category,
          title: risk.title,
          owner: risk.owner,
          likelihood: risk.likelihood,
          impact: risk.impact,
          residualScore: risk.residualScore,
          trend: risk.trend,
          treatment: risk.treatment,
          status: risk.status,
          plan: risk.plan,
          reviewDue: risk.reviewDue,
          lockVersion: risk.lockVersion,
          controls,
        },
      },
      {
        onSuccess: (updated) => {
          setRows(toRows(updated));
          setEditing(null);
          setErr("");
        },
        onError: (e) => {
          const info = apiErrorInfo(e);
          if (info?.status === 409) {
            toast.error("This risk changed elsewhere — reconcile the conflict, then try again.");
          } else {
            setErr(info?.message ?? "Couldn't save the control.");
          }
        },
      },
    );
  }

  function move(index: number, dir: -1 | 1): void {
    const next = [...rows];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    const [a] = next.splice(index, 1);
    if (a === undefined) return;
    next.splice(target, 0, a);
    save(next);
  }

  function remove(index: number): void {
    save(rows.filter((_, i) => i !== index));
  }

  function submitEditor(): void {
    if (editing === null) return;
    if (editing.description.trim() === "") {
      setErr("Enter a description.");
      return;
    }
    const row: Row = { kind: editing.kind, description: editing.description.trim(), strength: editing.strength };
    if (editing.index === null) {
      save([...rows, row]);
    } else {
      const existing = rows[editing.index];
      save(rows.map((r, i) => (i === editing.index ? (existing?.id !== undefined ? { ...row, id: existing.id } : row) : r)));
    }
  }

  return (
    <div>
      <div className="k-overline mb-1.5">Controls</div>

      {rows.length === 0 && editing === null ? (
        <EmptyState
          title="No controls recorded"
          body={canWrite ? "Record the detective, preventive, corrective and contingency controls in place for this risk." : "No controls have been recorded for this risk."}
          {...(canWrite
            ? {
                action: (
                  <Button variant="ghost" size="sm" onClick={() => setEditing({ index: null, kind: "detective", description: "", strength: "strong" })}>
                    <Plus size={13} aria-hidden /> Add control
                  </Button>
                ),
              }
            : {})}
        />
      ) : (
        <div className="flex flex-col gap-1">
          {rows.map((c, i) => (
            <div
              key={c.id ?? `draft-${i}`}
              className="flex items-center gap-2 rounded-[4px] px-2 py-1.5 text-[11.5px]"
              style={{ background: "var(--bg-subtle)" }}
            >
              <span className="k-chip" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                {KIND_OPTIONS.find((k) => k.id === c.kind)?.label ?? c.kind}
              </span>
              <span className="flex-1">{c.description}</span>
              <span className="k-chip" style={{ background: STRENGTH_STYLE[c.strength].bg, color: STRENGTH_STYLE[c.strength].fg }}>
                {c.strength}
              </span>
              {canWrite && (
                <span className="flex shrink-0 items-center gap-0.5">
                  <button type="button" className="k-btn k-btn-icon k-btn-plain" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp size={12} />
                  </button>
                  <button
                    type="button"
                    className="k-btn k-btn-icon k-btn-plain"
                    aria-label="Move down"
                    disabled={i === rows.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown size={12} />
                  </button>
                  <button
                    type="button"
                    className="k-btn k-btn-icon k-btn-plain"
                    aria-label={`Edit ${c.description}`}
                    onClick={() => setEditing({ index: i, kind: c.kind, description: c.description, strength: c.strength })}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    className="k-btn k-btn-icon k-btn-plain"
                    style={{ color: "var(--danger-600)" }}
                    aria-label={`Remove ${c.description}`}
                    onClick={() => remove(i)}
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              )}
            </div>
          ))}
          {canWrite && editing === null && (
            <button
              type="button"
              className="k-btn k-btn-ghost mt-1 self-start"
              onClick={() => setEditing({ index: null, kind: "detective", description: "", strength: "strong" })}
            >
              <Plus size={13} aria-hidden /> Add control
            </button>
          )}
        </div>
      )}

      {editing !== null && (
        <div className="k-surface mt-2 flex flex-col gap-2 p-3">
          <div>
            <div className="k-overline mb-1" style={{ fontSize: 10 }}>
              Type
            </div>
            <div className="flex flex-wrap gap-1.5">
              {KIND_OPTIONS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  aria-pressed={editing.kind === k.id}
                  onClick={() => setEditing({ ...editing, kind: k.id })}
                  className="k-chip"
                  style={{
                    background: editing.kind === k.id ? "var(--accent)" : "var(--bg-subtle)",
                    color: editing.kind === k.id ? "white" : "var(--text)",
                    padding: "5px 10px",
                  }}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1">
            <span className="k-overline" style={{ fontSize: 10 }}>
              Description
            </span>
            <input
              className="k-input"
              value={editing.description}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              autoFocus
            />
          </label>
          <div>
            <div className="k-overline mb-1" style={{ fontSize: 10 }}>
              Strength
            </div>
            <div className="flex gap-1.5">
              {STRENGTH_OPTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={editing.strength === s.id}
                  onClick={() => setEditing({ ...editing, strength: s.id })}
                  className="k-chip"
                  style={{
                    background: editing.strength === s.id ? "var(--accent)" : "var(--bg-subtle)",
                    color: editing.strength === s.id ? "white" : "var(--text)",
                    padding: "5px 10px",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          {err !== "" && (
            <div className="text-[12px]" style={{ color: "var(--danger-600)" }}>
              {err}
            </div>
          )}
          <div className="mt-1 flex gap-2">
            <Button variant="ghost" onClick={() => (setEditing(null), setErr(""))}>
              Cancel
            </Button>
            <Button variant="primary" loading={update.isPending} onClick={submitEditor}>
              Save control
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
