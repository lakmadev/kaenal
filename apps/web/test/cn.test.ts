import { describe, expect, it } from "vitest";
import { cn } from "@/lib/cn";

/**
 * The class combiner underpins every component's styling, so its two contracts
 * are worth pinning: conditionals drop falsy values, and conflicting Tailwind
 * utilities resolve last-wins (tailwind-merge) rather than both being emitted.
 */
describe("cn", () => {
  it("drops falsy conditional classes", () => {
    const show: boolean = false;
    expect(cn("a", show && "b", undefined, null, "c")).toBe("a c");
  });

  it("merges conflicting tailwind utilities last-wins", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-muted", "text-danger")).toBe("text-danger");
  });

  it("keeps non-conflicting utilities", () => {
    expect(cn("k-btn", "w-full")).toBe("k-btn w-full");
  });
});
