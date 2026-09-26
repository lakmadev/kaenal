import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PLACEHOLDER_LEDGER } from "@/config/placeholder-ledger";
import { PLANNED_MODULES } from "@/config/planned-modules";
import { SETTINGS_NAV } from "@/features/settings/settings-nav";

const APP_DIR = join(process.cwd(), "src", "app", "(app)");

/** Top-level `(app)/<segment>/page.tsx` files that render <ModulePlaceholder>. */
function placeholderPages(): string[] {
  const found: string[] = [];
  for (const name of readdirSync(APP_DIR)) {
    if (name.startsWith("[")) continue; // the catch-all is covered by PLANNED_MODULES
    const page = join(APP_DIR, name, "page.tsx");
    try {
      if (statSync(page).isFile() && readFileSync(page, "utf8").includes("<ModulePlaceholder")) found.push(name);
    } catch {
      // no page.tsx in this segment
    }
  }
  return found;
}

function actualPlaceholders(): string[] {
  const keys: string[] = [];
  for (const id of Object.keys(PLANNED_MODULES)) keys.push(`planned:${id}`);
  for (const name of placeholderPages()) keys.push(`page:${name}`);
  for (const grp of SETTINGS_NAV) {
    for (const it of grp.items) {
      if (it.hidden === true) keys.push(`hidden:${it.id}`);
      else if (it.built !== true) keys.push(`settings:${it.id}`);
    }
  }
  return keys.sort();
}

describe("placeholder ledger (dead-end guard)", () => {
  it("every placeholder is listed in the ledger (a new one is a new dead end)", () => {
    const listed = new Set(Object.keys(PLACEHOLDER_LEDGER));
    expect(actualPlaceholders().filter((k) => !listed.has(k))).toEqual([]);
  });

  it("every ledger entry still exists (built or removed items must be deleted from the ledger)", () => {
    const actual = new Set(actualPlaceholders());
    expect(Object.keys(PLACEHOLDER_LEDGER).filter((k) => !actual.has(k))).toEqual([]);
  });

  it("maps every entry to a roadmap sprint number", () => {
    for (const sprint of Object.values(PLACEHOLDER_LEDGER)) {
      expect(Number.isInteger(sprint)).toBe(true);
      expect(sprint).toBeGreaterThanOrEqual(2);
    }
  });

  it("never lists stale or excluded modules", () => {
    expect(PLANNED_MODULES).not.toHaveProperty("spc");
    expect(PLANNED_MODULES).not.toHaveProperty("pqe");
  });
});
