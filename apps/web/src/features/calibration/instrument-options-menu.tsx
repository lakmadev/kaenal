"use client";

import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { History, MoreHorizontal, RefreshCw, XOctagon } from "lucide-react";
import type { InstrumentDto } from "@kaenal/types";
import { useRetireInstrument, useUpdateInstrument } from "@/hooks/use-instruments";
import { useAreas, usePlants } from "@/hooks/use-create-wizard";
import { Button, Dialog, DialogClose, DialogContent } from "@/components/ui";
import { apiErrorInfo } from "@/lib/api-error";
import { CalibrationHistoryDialog } from "./calibration-history-dialog";

/**
 * The register/detail card "⋯" menu (C4; `qms-modules.jsx:302`'s single
 * button, `kToast('Instrument options — history, retire, transfer')` — three
 * named actions, dead in the prototype). Design: Board 4,
 * `InstrumentOptionsMenu.dc.html`. All three real here, matching the mock's
 * own named scope exactly.
 */
export function InstrumentOptionsMenu({ instrument, canManage }: { instrument: InstrumentDto; canManage: boolean }): React.ReactElement {
  const [dialog, setDialog] = useState<"history" | "transfer" | "retire" | null>(null);

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="ghost" size="icon" aria-label="Instrument options">
            <MoreHorizontal size={14} />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={6} className="k-surface fade-in z-50 w-[220px] overflow-hidden p-1.5 shadow-xl">
            <DropdownMenu.Item
              onSelect={() => setDialog("history")}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] hover:bg-bg-subtle"
            >
              <History size={14} /> View full history
            </DropdownMenu.Item>
            {canManage && (
              <>
                <DropdownMenu.Item
                  onSelect={() => setDialog("transfer")}
                  disabled={instrument.status === "retired"}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] hover:bg-bg-subtle disabled:opacity-40"
                >
                  <RefreshCw size={14} /> Transfer (plant / area)
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => setDialog("retire")}
                  disabled={instrument.status === "retired"}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] hover:bg-[rgba(220,38,38,0.08)] disabled:opacity-40"
                  style={{ color: "var(--danger-600)" }}
                >
                  <XOctagon size={14} /> {instrument.status === "retired" ? "Retired" : "Retire instrument"}
                </DropdownMenu.Item>
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {dialog === "history" && <CalibrationHistoryDialog instrument={instrument} onClose={() => setDialog(null)} />}
      {dialog === "transfer" && <TransferDialog instrument={instrument} onClose={() => setDialog(null)} />}
      {dialog === "retire" && <RetireConfirmDialog instrument={instrument} onClose={() => setDialog(null)} />}
    </>
  );
}

/** Retire confirm (C4 AC1: one-way active -> retired, `lockVersion`-guarded). */
function RetireConfirmDialog({ instrument, onClose }: { instrument: InstrumentDto; onClose: () => void }): React.ReactElement {
  const retire = useRetireInstrument();
  const [err, setErr] = useState("");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Retire ${instrument.code}?`}>
        <div className="flex flex-col gap-3">
          <p className="text-[12px] leading-relaxed text-muted">
            This instrument stops appearing in the Due/Overdue KPI tiles and the default register filter, but
            stays visible under Status = Retired for history and audit. This is a one-way transition — there is
            no &quot;reactivate&quot; action yet.
          </p>
          {err !== "" && (
            <div className="text-[12px]" style={{ color: "var(--danger-600)" }}>
              {err}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              variant="danger"
              loading={retire.isPending}
              onClick={() =>
                retire.mutate(
                  { id: instrument.id, body: { lockVersion: instrument.lockVersion } },
                  {
                    onSuccess: () => onClose(),
                    onError: (e) => {
                      const info = apiErrorInfo(e);
                      if (info?.status === 409) onClose();
                      else setErr(info?.message ?? "Couldn't retire the instrument.");
                    },
                  },
                )
              }
            >
              Retire instrument
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Transfer (C4 AC2) — the same `PATCH /v1/instruments/:id` as Edit, focused
 *  on plant/area only. Only offers areas that belong to the selected plant
 *  (server-enforced too, but this avoids a round-trip 422). */
function TransferDialog({ instrument, onClose }: { instrument: InstrumentDto; onClose: () => void }): React.ReactElement {
  const update = useUpdateInstrument();
  const plants = usePlants();
  const [plantId, setPlantId] = useState(instrument.plantId);
  const [areaId, setAreaId] = useState<string | null>(instrument.areaId);
  const [err, setErr] = useState("");
  const areas = useAreas(plantId);

  function save(): void {
    setErr("");
    update.mutate(
      { id: instrument.id, body: { plantId, areaId, lockVersion: instrument.lockVersion } },
      {
        onSuccess: () => onClose(),
        onError: (e) => {
          const info = apiErrorInfo(e);
          if (info?.status === 409) onClose();
          else setErr(info?.message ?? "Couldn't transfer the instrument.");
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Transfer ${instrument.code}`}>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="k-overline">Plant</span>
            <select
              className="k-input"
              value={plantId}
              onChange={(e) => {
                setPlantId(e.target.value);
                setAreaId(null);
              }}
            >
              {(plants.data?.items ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="k-overline">Area</span>
            <select className="k-input" value={areaId ?? ""} onChange={(e) => setAreaId(e.target.value === "" ? null : e.target.value)}>
              <option value="">— none —</option>
              {(areas.data?.items ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[10.5px] italic text-muted">
            All other fields (name/type/method/tolerance/interval/owner) are unchanged — same edit surface as
            Edit, only plant/area pre-focused.
          </p>
          {err !== "" && (
            <div className="text-[12px]" style={{ color: "var(--danger-600)" }}>
              {err}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="primary" loading={update.isPending} onClick={save}>
              Save transfer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
