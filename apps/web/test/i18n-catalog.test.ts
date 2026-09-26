import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** CI guard (S1-7): every key used by the S1-5 shell components exists in the catalog. */
const FILES: Record<string, string> = {
  offline: "src/components/shell/offline-banner.tsx",
  stale: "src/components/shell/stale-write-dialog.tsx",
};

function read(rel: string): string {
  return readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
}

describe("i18n catalog", () => {
  const catalog = JSON.parse(read("messages/en.json")) as Record<string, Record<string, string>>;
  for (const [ns, file] of Object.entries(FILES)) {
    it(`${file} only uses keys that exist in "${ns}"`, () => {
      const keys = [...read(file).matchAll(/\bt\("([A-Za-z]+)"/g)].map((m) => m[1] ?? "");
      expect(keys.length).toBeGreaterThan(0);
      for (const k of keys) expect(catalog[ns], `missing ${ns}.${k}`).toHaveProperty(k);
    });
  }
});
