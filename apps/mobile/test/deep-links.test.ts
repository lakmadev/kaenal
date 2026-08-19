import { describe, expect, it } from "vitest";

import { entityRoute } from "../src/lib/deep-links";

// The deep-link resolver is the single mapping from a notification/push entity
// reference to an in-app route. It must (a) resolve every kind that has a mobile
// detail screen, (b) normalise the server's spelling variants, and (c) return
// null — never a bogus route — for kinds/ids it can't open.
describe("entityRoute", () => {
  it("resolves the kinds that have a mobile detail screen", () => {
    expect(entityRoute("inspection", "abc")).toBe("/inspection/abc");
    expect(entityRoute("ncr", "n1")).toBe("/ncr/n1");
    expect(entityRoute("capa", "c1")).toBe("/capa/c1");
    expect(entityRoute("document", "d1")).toBe("/approval/d1");
  });

  it("normalises 8d / eight_d spellings to the 8d route", () => {
    expect(entityRoute("eight_d", "e1")).toBe("/8d/e1");
    expect(entityRoute("8d", "e1")).toBe("/8d/e1");
    expect(entityRoute("EightD", "e1")).toBe("/8d/e1");
  });

  it("normalises document_version to the document route", () => {
    expect(entityRoute("document_version", "d2")).toBe("/approval/d2");
  });

  it("returns null for kinds with no mobile screen (honest, no bogus route)", () => {
    expect(entityRoute("supplier", "s1")).toBeNull();
    expect(entityRoute("scar", "s1")).toBeNull();
    expect(entityRoute("capa_action", "ca1")).toBeNull();
    expect(entityRoute("audit_finding", "f1")).toBeNull();
  });

  it("returns null when kind or id is missing", () => {
    expect(entityRoute(null, "x")).toBeNull();
    expect(entityRoute("ncr", null)).toBeNull();
    expect(entityRoute("ncr", undefined)).toBeNull();
    expect(entityRoute(undefined, undefined)).toBeNull();
  });
});
