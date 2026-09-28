import { describe, expect, it } from "vitest";
import { breadcrumbsFor } from "@/config/breadcrumbs";
import { shortName } from "@/lib/format";

describe("breadcrumbsFor", () => {
  it("top-level module is a single current crumb", () => {
    expect(breadcrumbsFor("/dashboard", null)).toEqual([
      { label: "Dashboard" },
    ]);
  });
  it("a view adds a linked parent and the view label", () => {
    expect(breadcrumbsFor("/ncrs", "mine")).toEqual([
      { label: "Non-Conformities", href: "/ncrs" },
      { label: "My Assignments" },
    ]);
  });
  it("detail pages link back to the module", () => {
    expect(breadcrumbsFor("/ncrs/abc", null)).toEqual([
      { label: "Non-Conformities", href: "/ncrs" },
      { label: "Detail" },
    ]);
  });
  it("detail pages show the entity code once loaded", () => {
    expect(breadcrumbsFor("/ncrs/abc", null, "NCR-0012")[1]).toEqual({
      label: "NCR-0012",
    });
  });
  it("group crumbs precede grouped modules", () => {
    expect(breadcrumbsFor("/suppliers/x", null)[0]).toEqual({
      label: "Supply chain",
    });
    expect(breadcrumbsFor("/graph", null)).toEqual([
      { label: "Intelligence" },
      { label: "Knowledge graph" },
    ]);
  });
  it("template editor nests under Templates", () => {
    expect(
      breadcrumbsFor("/inspections/templates/1", null).map((c) => c.label),
    ).toEqual(["Inspections", "Templates", "Editor"]);
  });
});

describe("shortName", () => {
  it("abbreviates the last name", () => {
    expect(shortName("Manjunath Kumar")).toBe("Manjunath K.");
    expect(shortName("Cher")).toBe("Cher");
  });
});
