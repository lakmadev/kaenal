"use client";

import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Trash2 } from "lucide-react";
import { describeChanges, reapplyChange, type Reapplied } from "@kaenal/core";
import { Button, Spinner, useToast } from "@/components/ui";
import { useMemberLookup } from "@/hooks/use-members";
import { useOnline } from "@/hooks/use-online";
import { buildResendVariables, reloadFresh } from "@/lib/stale-write-flow";
import { useStaleWriteStore, type StaleWriteCase } from "@/lib/stores/stale-write";

type Row = Record<string, unknown>;

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return typeof v === "string" ? v : JSON.stringify(v);
}

function isRow(v: unknown): v is Row {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** The fields the user was saving: the request body minus the version counter. */
function myFields(c: StaleWriteCase): Row {
  const body = c.variables["body"];
  if (!isRow(body)) return {};
  const { version: _v, lockVersion: _l, ...rest } = body;
  return rest;
}

/**
 * Global 409 stale-write dialog (W2-A..F), mounted once in the app shell. A modal
 * alert dialog (D-S1): no close button, Escape and outside click are ignored so
 * unsaved work is never lost by accident; only its three actions close it.
 * The merge decisions come from `reapplyChange` in `@kaenal/core`.
 */
export function StaleWriteDialog(): React.ReactElement {
  const current = useStaleWriteStore((s) => s.current);
  return (
    <DialogPrimitive.Root open={current !== null}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60]" style={{ background: "var(--backdrop)" }} />
        {current !== null && <StaleWriteBody c={current} />}
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function StaleWriteBody({ c }: { c: StaleWriteCase }): React.ReactElement {
  const t = useTranslations("stale");
  const tOffline = useTranslations("offline");
  const toast = useToast();
  const qc = useQueryClient();
  const online = useOnline();
  const members = useMemberLookup();
  const close = useStaleWriteStore((s) => s.close);
  const [requested, setRequested] = useState(false);
  const [keepCurrent, setKeepCurrent] = useState<ReadonlySet<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const mine = myFields(c);
  const fresh = c.fresh.kind === "ok" ? c.fresh.row : null;
  const reapplied: Reapplied | null =
    fresh !== null ? reapplyChange(c.original ?? {}, mine, fresh) : null;

  const updatedAt = c.info.updatedAt ?? (typeof fresh?.["updatedAt"] === "string" ? fresh["updatedAt"] : undefined);
  const updatedBy = c.info.updatedBy ?? (typeof fresh?.["updatedBy"] === "string" ? fresh["updatedBy"] : undefined);
  const time = updatedAt !== undefined ? new Date(updatedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : null;
  const who =
    c.info.updatedByName ?? (updatedBy !== undefined ? members.nameOf(updatedBy) : t("someone"));

  const deleted = c.fresh.kind === "deleted";
  const failed = requested && c.fresh.kind === "failed";
  const loading = requested && c.fresh.kind === "loading";
  const review = requested && reapplied !== null;
  const unresolved = requested && c.fresh.kind === "none";

  async function copyMine(): Promise<void> {
    await navigator.clipboard.writeText(describeChanges(mine));
    toast.success(t("copied"));
  }

  async function save(): Promise<void> {
    if (fresh === null || reapplied === null) return;
    const vars = buildResendVariables(c.variables, c.original ?? {}, fresh, reapplied, keepCurrent);
    if (vars === null) return;
    setSaving(true);
    try {
      await c.run(vars);
      void qc.invalidateQueries();
      toast.success(t("saved"));
      close();
    } catch {
      toast.error(t("saveFailed"));
      setSaving(false);
    }
  }

  function toggle(field: string, current: boolean): void {
    setKeepCurrent((prev) => {
      const next = new Set(prev);
      if (current) next.add(field);
      else next.delete(field);
      return next;
    });
  }

  const title = deleted ? t("deletedTitle") : review ? t("reviewTitle") : failed ? t("failedTitle") : t("title");
  const description = deleted
    ? t("deletedBody")
    : failed
      ? t("failedBody")
      : review
        ? reapplied.conflicts.length > 0
          ? t("reviewConflicts")
          : t("reviewClean")
        : unresolved
          ? t("unresolved")
          : time !== null
            ? t("whoWhen", { who, time })
            : t("changedGeneric");

  const rows: { field: string; mine: unknown; current: unknown; conflict: boolean }[] =
    reapplied !== null
      ? [
          ...reapplied.conflicts.map((x) => ({ field: x.field, mine: x.mine, current: x.fresh, conflict: true })),
          ...reapplied.clean.map((x) => ({ field: x.field, mine: x.mine, current: fresh?.[x.field], conflict: false })),
        ]
      : Object.entries(mine).map(([field, v]) => ({ field, mine: v, current: undefined, conflict: false }));

  return (
    <DialogPrimitive.Content
      // D-S1: the dialog can only be closed through its own actions.
      onEscapeKeyDown={(e) => e.preventDefault()}
      onPointerDownOutside={(e) => e.preventDefault()}
      onInteractOutside={(e) => e.preventDefault()}
      role="alertdialog"
      className="k-surface fixed left-1/2 top-1/2 z-[61] w-[calc(100%-2rem)] max-w-[560px] -translate-x-1/2 -translate-y-1/2 shadow-xl focus:outline-none"
    >
      <div className="flex items-start gap-3 px-5 py-4">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
          style={{ background: deleted ? "var(--danger-bg)" : "var(--warn-bg)", color: deleted ? "var(--danger-fg)" : "var(--warn-fg)" }}
        >
          {deleted ? <Trash2 size={15} aria-hidden /> : <AlertTriangle size={15} aria-hidden />}
        </span>
        <div className="min-w-0">
          <DialogPrimitive.Title className="text-[15px] font-semibold text-text">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-0.5 text-[12.5px] text-muted">{description}</DialogPrimitive.Description>
        </div>
      </div>

      {!deleted && !failed && !unresolved && rows.length > 0 && (
        <div className="px-5 pb-4">
          <div className="k-overline mb-2">{t("yourChanges", { count: rows.length })}</div>
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 pr-2 font-semibold">{t("colField")}</th>
                <th className="py-1 pr-2 font-semibold">{t("colMine")}</th>
                <th className="py-1 font-semibold">{t("colCurrent")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const keepingCurrent = keepCurrent.has(r.field);
                return (
                  <tr key={r.field} className="border-t border-border align-top">
                    <td className="py-1.5 pr-2 font-medium">{r.field}</td>
                    <td className="py-1.5 pr-2">{show(r.mine)}</td>
                    <td className="py-1.5">
                      {review && r.conflict ? (
                        <fieldset className="flex flex-col gap-1">
                          <legend className="sr-only">{r.field}</legend>
                          <label className="flex items-center gap-1.5">
                            <input type="radio" name={r.field} checked={!keepingCurrent} onChange={() => toggle(r.field, false)} />
                            {t("keepMine")}
                          </label>
                          <label className="flex items-center gap-1.5">
                            <input type="radio" name={r.field} checked={keepingCurrent} onChange={() => toggle(r.field, true)} />
                            {t("keepCurrent")} · {show(r.current)}
                          </label>
                        </fieldset>
                      ) : (
                        <span>
                          {show(r.current)}{" "}
                          {r.conflict ? (
                            <strong style={{ color: "var(--danger-fg)" }}>{t("conflict")}</strong>
                          ) : reapplied !== null ? (
                            <span style={{ color: "var(--success-fg)" }}>{t("mergesCleanly")}</span>
                          ) : null}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {review && reapplied.conflicts.length > 0 && reapplied.clean.length > 0 && (
            <p className="mt-2 text-[12px] text-muted">{t("autoApplied", { count: reapplied.clean.length })}</p>
          )}
          {review && rows.length === 0 && <p className="text-[12.5px] text-muted">{t("nothingToApply")}</p>}
          {!requested && <p className="mt-3 text-[12px] text-muted">{t("explain")}</p>}
        </div>
      )}

      {deleted && <p className="px-5 pb-4 text-[12.5px] text-muted">{t("deletedHint")}</p>}

      <div className="flex flex-wrap justify-end gap-2 rounded-b-[7px] border-t border-border bg-bg-subtle px-5 py-3">
        <Button onClick={() => void copyMine()} variant="plain">
          {t("copy")}
        </Button>
        {deleted ? (
          <Button variant="primary" onClick={close} autoFocus>
            {t("close")}
          </Button>
        ) : unresolved ? (
          <Button variant="primary" onClick={close} autoFocus>
            {t("close")}
          </Button>
        ) : (
          <>
            <Button onClick={close}>{t("discard")}</Button>
            {review ? (
              <Button variant="primary" onClick={() => void save()} disabled={saving || !online} disabledReason={!online ? tOffline("writeDisabledReason") : undefined} autoFocus>
                {saving && <Spinner size={14} />}
                {saving ? t("saving") : t("save")}
              </Button>
            ) : failed ? (
              <Button variant="primary" disabled={!online} disabledReason={!online ? tOffline("writeDisabledReason") : undefined} onClick={() => void reloadFresh(qc)} autoFocus>
                {t("tryAgain")}
              </Button>
            ) : (
              <Button
                variant="primary"
                disabled={loading}
                onClick={() => {
                  setRequested(true);
                  if (c.fresh.kind === "failed") void reloadFresh(qc);
                }}
                autoFocus
              >
                {loading && <Spinner size={14} />}
                {loading ? t("reloading") : t("reload")}
              </Button>
            )}
          </>
        )}
      </div>
    </DialogPrimitive.Content>
  );
}
