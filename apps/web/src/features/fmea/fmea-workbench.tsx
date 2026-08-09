"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Pencil, Plus, Trash2 } from "lucide-react";
import { actionPriority as apOf, rpn as rpnOf, type ActionPriority } from "@kaenal/core";
import type { CreateFmeaItemBody, FmeaItemDto, FmeaType } from "@kaenal/types";
import { useCan } from "@/hooks/use-me";
import {
  useCreateFmea,
  useCreateFmeaItem,
  useDeleteFmea,
  useDeleteFmeaItem,
  useFmeaItems,
  useFmeas,
  useUpdateFmeaItem,
} from "@/hooks/use-fmea";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, Dialog, DialogClose, DialogContent, EmptyState, Segmented, Spinner, useToast } from "@/components/ui";

function scoreColor(v: number): string {
  return v >= 9 ? "#dc2626" : v >= 7 ? "#ea580c" : v >= 4 ? "#f59e0b" : "#22c55e";
}
function ScoreBox({ v }: { v: number }): React.ReactElement {
  return (
    <span
      className="inline-flex items-center justify-center rounded font-bold text-white"
      style={{ width: 28, height: 22, fontSize: 11, background: scoreColor(v) }}
    >
      {v}
    </span>
  );
}
const AP_META: Record<ActionPriority, { label: string; color: string }> = {
  H: { label: "HIGH", color: "#dc2626" },
  M: { label: "MEDIUM", color: "#f59e0b" },
  L: { label: "LOW", color: "#22c55e" },
};
function APBadge({ ap }: { ap: ActionPriority }): React.ReactElement {
  const m = AP_META[ap];
  return (
    <span
      className="inline-flex items-center justify-center rounded font-extrabold"
      style={{ padding: "3px 8px", fontSize: 10, letterSpacing: "0.04em", background: `${m.color}18`, color: m.color }}
    >
      {m.label}
    </span>
  );
}

interface ItemForm {
  processFunction: string;
  failureMode: string;
  effect: string;
  severity: number;
  cause: string;
  occurrence: number;
  preventionControl: string;
  detectionControl: string;
  detection: number;
  recommendedAction: string;
}
const EMPTY_ITEM: ItemForm = {
  processFunction: "",
  failureMode: "",
  effect: "",
  severity: 5,
  cause: "",
  occurrence: 5,
  preventionControl: "",
  detectionControl: "",
  detection: 5,
  recommendedAction: "",
};
function toForm(it: FmeaItemDto): ItemForm {
  const { id: _i, fmeaId: _f, seq: _s, rpn: _r, actionPriority: _a, lockVersion: _v, ...rest } = it;
  return rest;
}

/** A simple labelled field wrapper (label above the control). */
function Labeled({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <label className="flex flex-col gap-1">
      <span className="k-overline">{label}</span>
      {children}
    </label>
  );
}

/** A 1–10 rating stepper. */
function RatingInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <input
      type="number"
      className="k-input"
      style={{ width: 64, height: 30 }}
      min={1}
      max={10}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
    />
  );
}

/**
 * FMEA workbench (qms-risk-spc.jsx `FMEAWorkbench`). A per-part PFMEA/DFMEA of
 * failure modes; each row's RPN (S×O×D) and Action Priority (H/M/L) are computed
 * by the API (and previewed live here via the same `@kaenal/core` functions), so
 * editing a rating re-scores the row and the distribution immediately. Faithful
 * to the design's worksheet table + AP distribution + recommended-actions panel;
 * the design's Export-AIAG-form action needs an XLSX exporter (flagged, omitted).
 */
