import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NAV_TARGETS } from "@/config/palette-nav";
import { PLANNED_MODULES } from "@/config/planned-modules";
import { QUICK_CREATE } from "@/config/quick-create";
import { SHORTCUTS } from "@/config/shortcuts";
import { roleSeesRoute } from "@/config/rbac";

/**
 * S1-2 guards: every palette navigation entry resolves to a real route (or a
 * planned-module slug), every label key exists in the catalog, and the shortcuts
 * registry only lists keys the dialog can label. Nothing in the palette is a dead click.
 */
const catalog = JSON.parse(readFileSync(new URL("../messages/en.json", import.meta.url), "utf8")) as Record<
  string,
  Record<string, unknown>
>;

/** Does `dir` (or any folder under it) contain a `page.tsx`? Node-20-safe (no `fs.globSync`). */
function hasPageUnder(dir: string): boolean {
  if (!existsSync(dir)) return false;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name === "page.tsx") return true;
    if (entry.isDirectory() && hasPageUnder(`${dir}/${entry.name}`)) return true;
  }
  return false;
}

function routeExists(href: string): boolean {
  const seg = href.split("?")[0]?.split("/")[1] ?? "";
  const base = fileURLToPath(new URL(`../src/app/(app)/${seg}`, import.meta.url));
  // A page directly under the segment, or under a nested/catch-all folder like settings/[...section].
  return hasPageUnder(base) || seg in PLANNED_MODULES;
}

describe("command palette navigation", () => {
  for (const target of NAV_TARGETS) {
    it(`${target.href} resolves to a real route`, () => {
      expect(routeExists(target.href)).toBe(true);
    });
    it(`${target.id} has a label in the catalog`, () => {
      expect(catalog["palette"]).toHaveProperty(target.labelKey);
    });
  }

  it("dashboard and settings are reachable for every role", () => {
    for (const role of ["admin", "manager", "auditor", "inspector", "viewer"]) {
      expect(roleSeesRoute(role, "/dashboard")).toBe(true);
      expect(roleSeesRoute(role, "/settings/profile")).toBe(true);
    }
  });

  it("viewers are not offered modules their role cannot see", () => {
    expect(roleSeesRoute("viewer", "/ncrs")).toBe(false);
    expect(roleSeesRoute("viewer", "/documents")).toBe(true);
  });
});

describe("quick actions", () => {
  for (const target of QUICK_CREATE) {
    it(`${target.id} has a label and a capability`, () => {
      expect(catalog["palette"]).toHaveProperty(target.labelKey);
      expect(target.capability).not.toBe("");
    });
  }
});

describe("shortcuts registry", () => {
  const labels = (catalog["shortcuts"]?.["label"] ?? {}) as Record<string, string>;
  for (const s of SHORTCUTS) {
    it(`${s.id} is labelled in the dialog`, () => {
      expect(labels).toHaveProperty(s.id);
    });
  }
  it("does not bind the browser-reserved mod+N", () => {
    expect(SHORTCUTS.some((s) => s.keys.join("+") === "mod+N")).toBe(false);
  });
});
