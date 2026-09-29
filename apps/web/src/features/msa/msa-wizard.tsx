"use client";

import { useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import type { CreateMsaStudyBody, MsaMethod } from "@kaenal/types";
import { Button, Field, Input, Segmented, useToast } from "@/components/ui";
import { errorMessage } from "@/lib/api-error";
import { useCreateMsaStudy, useMsaStudy } from "@/hooks/use-msa";
import { MsaGrid } from "./msa-grid";

/**
 * MSA new-study wizard (M2; board `MsaWizardSteps.dc.html`) — a dedicated
 * 3-step wizard, NOT the shared `CreateWizard` (logged design decision, sprint
 * §2 M2: the appraiser/part/trial dimensions + grid shape don't fit
 * CreateWizard's Type/Details/Assignees/Review steps, mirroring the reasoning
 * already accepted for CAPA's own dialog). Step 1: characteristic/gauge/method/
 * tolerance. Step 2: appraiser/part/trial counts, client-side bound hints (the
 * server's Zod `.superRefine` is the real enforcement — M1 AC4/AC5). Step 3:
 * the empty grid, handed off to `MsaGrid` for entry.
 */
export function MsaWizard({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  /** Pins the newly-created study as the page's selected/active one (`?id=`),
   *  so it stays displayed even after its `status` changes later (complete,
   *  reopen) — the page's own "default to the newest completed study"
   *  fallback would otherwise silently jump to a different record. */
  onCreated?: (id: string) => void;
}): React.ReactElement {
  const toast = useToast();
  const create = useCreateMsaStudy();
  const [step, setStep] = useState(0);
  const [characteristic, setCharacteristic] = useState("");
  const [gaugeLabel, setGaugeLabel] = useState("");
  const [method, setMethod] = useState<MsaMethod>("crossed_anova");
  const [tolerance, setTolerance] = useState("");
  const [nAppraisers, setNAppraisers] = useState(3);
  const [nParts, setNParts] = useState(10);
  const [nTrials, setNTrials] = useState(3);

  const bounds = boundsFor(method);
  const nAppraisersOk = nAppraisers >= bounds.a[0] && nAppraisers <= bounds.a[1];
  const nPartsOk = nParts >= bounds.p[0] && nParts <= bounds.p[1];
  const nTrialsOk = nTrials >= bounds.t[0] && nTrials <= bounds.t[1];
  const dimsValid = nAppraisersOk && nPartsOk && nTrialsOk;

  const step1Valid = characteristic.trim() !== "" && gaugeLabel.trim() !== "";

  function submit(): void {
    const body: CreateMsaStudyBody = {
      characteristic: characteristic.trim(),
      gaugeLabel: gaugeLabel.trim(),
      method,
      nAppraisers,
      nParts,
      nTrials,
      tolerance: tolerance.trim() === "" ? null : Number(tolerance),
    };
    create.mutate(body, {
      onSuccess: (study) => {
        onCreated?.(study.id);
        setStep(2);
      },
      onError: (err) => toast.error(errorMessage(err)),
    });
  }

  // The LIVE cached study, not the frozen `create.data` create-response — once
  // the grid saves/completes/reopens inside this step, those mutations update
  // the query cache (`invalidateStudy` in `use-msa.ts`), and this must reflect
  // that immediately (e.g. flipping the grid to its read-only "completed"
  // rendering right after "Complete study" resolves).
  const createdId = create.data?.id ?? null;
  const liveStudy = useMsaStudy(createdId);
  const study = liveStudy.data ?? create.data ?? null;

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-bg" data-testid="msa-wizard">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X size={14} aria-hidden /> Cancel
          </Button>
          <div style={{ width: 1, height: 24, background: "var(--border)" }} />
          <div className="text-[14px] font-semibold">New MSA study</div>
        </div>
        <WizardDots step={step} />
        <div className="flex gap-2">
          {step > 0 && step < 2 && (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          {step === 0 && (
            <Button variant="primary" onClick={() => setStep(1)} disabled={!step1Valid}>
              Next <ArrowRight size={14} aria-hidden />
            </Button>
          )}
          {step === 1 && (
            <Button
              variant="primary"
              onClick={submit}
              disabled={!dimsValid || create.isPending}
              disabledReason={!dimsValid ? "Fix the counts above before continuing" : undefined}
              {...(create.isPending ? { loading: true } : {})}
            >
              {create.isPending ? "Creating…" : "Create study"} <Check size={14} aria-hidden />
            </Button>
          )}
          {step === 2 && (
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          )}
        </div>
      </header>

      <div className="fade-in mx-auto w-full max-w-2xl flex-1 overflow-y-auto p-8">
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-[16px] font-semibold">Characteristic &amp; gauge</h2>
            <Field label="Characteristic" required>
              {(p) => <Input {...p} value={characteristic} onChange={(e) => setCharacteristic(e.target.value)} placeholder="e.g. Hub bore diameter" />}
            </Field>
            <Field label="Gauge label" required hint="Free-text instrument name (no calibration link yet).">
              {(p) => <Input {...p} value={gaugeLabel} onChange={(e) => setGaugeLabel(e.target.value)} placeholder="e.g. Zeiss Contura CMM #CAL-002" />}
            </Field>
            <Field label="Method" required>
              {() => (
                <Segmented
                  ariaLabel="Method"
                  value={method}
                  onChange={setMethod}
                  options={[
                    { value: "crossed_anova", label: "Crossed (ANOVA)" },
                    { value: "average_range", label: "Average & Range" },
                  ]}
                />
              )}
            </Field>
            <Field label="Tolerance" hint="Optional — drives % Tolerance. Leave blank to show “—”.">
              {(p) => <Input {...p} type="number" step="any" value={tolerance} onChange={(e) => setTolerance(e.target.value)} placeholder="e.g. 0.10" />}
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-[16px] font-semibold">Study dimensions</h2>
            <div
              className="rounded-md p-3 text-[12px] leading-relaxed"
              style={{ border: "1px solid var(--border)", background: "var(--bg-subtle)", color: "var(--text-muted)" }}
            >
              <strong>Average &amp; Range</strong> requires trials 2–3, appraisers 2–3, parts 2–10 (the published
              AIAG K-tables only cover this range). <strong>Crossed (ANOVA)</strong> requires a minimum of 2
              appraisers/2 parts/2 trials. Both methods cap at 10 appraisers / 50 parts / 10 trials. Dimensions are
              locked once the study is created.
            </div>
            <Field label="Appraisers" required error={!nAppraisersOk ? `Must be ${boundsLabel(bounds.a)}` : undefined}>
              {(p) => <Input {...p} type="number" value={nAppraisers} onChange={(e) => setNAppraisers(Number(e.target.value))} min={1} max={10} />}
            </Field>
            <Field label="Parts" required error={!nPartsOk ? `Must be ${boundsLabel(bounds.p)}` : undefined}>
              {(p) => <Input {...p} type="number" value={nParts} onChange={(e) => setNParts(Number(e.target.value))} min={1} max={50} />}
            </Field>
            <Field label="Trials" required error={!nTrialsOk ? `Must be ${boundsLabel(bounds.t)}` : undefined}>
              {(p) => <Input {...p} type="number" value={nTrials} onChange={(e) => setNTrials(Number(e.target.value))} min={1} max={10} />}
            </Field>
            <p className="text-[12px] text-muted">
              {nAppraisers} × {nParts} × {nTrials} = {nAppraisers * nParts * nTrials} cells.
            </p>
          </div>
        )}

        {step === 2 && study !== null && (
          <div className="flex flex-col gap-4">
            <h2 className="text-[16px] font-semibold">Enter measurements</h2>
            <p className="text-[12.5px] text-muted">
              {study.code} — {study.nAppraisers} appraisers × {study.nParts} parts × {study.nTrials} trials.
            </p>
            <MsaGrid study={study} canManage />
          </div>
        )}
      </div>
    </div>
  );
}

