/**
 * The one registry of keyboard shortcuts (S1-2). The global key handler and the
 * shortcuts dialog (board W3) both read it, so the dialog can never list a key
 * that is not bound. Only really bound keys appear (deviation D-P1); `⌘N` is
 * deliberately absent because browsers reserve it.
 */
export type ShortcutKey = "mod" | "K" | "I" | "D" | "?" | "Esc" | "↑" | "↓" | "↵";

export type ShortcutGroup = "general" | "create" | "palette";

export interface ShortcutDef {
  id: "palette" | "shortcuts" | "close" | "newInspection" | "newEightD" | "move" | "run";
  group: ShortcutGroup;
  /** Key caps in display order. `mod` renders as ⌘ on macOS and Ctrl elsewhere. */
  keys: readonly ShortcutKey[];
}

export const SHORTCUTS: readonly ShortcutDef[] = [
  { id: "palette", group: "general", keys: ["mod", "K"] },
  { id: "shortcuts", group: "general", keys: ["?"] },
  { id: "close", group: "general", keys: ["Esc"] },
  { id: "newInspection", group: "create", keys: ["mod", "I"] },
  { id: "newEightD", group: "create", keys: ["mod", "D"] },
  { id: "move", group: "palette", keys: ["↑", "↓"] },
  { id: "run", group: "palette", keys: ["↵"] },
];

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = ["general", "create", "palette"];

/** Look up a shortcut's key caps (used for palette chips). */
export function shortcutKeys(id: ShortcutDef["id"]): readonly ShortcutKey[] {
  return SHORTCUTS.find((s) => s.id === id)?.keys ?? [];
}
