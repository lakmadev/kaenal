"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Info, Keyboard, X } from "lucide-react";
import { SHORTCUTS, type ShortcutDef, type ShortcutGroup } from "@/config/shortcuts";
import { useIsMac } from "@/hooks/use-global-shortcuts";
import { usePreferences } from "@/hooks/use-preferences";
import { useUiStore } from "@/lib/stores/ui";
import { KeyCaps } from "./key-caps";

/** Which column each group sits in (board W3-A: General left; Create + palette right). */
const COLUMNS: readonly (readonly ShortcutGroup[])[] = [["general"], ["create", "palette"]];

function ShortcutRow({ def }: { def: ShortcutDef }): React.ReactElement {
  const t = useTranslations("shortcuts");
  return (
    <div className="flex items-center gap-3 border-b border-border py-2 text-[13px]">
      <span className="flex-1">{t(`label.${def.id}`)}</span>
      <KeyCaps keys={def.keys} keep />
    </div>
  );
}

/**
 * Keyboard-shortcuts dialog (board W3). The list is generated from the same
 * registry that binds the keys. When "Keyboard shortcuts" is off in Preferences
 * it shows the W3-C notice and dims the list. Opened by `?`, the profile-menu
 * row and the palette quick action.
 */
export function ShortcutsDialog(): React.ReactElement {
  const t = useTranslations("shortcuts");
  const open = useUiStore((s) => s.shortcutsOpen);
  const setOpen = useUiStore((s) => s.setShortcutsOpen);
  const isMac = useIsMac();
  const { values } = usePreferences();
  const disabled = !values.keyboardShortcuts;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[200] bg-[rgba(15,23,42,0.4)] backdrop-blur-[3px]" />
        <DialogPrimitive.Content
          className="k-surface fade-in fixed left-1/2 top-[12vh] z-[201] max-h-[80vh] w-[min(640px,94vw)] -translate-x-1/2 overflow-y-auto p-0 shadow-xl focus:outline-none"
        >
          <div className="flex items-start gap-3 border-b border-border px-5 py-4">
            <div
              className="mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-bg-subtle text-text"
              aria-hidden
            >
              <Keyboard size={15} />
            </div>
            <div className="flex-1">
              <DialogPrimitive.Title className="text-[15px] font-semibold">{t("title")}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 text-[12.5px] text-muted">
                {t("subtitle")}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close aria-label={t("close")} className="k-btn k-btn-plain k-btn-icon -mr-1.5">
              <X size={18} strokeWidth={1.75} />
            </DialogPrimitive.Close>
          </div>

          <div className="px-5 pb-1 pt-[18px]">
            {disabled && (
              <div className="mb-4 flex items-center gap-2.5 rounded-md border border-border bg-bg-subtle px-3 py-2.5 text-[12.5px] text-muted">
                <Info size={14} className="shrink-0" aria-hidden />
                <span className="flex-1">
                  {t.rich("disabledNotice", {
                    key: () => <span className="kbd kbd-keep">?</span>,
                  })}
                </span>
                <Link
                  href="/settings/preferences"
                  onClick={() => setOpen(false)}
                  className="text-[12.5px] font-semibold text-accent"
                >
                  {t("openPreferences")}
                </Link>
              </div>
            )}
            <div className={`grid gap-x-8 sm:grid-cols-2 ${disabled ? "opacity-55" : ""}`}>
              {COLUMNS.map((groups) => (
                <div key={groups.join("-")}>
                  {groups.map((group) => (
                    <div key={group} className="mb-[18px]">
                      <div className="k-overline mb-0.5">{t(`group.${group}`)}</div>
                      {SHORTCUTS.filter((s) => s.group === group).map((s) => (
                        <ShortcutRow key={s.id} def={s} />
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-border bg-bg-subtle px-5 py-2.5 text-[11.5px] text-muted">
            <Info size={13} className="shrink-0" aria-hidden />
            <span>{isMac ? t("noteMac") : t("noteOther")}</span>
            <span className="flex-1" />
            <DialogPrimitive.Close className="k-btn k-btn-ghost k-btn-sm">{t("close")}</DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