function boundsFor(method: MsaMethod): { a: [number, number]; p: [number, number]; t: [number, number] } {
  // Client-side hint only, mirroring the server's Zod `.superRefine` (M1 AC4/
  // AC5, `packages/types/src/dto.ts`'s `CreateMsaStudyBody`) — the server 422s
  // regardless, that schema is the source of truth.
  if (method === "average_range") return { a: [2, 3], p: [2, 10], t: [2, 3] };
  return { a: [2, 10], p: [2, 50], t: [2, 10] };
}

function boundsLabel([min, max]: [number, number]): string {
  return min === max ? `${min}` : `${min}–${max}`;
}

function WizardDots({ step }: { step: number }): React.ReactElement {
  const labels = ["Details", "Dimensions", "Measurements"];
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Wizard steps">
      {labels.map((label, i) => {
        const done = i < step;
        const isCurrent = i === step;
        return (
          <div key={label} className="flex items-center gap-2">
            <div
              aria-label={`${label} — ${done ? "done" : isCurrent ? "current" : "not started"}`}
              className="flex items-center justify-center rounded-full text-[11px] font-bold"
              style={{
                width: 24,
                height: 24,
                background: done || isCurrent ? "var(--accent)" : "var(--bg-subtle)",
                color: done || isCurrent ? "white" : "var(--text-muted)",
                border: isCurrent ? "2px solid var(--ring)" : "none",
              }}
            >
              {done ? <Check size={12} strokeWidth={3} aria-hidden /> : i + 1}
            </div>
            <span className="text-[13px]" style={{ fontWeight: isCurrent ? 600 : 500, color: isCurrent || done ? "var(--text)" : "var(--text-muted)" }}>
              {label}
            </span>
            {i < labels.length - 1 && <div style={{ width: 32, height: 1, background: i < step ? "var(--accent)" : "var(--border)" }} />}
          </div>
        );
      })}
    </div>
  );
}
