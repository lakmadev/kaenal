import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * CI guard (S1-7): every shell component (src/components/shell/**) keys its
 * user-facing strings into messages/en.json. Two checks per file:
 *  1. every `t("key")` call resolves to a key in the namespace bound by
 *     `const t = useTranslations("ns")`;
 *  2. no hard-coded `aria-label` / `placeholder` / `title` literals remain.
 */
const SHELL_DIR = "src/components/shell";

function read(rel: string): string {
  return readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
}

function shellFiles(): string[] {
  return readdirSync(new URL(`../${SHELL_DIR}`, import.meta.url), { recursive: true })
    .map(String)
    .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
    .map((f) => `${SHELL_DIR}/${f}`);
}

describe("i18n catalog", () => {
  const catalog = JSON.parse(read("messages/en.json")) as Record<string, Record<string, string>>;

  for (const file of shellFiles()) {
    const src = read(file);

    it(`${file} only uses keys that exist in the catalog`, () => {
      const bindings = new Map<string, string>();
      for (const m of src.matchAll(/const (t\w*) = useTranslations\("(\w+)"\)/g)) {
        bindings.set(m[1] ?? "", m[2] ?? "");
      }
      for (const [fn, ns] of bindings) {
        expect(catalog, `namespace ${ns}`).toHaveProperty(ns);
        const calls = [...src.matchAll(new RegExp(`\\b${fn}\\("(\\w+)"`, "g"))];
        for (const c of calls) expect(catalog[ns], `missing ${ns}.${c[1]}`).toHaveProperty(c[1] ?? "");
      }
      // Dynamic keys held in data (e.g. the palette's `labelKey: "navDashboard"`).
      const dynamic = [...src.matchAll(/labelKey: "(\w+)"/g)];
      for (const d of dynamic) expect(catalog["palette"], `missing palette.${d[1]}`).toHaveProperty(d[1] ?? "");
    });

    it(`${file} has no hard-coded aria-label / placeholder / title literals`, () => {
      const literals = [...src.matchAll(/\b(aria-label|placeholder|title)="[^"]+"/g)].map((m) => m[0]);
      expect(literals).toEqual([]);
    });
  }
});
