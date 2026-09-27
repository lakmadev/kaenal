"use client";

import type { ShortcutKey } from "@/config/shortcuts";
import { useIsMac } from "@/hooks/use-global-shortcuts";

/**
 * A row of `.kbd` key caps. `mod` shows ⌘ on macOS and Ctrl elsewhere. Caps hide
 * when "Show keyboard hints" is off, unless `keep` is set (the shortcuts dialog).
 */
export function KeyCaps({ keys, keep = false }: { keys: readonly ShortcutKey[]; keep?: boolean }): React.ReactElement {
  const isMac = useIsMac();
  return (
    <span className="flex shrink-0 gap-1">
      {keys.map((k) => (
        <span key={k} className={keep ? "kbd kbd-keep" : "kbd"}>
          {k === "mod" ? (isMac ? "⌘" : "Ctrl") : k}
        </span>
      ))}
    </span>
  );
}
