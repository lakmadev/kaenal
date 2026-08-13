import { describe, expect, it } from "vitest";
import {
  applyMapping,
  getImportTarget,
  IMPORT_TARGETS,
  planImport,
  toImportTargetDto,
  validateMappedRow,
} from "../src/import.js";
import type { ImportMapping, ImportSourceRow, ImportTransform } from "@kaenal/types";

/**
 * Bulk-import pipeline core (09 §6). Pins the safety-critical guarantees: the
 * target registry is the identifier whitelist, mapping projects only known
 * fields, validation catches the row problems the wizard shows, and `planImport`
 * — the plan `commit` executes — classifies create/update/skip exactly by natural
 * key + dedupe policy, so a dry run and the real commit can never diverge.
 */

const suppliers = getImportTarget("suppliers")!;
const MAP: ImportMapping = { code: "Code", name: "Name", status: "Status", riskTier: "Risk", tier: "Tier" };
const noTransform: ImportTransform = {};

function row(cells: Record<string, string>): ImportSourceRow {
  return cells;
}

describe("target registry", () => {
  it("exposes suppliers with code as the natural key", () => {
    const dto = toImportTargetDto(suppliers);
    expect(dto.id).toBe("suppliers");
    const code = dto.fields.find((f) => f.key === "code");
    expect(code?.naturalKey).toBe(true);
    expect(code?.required).toBe(true);
  });

  it("returns undefined for an unknown target (whitelist)", () => {
    expect(getImportTarget("ncrs")).toBeUndefined();
    expect(getImportTarget("suppliers; DROP TABLE suppliers")).toBeUndefined();
  });

  it("only registers real, importable targets", () => {
    expect(Object.keys(IMPORT_TARGETS)).toEqual(["suppliers"]);
  });
});

describe("applyMapping", () => {
  it("projects source columns into target fields and applies value transforms", () => {
    const mapped = applyMapping(
      suppliers,
      row({ Code: "ACME-1", Name: "Acme", Status: "A" }),
      MAP,
      { status: { A: "active" } },
    );
    expect(mapped).toEqual({ code: "ACME-1", name: "Acme", status: "active" });
  });

  it("treats a blank cell as absent", () => {
    const mapped = applyMapping(suppliers, row({ Code: "ACME-1", Name: "  ", Status: "" }), MAP, noTransform);
    expect(mapped).toEqual({ code: "ACME-1" });
  });
});

describe("validateMappedRow", () => {
  it("flags a missing required field", () => {
    const { errors } = validateMappedRow(suppliers, { code: "ACME-1" });
    expect(errors.some((e) => e.includes("Name"))).toBe(true);
  });

  it("flags an out-of-enum status and a non-numeric tier", () => {
    const { errors } = validateMappedRow(suppliers, { code: "A", name: "A", status: "Sev1", tier: "high" });
    expect(errors.some((e) => e.includes("Status"))).toBe(true);
    expect(errors.some((e) => e.includes("Tier"))).toBe(true);
  });

  it("passes a clean row", () => {
    const { errors } = validateMappedRow(suppliers, { code: "A", name: "A", status: "active", tier: "1" });
    expect(errors).toEqual([]);
  });
});

describe("planImport (dry run == commit plan)", () => {
  const rows = [
    row({ Code: "S1", Name: "One", Status: "active" }), // exists → update
    row({ Code: "S2", Name: "Two" }), // new → create
    row({ Code: "S3", Name: "" }), // error (missing name)
    row({ Code: "S1", Name: "Dup" }), // within-file dup of S1 → error
  ];
  const existing = new Set(["S1"]);

  it("classifies create/update/error and counts them (update policy)", () => {
    const { results, counts } = planImport(suppliers, rows, MAP, noTransform, existing, "update");
    expect(results.map((r) => r.status)).toEqual(["update", "create", "error", "error"]);
    expect(counts).toMatchObject({ total: 4, valid: 2, errors: 2, updated: 1, created: 1, skipped: 0 });
  });

  it("skips existing keys under the skip policy", () => {
    const { counts } = planImport(suppliers, [rows[0]!], MAP, noTransform, existing, "skip");
    expect(counts).toMatchObject({ skipped: 1, updated: 0, valid: 1 });
  });

  it("is a pure function of its inputs — no hidden state between runs", () => {
    const a = planImport(suppliers, rows, MAP, noTransform, existing, "update");
    const b = planImport(suppliers, rows, MAP, noTransform, existing, "update");
    expect(a.counts).toEqual(b.counts);
  });
});
