"use client";

import { useState } from "react";
import { useAreas, usePlants } from "@/hooks/use-create-wizard";
import { useCreateInstrument } from "@/hooks/use-instruments";
import { useMemberLookup } from "@/hooks/use-members";
import { Button, Dialog, DialogClose, DialogContent } from "@/components/ui";
import { apiErrorInfo } from "@/lib/api-error";
import { INSTRUMENT_TYPE_OPTIONS } from "./instrument-type";
import type { InstrumentType } from "@kaenal/types";

/**
 * "Add instrument" (C6; `qms-modules.jsx:202`'s button, `kToast` only in the
 * prototype — dead in the mock). Design: Board 3, `InstrumentAddForm.dc.html`
 * — a small dedicated modal, not the shared CreateWizard (design decision,
 * logged in the sprint file C6, not gated: the plant→area cascade and 8 flat
 * fields don't fit the wizard's Type/Details/Assignees/Review shape).
 *
 * New instruments start unscheduled — `lastCalibrated`/`nextDue` stay null
 * until the first calibration is recorded (C6 AC1); the code (`CAL-YYYY-NNNN`)
 * is server-assigned, never entered here.
 */
export function InstrumentAddForm({ onClose, onCreated }: { onClose: () => void; onCreated: (instrumentId: string) => void }): React.ReactElement {
  const plants = usePlants();
  const create = useCreateInstrument();
  const members = useMemberLookup();

  const [name, setName] = useState("");
  const [type, setType] = useState<InstrumentType>("cmm");
  const [plantId, setPlantId] = useState("");
  const [areaId, setAreaId] = useState<string | null>(null);
  const [method, setMethod] = useState("");
  const [tolerance, setTolerance] = useState("");
  const [intervalMonths, setIntervalMonths] = useState(6);
  const [owner, setOwner] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const areas = useAreas(plantId !== "" ? plantId : undefined);

  function save(): void {
    if (name.trim() === "") {
      setErr("Enter a name.");
      return;
    }
    if (plantId === "") {
      setErr("Choose a plant.");
      return;
    }
    if (method.trim() === "") {
      setErr("Enter a calibration method.");
      return;
    }
    if (tolerance.trim() === "") {
      setErr("Enter a tolerance.");
      return;
    }
    setErr("");
    create.mutate(
      {
        body: {
          name: name.trim(),
          type,
          plantId,
          areaId,
          method: method.trim(),
          tolerance: tolerance.trim(),
          intervalMonths,
          owner,
        },
        idempotencyKey: crypto.randomUUID(),
      },
      {
        onSuccess: (instrument) => onCreated(instrument.id),
        onError: (e) => setErr(apiErrorInfo(e)?.message ?? "Couldn't create the instrument."),
      },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Add instrument" description="Register a new measurement instrument for calibration tracking.">
        <div className="flex flex-col gap-2.5" style={{ maxHeight: "70vh", overflowY: "auto" }}>
          <label className="flex flex-col gap-1">
            <span className="k-overline">Name *</span>
            <input
              className="k-input"
              placeholder="e.g. Mitutoyo CMM Crysta-Apex S 776"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1">
              <span className="k-overline">Type *</span>
              <select className="k-input" value={type} onChange={(e) => setType(e.target.value as InstrumentType)}>
                {INSTRUMENT_TYPE_OPTIONS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="k-overline">Interval (months) *</span>
              <input
                type="number"
                min={1}
                className="k-input"
                value={intervalMonths}
                onChange={(e) => setIntervalMonths(Math.max(1, Number(e.target.value) || 1))}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1">
              <span className="k-overline">Plant *</span>
              <select
                className="k-input"
                value={plantId}
                onChange={(e) => {
                  setPlantId(e.target.value);
                  setAreaId(null);
                }}
              >
                <option value="">— choose a plant —</option>
                {(plants.data?.items ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="k-overline">Area (optional — cascades from plant)</span>
              <select
                className="k-input"
                disabled={plantId === ""}
                value={areaId ?? ""}
                onChange={(e) => setAreaId(e.target.value === "" ? null : e.target.value)}
              >
                <option value="">{plantId === "" ? "Choose a plant first" : "— none —"}</option>
                {(areas.data?.items ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="k-overline">Method *</span>
            <input
              className="k-input"
              placeholder="e.g. Internal — ISO 10360, or External — NABL accredited"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="k-overline">Tolerance *</span>
            <input className="k-input" placeholder="e.g. ±1.7μm" value={tolerance} onChange={(e) => setTolerance(e.target.value)} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="k-overline">Owner</span>
            <select className="k-input" value={owner ?? ""} onChange={(e) => setOwner(e.target.value === "" ? null : e.target.value)}>
              <option value="">Unassigned</option>
              {[...members.byId.values()].map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-md p-2.5 text-[11px] text-muted" style={{ background: "var(--bg-subtle)" }}>
            New instruments start <strong>unscheduled</strong> — last-calibrated/next-due stay blank until the
            first calibration is recorded. Code (CAL-YYYY-NNNN) is generated on save.
          </div>

          {err !== "" && (
            <div className="text-[12px]" style={{ color: "var(--danger-600)" }}>
              {err}
            </div>
          )}

          <div className="mt-1 flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="primary" loading={create.isPending} onClick={save}>
              Create instrument
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
