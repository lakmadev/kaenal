"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useMe, hasCapability } from "@/hooks/use-me";
import { usePreferences } from "@/hooks/use-preferences";
import { quickCreateTarget } from "@/config/quick-create";
import { useUiStore } from "@/lib/stores/ui";

/** True while the user is typing in a field, where single-key shortcuts must not fire. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

/** Whether the "mod" key is Cmd (macOS/iOS) or Ctrl. Server render assumes macOS. */
export function useIsMac(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => true,
  );
}

/**
 * The global key bindings (registry: `config/shortcuts.ts`): ⌘/Ctrl-K palette,
 * ⌘/Ctrl-I new inspection, ⌘/Ctrl-D new 8D, `?` shortcuts dialog. All are
 * inactive when the user turned "Keyboard shortcuts" off in Preferences. ⌘I and
 * ⌘D only run for roles that hold the create capability and never while typing.
 * Mounted once in the app shell.
 */
export function useGlobalShortcuts(): void {
  const router = useRouter();
  const { data: me } = useMe();
  const { values } = usePreferences();
  const toggleCommand = useUiStore((s) => s.toggleCommand);
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);
  const enabled = values.keyboardShortcuts;

  // Effect is required: a window-level keydown listener is a browser API.
  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      // The palette toggles even from inside its own input.
      if (mod && key === "k") {
        e.preventDefault();
        toggleCommand();
        return;
      }
      if (isTypingTarget(e.target)) return;

      if (mod && !e.shiftKey && !e.altKey && (key === "i" || key === "d")) {
        const target = quickCreateTarget(key === "i" ? "inspection" : "8d");
        // Let the browser keep the key when the user cannot create this record.
        if (target === undefined || !hasCapability(me, target.capability)) return;
        e.preventDefault();
        router.push(target.href);
        return;
      }
      if (!mod && !e.altKey && e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, me, router, toggleCommand, setShortcutsOpen]);
}
