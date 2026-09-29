"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, Check, TriangleAlert, X } from "lucide-react";
import { creatableTypes, isWizardType, lastStepFor, stepsFor, WIZARD_TYPES } from "@kaenal/core";
import { Button, EmptyState, Skeleton, useToast } from "@/components/ui";
import { useMe } from "@/hooks/use-me";
import { useOnline } from "@/hooks/use-online";
import { errorMessage, apiErrorInfo } from "@/lib/api-error";
import { OfflineBanner } from "@/components/shell/offline-banner";
import { StepIndicator } from "./step-indicator";
import { TypeStep } from "./type-step";
import { DetailsStep } from "./details-step";
import { AssigneesStep } from "./assignees-step";
import { ReviewStep } from "./review-step";
import { RiskDetailsStep } from "./risk-details-step";
import { RiskReviewStep } from "./risk-review-step";
import { useWizardDraft } from "./use-wizard-draft";
import { usePlants, useWizardCreate, useWizardPublishedTemplates, wizardDetailPath, wizardCode, wizardTitle } from "@/hooks/use-create-wizard";

/**
 * The full-page CreateWizard (createwizard.jsx `CreateWizard`, S1-1). Mounted
 * at `/create/[type]` (a real, refreshable URL). Every step/state the jsx
 * defines, plus the states DESIGN-01 adds on top of it: submitting, offline,
 * server 422 mapped to a step, create-failed + retry, and leave-with-dirty
 * confirm.
 */
