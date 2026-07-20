import { describe, expect, it } from "vitest";
import { RESERVED_TENANT_SLUGS, TENANT_SLUG_PATTERN, TenantSlug } from "../src/tenant.js";

/**
 * Tenant slug validation (01 §3.2).
 *
 * The slug becomes a subdomain and is the key the registry maps to a
 * connection, so this schema is a security boundary, not a formatting nicety.
 * The rejection cases below matter more than the acceptance ones.
 */

describe("TenantSlug — accepts", () => {
  it.each(["bosch", "acme-gmbh", "a1b", "globex-industries-eu", "x".repeat(40)])(
    "%s",
    (slug) => {
      expect(TenantSlug.safeParse(slug).success).toBe(true);
    },
  );
});

describe("TenantSlug — rejects", () => {
  it.each([
    ["too short (2 chars)", "ab"],
    ["too long (41 chars)", "x".repeat(41)],
    ["uppercase", "Bosch"],
    ["leading hyphen", "-bosch"],
    ["trailing hyphen", "bosch-"],
    ["underscore", "bosch_gmbh"],
    ["dot — would create a nested subdomain", "bosch.evil"],
    ["slash — would break path routing", "bosch/admin"],
    ["space", "bosch gmbh"],
    ["empty", ""],
    ["unicode homoglyph", "bоsch"], // Cyrillic о
    ["newline injection", "bosch\nadmin"],
  ])("%s", (_label, slug) => {
    expect(TenantSlug.safeParse(slug).success).toBe(false);
  });

  it.each([...RESERVED_TENANT_SLUGS])("reserved slug %s", (slug) => {
    expect(TenantSlug.safeParse(slug).success).toBe(false);
  });
});

describe("TENANT_SLUG_PATTERN", () => {
  it("is anchored at both ends", () => {
    // An unanchored pattern would accept "evil.com/bosch" because it contains
    // a valid run — the classic subdomain-validation bug.
    expect(TENANT_SLUG_PATTERN.source.startsWith("^")).toBe(true);
    expect(TENANT_SLUG_PATTERN.source.endsWith("$")).toBe(true);
  });

  it("is not a global regex", () => {
    // A /g regex carries lastIndex between .test() calls, so the same slug
    // would alternate between valid and invalid across requests.
    expect(TENANT_SLUG_PATTERN.global).toBe(false);
  });
});