export function FmeaWorkbench(): React.ReactElement {
  const toast = useToast();
  const canManage = useCan("fmea:manage");
  const fmeasQ = useFmeas();
  const fmeas = fmeasQ.data?.items ?? [];

  const [selectedFmea, setSelectedFmea] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [newFmeaOpen, setNewFmeaOpen] = useState(false);
  const [editor, setEditor] = useState<{ mode: "create" } | { mode: "edit"; item: FmeaItemDto } | null>(null);
  const [toDeleteFmea, setToDeleteFmea] = useState(false);

  // Default to the first FMEA once loaded.
  const firstFmeaId = fmeas[0]?.id ?? null;
  useEffect(() => {
    if (selectedFmea === null && firstFmeaId !== null) setSelectedFmea(firstFmeaId);
  }, [firstFmeaId, selectedFmea]);

  const fmea = fmeas.find((f) => f.id === selectedFmea) ?? null;
  const itemsQ = useFmeaItems(selectedFmea);
  const items = itemsQ.data?.items ?? [];
  const deleteFmea = useDeleteFmea();

  const dist = items.reduce(
    (acc, it) => ((acc[it.actionPriority] += 1), acc),
    { H: 0, M: 0, L: 0 } as Record<ActionPriority, number>,
  );
  const detail = items.find((i) => i.id === selectedItem) ?? items[0] ?? null;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <PageHeader
        title="FMEA workbench"
        description="AIAG / VDA harmonized PFMEA — Action Priority scoring and live re-scoring as ratings change."
        actions={
          canManage ? (
            <button className="k-btn k-btn-primary" onClick={() => setNewFmeaOpen(true)}>
              <Plus size={14} /> New FMEA
            </button>
          ) : undefined
        }
      />

      {fmeasQ.isPending ? (
        <div className="flex items-center justify-center py-20 text-muted">
          <Spinner /> <span className="ml-2 text-[13px]">Loading…</span>
        </div>
      ) : fmeas.length === 0 ? (
        <Card>
          <EmptyState
            icon={Plus}
            title="No FMEAs yet"
            body={canManage ? "Create an FMEA for a part to begin analysing its failure modes." : "No FMEAs have been created yet."}
          />
        </Card>
      ) : (
        <>
          {/* Part selector */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="k-input"
              style={{ width: 380, maxWidth: "100%" }}
              value={selectedFmea ?? ""}
              onChange={(e) => {
                setSelectedFmea(e.target.value);
                setSelectedItem(null);
              }}
            >
              {fmeas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.partCode} — {f.partName} ({f.type.toUpperCase()})
                </option>
              ))}
            </select>
            {fmea !== null && (
              <span className="text-[11px] text-muted">
                Rev {fmea.revision} · {fmea.itemCount} failure {fmea.itemCount === 1 ? "mode" : "modes"}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {canManage && (
                <>
                  <button className="k-btn k-btn-primary" onClick={() => setEditor({ mode: "create" })} disabled={fmea === null}>
                    <Plus size={13} /> Add failure mode
                  </button>
                  <button
                    className="k-btn k-btn-secondary"
                    style={{ color: "var(--danger-600)" }}
                    onClick={() => setToDeleteFmea(true)}
                    disabled={fmea === null}
                  >
                    <Trash2 size={13} /> Delete FMEA
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Worksheet */}
          <Card style={{ overflowX: "auto" }}>
            {itemsQ.isPending ? (
              <div className="flex items-center justify-center py-12 text-muted">
                <Spinner /> <span className="ml-2 text-[13px]">Loading…</span>
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={Plus}
                title="No failure modes yet"
                body={canManage ? "Add a failure mode to start scoring this FMEA." : "This FMEA has no failure modes yet."}
              />
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
                <thead style={{ background: "var(--bg-subtle)" }}>
                  <tr>
                    {["#", "Process function", "Failure mode", "Effect", "SEV", "Cause", "OCC", "Prevention", "Detection", "DET", "RPN", "AP", ""].map(
                      (h, i) => (
                        <th
                          key={i}
                          className="text-muted"
                          style={{
                            padding: "8px 10px",
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            textAlign: ["SEV", "OCC", "DET", "RPN", "AP"].includes(h) ? "center" : "left",
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr
                      key={it.id}
                      onClick={() => setSelectedItem(it.id)}
                      style={{
                        cursor: "pointer",
                        background: detail?.id === it.id ? "var(--accent-soft)" : "",
                        borderTop: "1px solid var(--border)",
                      }}
                    >
                      <td style={tdStyle}>{it.seq}</td>
                      <td style={tdStyle}>{it.processFunction}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{it.failureMode}</td>
                      <td style={tdStyle}>{it.effect}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <ScoreBox v={it.severity} />
                      </td>
                      <td style={tdStyle}>{it.cause}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <ScoreBox v={it.occurrence} />
                      </td>
                      <td style={tdStyle}>{it.preventionControl}</td>
                      <td style={tdStyle}>{it.detectionControl}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <ScoreBox v={it.detection} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700 }}>{it.rpn}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <APBadge ap={it.actionPriority} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                        {canManage && (
                          <span className="inline-flex gap-1">
                            <button
                              className="k-btn k-btn-plain k-btn-icon"
                              aria-label={`Edit ${it.failureMode}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditor({ mode: "edit", item: it });
                              }}
                            >
                              <Pencil size={13} />
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* AP distribution + detail */}
          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Action priority distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2.5">
                  {(
                    [
                      { ap: "H" as const, desc: "Action required. Senior management review." },
                      { ap: "M" as const, desc: "Action should be taken. Document if not." },
                      { ap: "L" as const, desc: "Action discretionary." },
                    ]
                  ).map(({ ap, desc }) => (
                    <div
                      key={ap}
                      className="rounded-md border border-border p-3.5"
                      style={{ borderTop: `3px solid ${AP_META[ap].color}` }}
                    >
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[26px] font-bold" style={{ color: AP_META[ap].color }}>
                          {dist[ap]}
                        </span>
                        <span className="text-[12px] text-muted">items</span>
                      </div>
                      <div className="mt-1 text-[12px] font-semibold">{AP_META[ap].label[0] + AP_META[ap].label.slice(1).toLowerCase()} priority</div>
                      <div className="mt-1 text-[11px] leading-tight text-muted">{desc}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3.5 rounded p-2.5 text-[11.5px] text-muted" style={{ background: "var(--bg-subtle)" }}>
                  <strong className="text-text">AP rule (simplified):</strong> Severity 9–10 with Occ ≥ 2 → High; Severity 7–8 with Occ × Det ≥ 6 →
                  High; else RPN ≥ 100 or Sev 9–10 → Medium. Full certified AIAG/VDA table is a later slice.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{detail !== null ? `#${detail.seq} — recommended actions` : "Recommended actions"}</CardTitle>
              </CardHeader>
              <CardContent>
                {detail === null ? (
                  <div className="py-6 text-center text-[12px] text-muted">Select a failure mode to see its actions.</div>
                ) : (
                  <>
                    <div className="mb-1 text-[12.5px] font-semibold">{detail.failureMode}</div>
                    <div className="mb-3 flex items-center gap-2">
                      <APBadge ap={detail.actionPriority} />
                      <span className="text-[11px] text-muted">
                        S{detail.severity} × O{detail.occurrence} × D{detail.detection} = RPN {detail.rpn}
                      </span>
                    </div>
                    <div className="k-overline mb-1.5">Recommended action</div>
                    <div className="rounded p-2.5 text-[12px]" style={{ background: "var(--bg-subtle)" }}>
                      {detail.recommendedAction !== "" ? detail.recommendedAction : <span className="text-muted">No recommended action recorded.</span>}
                    </div>
                    {detail.preventionControl !== "" || detail.detectionControl !== "" ? (
                      <div className="mt-3 flex items-center gap-2 text-[11.5px] text-muted">
                        <span>Prevention: {detail.preventionControl || "—"}</span>
                        <ArrowRight size={12} />
                        <span>Detection: {detail.detectionControl || "—"}</span>
                      </div>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {newFmeaOpen && <NewFmeaDialog onClose={() => setNewFmeaOpen(false)} onCreated={(id) => setSelectedFmea(id)} />}
      {editor !== null && fmea !== null && (
        <ItemEditorDialog
          fmeaId={fmea.id}
          initial={editor.mode === "edit" ? editor.item : null}
          onClose={() => setEditor(null)}
        />
      )}

      <Dialog open={toDeleteFmea} onOpenChange={(o) => !o && setToDeleteFmea(false)}>
        <DialogContent title="Delete this FMEA?" description={`"${fmea?.partCode ?? ""} — ${fmea?.partName ?? ""}" and all its failure modes will be removed.`}>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <button className="k-btn k-btn-secondary">Cancel</button>
            </DialogClose>
            <button
              className="k-btn k-btn-primary"
              style={{ background: "var(--danger-600)" }}
              disabled={deleteFmea.isPending}
              onClick={() => {
                if (fmea === null) return;
                deleteFmea.mutate(fmea.id, {
                  onSuccess: () => {
                    toast.success("FMEA deleted");
                    setSelectedFmea(null);
                  },
                  onError: () => toast.error("Couldn't delete the FMEA"),
                });
                setToDeleteFmea(false);
              }}
            >
              Delete FMEA
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const tdStyle: React.CSSProperties = { padding: 10, fontSize: 11.5, verticalAlign: "top" };

function NewFmeaDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }): React.ReactElement {
  const toast = useToast();
  const create = useCreateFmea();
  const [type, setType] = useState<FmeaType>("pfmea");
  const [partCode, setPartCode] = useState("");
  const [partName, setPartName] = useState("");
  const [err, setErr] = useState("");

  const save = (): void => {
    if (partCode.trim() === "" || partName.trim() === "") return setErr("Enter a part code and name.");
    setErr("");
    create.mutate(
      { type, partCode: partCode.trim(), partName: partName.trim(), revision: 1 },
      {
        onSuccess: (f) => {
          toast.success("FMEA created");
          onCreated(f.id);
          onClose();
        },
        onError: () => toast.error("Couldn't create the FMEA"),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="New FMEA" description="Create a per-part failure-mode analysis.">
        <div className="flex flex-col gap-3">
          <Segmented value={type} onChange={(v) => setType(v)} options={[{ value: "pfmea", label: "PFMEA" }, { value: "dfmea", label: "DFMEA" }]} />
          <input className="k-input" placeholder="Part code — e.g. VBR-3041" value={partCode} onChange={(e) => setPartCode(e.target.value)} />
          <input className="k-input" placeholder="Part name — e.g. Volvo wheel hub bearing assembly" value={partName} onChange={(e) => setPartName(e.target.value)} />
          {err !== "" && <div className="text-[12px]" style={{ color: "#b91c1c" }}>{err}</div>}
          <div className="mt-1 flex justify-end gap-2">
            <DialogClose asChild>
              <button className="k-btn k-btn-secondary">Cancel</button>
            </DialogClose>
            <button className="k-btn k-btn-primary" onClick={save} disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create FMEA"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ItemEditorDialog({
  fmeaId,
  initial,
  onClose,
}: {
  fmeaId: string;
  initial: FmeaItemDto | null;
  onClose: () => void;
}): React.ReactElement {
  const toast = useToast();
  const create = useCreateFmeaItem(fmeaId);
  const update = useUpdateFmeaItem(fmeaId);
  const del = useDeleteFmeaItem(fmeaId);
  const [form, setForm] = useState<ItemForm>(initial !== null ? toForm(initial) : EMPTY_ITEM);
  const [err, setErr] = useState("");
  const set = <K extends keyof ItemForm>(k: K, v: ItemForm[K]): void => setForm((s) => ({ ...s, [k]: v }));

  // Live preview using the same core functions the API scores with.
  const previewRpn = rpnOf(form.severity, form.occurrence, form.detection);
  const previewAp = apOf(form.severity, form.occurrence, form.detection);

  const save = (): void => {
    if (form.failureMode.trim() === "") return setErr("Enter the failure mode.");
    setErr("");
    const body: CreateFmeaItemBody = { ...form, failureMode: form.failureMode.trim() };
    if (initial !== null) {
      update.mutate(
        { itemId: initial.id, body: { ...body, version: initial.lockVersion } },
        { onSuccess: () => (toast.success("Failure mode updated"), onClose()), onError: () => toast.error("Couldn't save") },
      );
    } else {
      create.mutate(body, {
        onSuccess: () => (toast.success("Failure mode added"), onClose()),
        onError: () => toast.error("Couldn't add"),
      });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={initial !== null ? `Edit failure mode #${initial.seq}` : "Add failure mode"} description="Score Severity, Occurrence, and Detection (1–10); Action Priority updates live.">
        <div className="flex flex-col gap-2.5">
          <Labeled label="Process function">
            <input className="k-input" value={form.processFunction} onChange={(e) => set("processFunction", e.target.value)} placeholder="Weld bracket to chassis" />
          </Labeled>
          <Labeled label="Failure mode">
            <input
              className="k-input"
              value={form.failureMode}
              onChange={(e) => set("failureMode", e.target.value)}
              placeholder="Insufficient penetration"
              style={{ borderColor: err !== "" && form.failureMode.trim() === "" ? "var(--danger-500)" : undefined }}
            />
          </Labeled>
          <Labeled label="Effect">
            <input className="k-input" value={form.effect} onChange={(e) => set("effect", e.target.value)} placeholder="Joint fails in field" />
          </Labeled>
          <div className="grid grid-cols-2 gap-2.5">
            <Labeled label="Cause">
              <input className="k-input" value={form.cause} onChange={(e) => set("cause", e.target.value)} placeholder="Wire feed speed drift" />
            </Labeled>
            <Labeled label="Recommended action">
              <input className="k-input" value={form.recommendedAction} onChange={(e) => set("recommendedAction", e.target.value)} placeholder="Weekly auto-calibration" />
            </Labeled>
            <Labeled label="Prevention control">
              <input className="k-input" value={form.preventionControl} onChange={(e) => set("preventionControl", e.target.value)} placeholder="Daily calibration check" />
            </Labeled>
            <Labeled label="Detection control">
              <input className="k-input" value={form.detectionControl} onChange={(e) => set("detectionControl", e.target.value)} placeholder="SPC chart on penetration" />
            </Labeled>
          </div>

          <div className="flex flex-wrap items-end gap-4 rounded-md p-3" style={{ background: "var(--bg-subtle)" }}>
            <div>
              <div className="k-overline mb-1">Severity</div>
              <RatingInput value={form.severity} onChange={(v) => set("severity", v)} />
            </div>
            <div>
              <div className="k-overline mb-1">Occurrence</div>
              <RatingInput value={form.occurrence} onChange={(v) => set("occurrence", v)} />
            </div>
            <div>
              <div className="k-overline mb-1">Detection</div>
              <RatingInput value={form.detection} onChange={(v) => set("detection", v)} />
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="text-center">
                <div className="k-overline mb-1">RPN</div>
                <div className="text-[18px] font-bold">{previewRpn}</div>
              </div>
              <div className="text-center">
                <div className="k-overline mb-1">Action priority</div>
                <APBadge ap={previewAp} />
              </div>
            </div>
          </div>

          {err !== "" && <div className="text-[12px]" style={{ color: "#b91c1c" }}>{err}</div>}
          <div className="mt-1 flex items-center gap-2">
            {initial !== null && (
              <button
                className="k-btn k-btn-secondary mr-auto"
                style={{ color: "var(--danger-600)" }}
                disabled={del.isPending}
                onClick={() =>
                  del.mutate(initial.id, {
                    onSuccess: () => (toast.success("Failure mode removed"), onClose()),
                    onError: () => toast.error("Couldn't remove"),
                  })
                }
              >
                <Trash2 size={13} /> Remove
              </button>
            )}
            <DialogClose asChild>
              <button className={`k-btn k-btn-secondary ${initial === null ? "ml-auto" : ""}`}>Cancel</button>
            </DialogClose>
            <button className="k-btn k-btn-primary" onClick={save} disabled={create.isPending || update.isPending}>
              {create.isPending || update.isPending ? "Saving…" : initial !== null ? "Save" : "Add failure mode"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