export function CreateWizard({ typeParam }: { typeParam: string }): React.ReactElement {
  const t = useTranslations("wizard");
  const router = useRouter();
  const toast = useToast();
  const online = useOnline();
  const { data: me, isLoading: meLoading } = useMe();

  const requestedType = isWizardType(typeParam) ? typeParam : null;
  const allowed = me !== undefined ? creatableTypes(me.capabilities) : [];
  const typeIsUsable = requestedType !== null && allowed.includes(requestedType);

  const presetTemplate = useSearchParams().get("template") ?? undefined;
  const wiz = useWizardDraft(typeIsUsable ? requestedType : null, presetTemplate);
  const plants = usePlants();
  const templates = useWizardPublishedTemplates();
  const create = useWizardCreate();

  // Body scroll lock while the wizard is open (createwizard.jsx) — a browser
  // side effect, not derivable at render time.
  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = orig;
    };
  }, []);

  function leave(): void {
    router.back();
  }

  function requestClose(): void {
    if (wiz.dirty) wiz.setConfirmingLeave(true);
    else leave();
  }

  // Esc to close / confirm (createwizard.jsx); disabled while the discard
  // dialog itself is open (Escape there is handled by the dialog).
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && !wiz.confirmingLeave) requestClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  function submit(): void {
    const wb = wiz.body;
    if (wb === null) return;
    create.mutate(
      { wb, idempotencyKey: wiz.idempotencyKey },
      {
        onSuccess: (created) => {
          toast.success(t("created", { code: wizardCode(created), title: wizardTitle(created) }));
          router.push(wizardDetailPath(created));
        },
        onError: (err) => {
          const info = apiErrorInfo(err);
          if (info?.code === "VALIDATION_FAILED" && info.details !== undefined) {
            const issues = (info.details["issues"] as { path: string; message: string }[] | undefined) ?? [];
            wiz.applyValidationIssues(issues);
          } else {
            wiz.applySubmitError(errorMessage(err));
          }
        },
      },
    );
  }

  if (meLoading) {
    return (
      <div className="fixed inset-0 z-[1000] flex flex-col bg-bg p-8">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="mt-6 h-96 w-full" />
      </div>
    );
  }

  if (requestedType === null) {
    return (
      <FullPageMessage
        title={t("unknownTypeTitle")}
        body={t("noPermissionBody")}
        onBack={() => router.push("/dashboard")}
        backLabel={t("backToDashboard")}
      />
    );
  }

  if (!typeIsUsable) {
    return (
      <FullPageMessage
        title={t("noPermissionTitle")}
        body={t("noPermissionBody")}
        onBack={() => router.push("/dashboard")}
        backLabel={t("backToDashboard")}
      />
    );
  }

  const def = WIZARD_TYPES[requestedType];
  const isRisk = requestedType === "risk";
  const step = wiz.step;
  const errorStep = Object.keys(wiz.fieldErrors).length > 0 ? wiz.step : null;
  const submitting = create.isPending;
  const isLastStep = step === lastStepFor(requestedType);

  const fieldsBanner =
    Object.keys(wiz.fieldErrors).length > 0 && (step === 1 || step === 2) ? (
      <div
        className="mb-4 flex items-start gap-2.5 rounded-md p-3.5 text-[12.5px] leading-relaxed"
        style={{ border: "1px solid rgba(220,38,38,.28)", background: "var(--danger-bg)", color: "var(--danger-fg)" }}
        role="alert"
      >
        <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
        <div>
          <b>{t("fieldsNeedAttention", { count: Object.keys(wiz.fieldErrors).length })}</b>
          <br />
          <span style={{ color: "var(--text)" }}>{t("fixThem")}</span>
        </div>
      </div>
    ) : undefined;

  const submitFailedBanner = wiz.submitError !== null && (
    <div
      className="mb-4 flex items-start gap-2.5 rounded-md p-3.5 text-[12.5px] leading-relaxed"
      style={{ border: "1px solid rgba(220,38,38,.28)", background: "var(--danger-bg)", color: "var(--danger-fg)" }}
      role="alert"
    >
      <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
      <div className="flex-1">
        <b>{t("createFailed", { type: def.label })}</b>
        <br />
        <span style={{ color: "var(--text)" }}>{t("nothingLost")}</span>
      </div>
      <button type="button" onClick={submit} className="k-btn k-btn-ghost k-btn-sm">
        {t("retry")}
      </button>
    </div>
  );

  const nextDisabled = isLastStep ? submitting || !online : !wiz.canGoNext;
  const nextReason = isLastStep ? (!online ? t("offlineReason") : undefined) : (wiz.blocker ?? undefined);

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-bg">
      <OfflineBanner />
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={requestClose} disabled={submitting}>
            <X size={14} aria-hidden /> {t("cancel")}
          </Button>
          <div style={{ width: 1, height: 24, background: "var(--border)" }} />
          <div className="text-[14px] font-semibold">{t("newItem", { type: def.label })}</div>
        </div>
        <StepIndicator current={step} errorStep={errorStep} type={requestedType} />
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="ghost" onClick={wiz.back} disabled={submitting}>
              {t("back")}
            </Button>
          )}
          <Button
            variant="primary"
            onClick={isLastStep ? submit : wiz.next}
            disabled={nextDisabled}
            disabledReason={nextDisabled ? nextReason : undefined}
            {...(submitting ? { loading: true } : {})}
          >
            {submitting ? (
              t("creating")
            ) : isLastStep ? (
              <>
                {t("create", { type: def.label })} <Check size={14} strokeWidth={2.5} aria-hidden />
              </>
            ) : (
              <>
                {t("next")} <ArrowRight size={14} aria-hidden />
              </>
            )}
          </Button>
        </div>
      </header>

      <div className="fade-in flex-1 overflow-y-auto">
        {step === 0 && <TypeStep types={allowed} selected={wiz.draft.type} onSelect={wiz.setType} />}
        {step === 1 && isRisk && (
          <RiskDetailsStep
            draft={wiz.draft}
            fieldErrors={wiz.fieldErrors}
            patch={wiz.patch}
            fieldsNeedAttentionBanner={fieldsBanner}
          />
        )}
        {step === 1 && !isRisk && (
          <DetailsStep
            type={requestedType}
            draft={wiz.draft}
            fieldErrors={wiz.fieldErrors}
            patch={wiz.patch}
            onTemplateSelect={(id) => wiz.patch({ template: id })}
            publishedTemplates={templates.data?.items ?? []}
            templatesLoading={templates.isLoading}
            plants={plants.data?.items ?? []}
            fieldsNeedAttentionBanner={fieldsBanner}
          />
        )}
        {step === 2 && !isRisk && (
          <AssigneesStep
            type={requestedType}
            people={wiz.draft.people}
            onAdd={wiz.addPerson}
            onChangeRole={wiz.changePersonRole}
            onRemove={wiz.removePerson}
          />
        )}
        {/* Risk skips Assignees (R4 AC1(b)): its step 2 is Review, not step 3. */}
        {step === 2 && isRisk && <RiskReviewStep draft={wiz.draft} banner={submitFailedBanner} />}
        {step === 3 && !isRisk && (
          <ReviewStep
            type={requestedType}
            draft={wiz.draft}
            publishedTemplates={templates.data?.items ?? []}
            plants={plants.data?.items ?? []}
            banner={submitFailedBanner}
          />
        )}
      </div>

      <div className="flex shrink-0 justify-between border-t border-border bg-bg-subtle px-6 py-2.5 text-[11px] text-muted">
        <span>
          {t.rich("tip", { k: (chunks) => <kbd className="kbd">{chunks}</kbd> })}
        </span>
        <span>{t("stepOf", { step: step + 1, total: stepsFor(requestedType).length })}</span>
      </div>

      {wiz.confirmingLeave && (
        <DiscardConfirm
          typeLabel={def.label}
          onDiscard={() => {
            wiz.setConfirmingLeave(false);
            leave();
          }}
          onKeepEditing={() => wiz.setConfirmingLeave(false)}
        />
      )}
    </div>
  );
}

