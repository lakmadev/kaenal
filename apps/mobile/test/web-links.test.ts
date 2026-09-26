import { describe, expect, it } from "vitest";

import { resolveWebBase, webUrl } from "../src/lib/web-links";

describe("web-links", () => {
  it("prefers the explicit web URL and normalises to an origin", () => {
    expect(resolveWebBase("https://app.kaenal.com/x", "http://h:3001")).toBe("https://app.kaenal.com");
  });
  it("derives the dev web origin from the dev API origin", () => {
    expect(resolveWebBase(undefined, "http://192.168.1.5:3001")).toBe("http://192.168.1.5:3000");
  });
  it("returns null when nothing usable is configured", () => {
    expect(resolveWebBase(undefined, "https://api.kaenal.com")).toBeNull();
    expect(resolveWebBase("not a url", "http://h:3001")).toBeNull();
    expect(webUrl("/reports", undefined, "https://api.kaenal.com")).toBeNull();
  });
  it("joins paths", () => {
    expect(webUrl("settings/members", "https://a.io", "")).toBe("https://a.io/settings/members");
  });
});
