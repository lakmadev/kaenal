"use client";

import { useMemo, useRef, useState } from "react";
import {
  advanceBlocker,
  buildCreateBody,
  canAdvance,
  defaultRoleFor,
  emptyDraft,
  isDirty,
  lastStepFor,
  wizardFieldFor,
  stepForWizardField,
  type WizardDraft,
  type WizardField,
  type WizardType,
} from "@kaenal/core";
import type { EntityPersonRole } from "@kaenal/types";

/** Field-level 422 messages, keyed by the wizard field they belong to. */
export type FieldErrors = Partial<Record<WizardField, string>>;

/**
 * The wizard's local state (createwizard.jsx `CreateWizard`'s `useState` block)
 * plus the step/validation/idempotency plumbing around it. All the actual rules
 * (can-advance, draft → body, template mappings) are pure functions from
 * `@kaenal/core` (rule 5) — this hook only holds state and calls them.
 */
export function useWizardDraft(initialType: WizardType | null, initialTemplate?: string) {
  const [step, setStep] = useState(initialType !== null ? 1 : 0);
  const [draft, setDraft] = useState<WizardDraft>(() => ({
    ...emptyDraft(initialType),
    ...(initialTemplate !== undefined ? { template: initialTemplate } : {}),
  }));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  // One idempotency key for the whole wizard session (S1-1 AC6): a retry after
  // a failure — or a double Enter/click — reuses it, so the API replays instead
  // of creating twice.
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  const dirty = isDirty(draft);
  const blocker = advanceBlocker(step, draft);
  const canGoNext = canAdvance(step, draft);

  function patch(partial: Partial<WizardDraft>): void {
    setDraft((d) => ({ ...d, ...partial }));
    setSubmitError(null);
  }

  function setType(type: WizardType): void {
    setDraft(emptyDraft(type));
    setFieldErrors({});
    setSubmitError(null);
  }

  function addPerson(userId: string): void {
    setDraft((d) => ({ ...d, people: [...d.people, { userId, role: defaultRoleFor(d.people) }] }));
  }

  function changePersonRole(userId: string, role: EntityPersonRole): void {
    setDraft((d) => ({ ...d, people: d.people.map((p) => (p.userId === userId ? { ...p, role } : p)) }));
  }

  function removePerson(userId: string): void {
    setDraft((d) => ({ ...d, people: d.people.filter((p) => p.userId !== userId) }));
  }

  function next(): void {
    if (!canGoNext) return;
    setFieldErrors({});
    setStep((s) => Math.min(lastStepFor(draft.type), s + 1));
  }

  function back(): void {
    setStep((s) => Math.max(0, s - 1));
  }

  /** A 422's issues, jumped to the earliest step that owns one of them (W7-G). */
  function applyValidationIssues(issues: readonly { path: string; message: string }[]): void {
    const errs: FieldErrors = {};
    let earliestStep = lastStepFor(draft.type);
    for (const issue of issues) {
      const field = wizardFieldFor(issue.path, draft.type);
      errs[field] = issue.message;
      earliestStep = Math.min(earliestStep, stepForWizardField(field));
    }
    setFieldErrors(errs);
    setStep(earliestStep);
    setSubmitError(null);
  }

  function applySubmitError(message: string): void {
    setSubmitError(message);
  }

  const body = useMemo(() => buildCreateBody(draft), [draft]);

  return {
    step,
    draft,
    dirty,
    blocker,
    canGoNext,
    fieldErrors,
    submitError,
    confirmingLeave,
    setConfirmingLeave,
    idempotencyKey: idempotencyKeyRef.current,
    body,
    patch,
    setType,
    addPerson,
    changePersonRole,
    removePerson,
    next,
    back,
    setStep,
    applyValidationIssues,
    applySubmitError,
  };
}

export type WizardDraftApi = ReturnType<typeof useWizardDraft>;