function DiscardConfirm({
  typeLabel,
  onDiscard,
  onKeepEditing,
}: {
  typeLabel: string;
  onDiscard: () => void;
  onKeepEditing: () => void;
}): React.ReactElement {
  const t = useTranslations("wizard");
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onKeepEditing();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onKeepEditing]);
  return (
    <div className="absolute inset-0 z-[4]" style={{ background: "var(--backdrop)" }}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="discard-title"
        className="k-surface absolute overflow-hidden"
        style={{ width: 460, left: "50%", top: 100, transform: "translateX(-50%)", boxShadow: "var(--shadow-xl)" }}
      >
        <div className="flex items-start gap-3 border-b border-border p-4">
          <div
            className="mt-0.5 flex shrink-0 items-center justify-center rounded-sm"
            style={{ width: 28, height: 28, background: "var(--warn-bg)", color: "var(--warn-fg)" }}
          >
            <TriangleAlert size={15} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold">{t("discardTitle", { type: typeLabel })}</div>
            <div className="mt-0.5 text-[12.5px] leading-snug text-muted">{t("discardBody")}</div>
          </div>
        </div>
        <div className="p-4">
          <p className="text-[12.5px] leading-relaxed text-muted">{t("discardDetail")}</p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-bg-subtle p-3">
          <Button variant="ghost" onClick={onDiscard}>
            {t("discard")}
          </Button>
          <Button variant="primary" onClick={onKeepEditing} autoFocus>
            {t("keepEditing")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FullPageMessage({
  title,
  body,
  onBack,
  backLabel,
}: {
  title: string;
  body: string;
  onBack: () => void;
  backLabel: string;
}): React.ReactElement {
  return (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-bg">
      <header className="flex h-16 shrink-0 items-center border-b border-border bg-surface px-6">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <X size={14} aria-hidden /> {backLabel}
        </Button>
      </header>
      <div className="flex flex-1 items-center justify-center">
        <EmptyState title={title} body={body} />
      </div>
    </div>
  );
}
