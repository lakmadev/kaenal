"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, ArrowRight } from "lucide-react";
import { creatableTypes, WIZARD_TYPES, WIZARD_TYPE_ORDER, type WizardType } from "@kaenal/core";
import { useMe } from "@/hooks/use-me";
import { WIZARD_ICON, WIZARD_COLOR } from "@/features/create-wizard/wizard-meta";

/**
 * Quick-create "New" menu (createwizard.jsx `QuickCreateButton`, W7-A..D).
 * 240px min-width menu, 28px tinted icon tiles, arrow. Capability-filtered: a
 * type the caller cannot create is not listed (W7-B), and the whole button is
 * absent when the caller can create nothing (W7-C) — never a control that 403s.
 * CAPA is a per-entity dialog (Q1 decision), so it is never in this menu.
 */
export function QuickCreateButton(): React.ReactElement | null {
  const t = useTranslations("quickCreate");
  const router = useRouter();
  const { data: me } = useMe();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const types = me !== undefined ? creatableTypes(me.capabilities) : [];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (ref.current !== null && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setHighlight(0);
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((i) => Math.min(types.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const pick = types[highlight];
        if (pick !== undefined) go(pick);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `highlight` must read fresh on Enter, `types` is stable per me
  }, [open, types.length, highlight]);

  if (me === undefined || types.length === 0) return null;

  function go(type: WizardType): void {
    setOpen(false);
    router.push(`/create/${type}`);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="k-btn k-btn-primary k-btn-sm"
      >
        <Plus size={14} strokeWidth={2.5} aria-hidden />
        {t("new")}
      </button>
      {open && (
        <div
          role="menu"
          aria-label={t("menuLabel")}
          className="k-surface fade-in absolute right-0 z-[200] p-1"
          style={{ top: "calc(100% + 6px)", minWidth: 240, boxShadow: "var(--shadow-lg)" }}
        >
          {WIZARD_TYPE_ORDER.filter((k) => types.includes(k)).map((k, i) => {
            const def = WIZARD_TYPES[k];
            const Icon = WIZARD_ICON[k];
            const color = WIZARD_COLOR[k];
            const active = i === highlight;
            return (
              <button
                key={k}
                type="button"
                role="menuitem"
                onClick={() => go(k)}
                onMouseEnter={() => setHighlight(i)}
                className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2.5 text-left"
                style={{
                  background: active ? "var(--bg-subtle)" : "transparent",
                  boxShadow: active ? "inset 0 0 0 2px var(--ring)" : "none",
                }}
              >
                <span
                  className="inline-flex shrink-0 items-center justify-center rounded-sm"
                  style={{ width: 28, height: 28, background: `${color}18`, color }}
                >
                  <Icon size={14} strokeWidth={2} aria-hidden />
                </span>
                <span className="flex-1 text-[13px] font-medium text-text">{def.label}</span>
                <ArrowRight size={12} aria-hidden className="text-muted" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
