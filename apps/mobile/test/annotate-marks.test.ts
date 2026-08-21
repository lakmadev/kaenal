import { describe, expect, it } from "vitest";

import { calibrationMmPerPx, measureLabel, midpoint, segLength } from "../src/features/capture/annotate/marks.js";

describe("annotate ruler geometry (m-capture.jsx CapAnnotate Measure)", () => {
  it("segLength is euclidean distance", () => {
    expect(segLength({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(segLength({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(0);
  });

  it("midpoint is the average of endpoints", () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 10 });
  });

  it("reads pixels before calibration", () => {
    expect(measureLabel({ x: 0, y: 0 }, { x: 40, y: 0 }, null)).toBe("40 px");
  });

  it("derives mm-per-px from a known reference segment", () => {
    // A 100px reference the user says is 25mm → 0.25 mm/px.
    const scale = calibrationMmPerPx({ x: 0, y: 0 }, { x: 100, y: 0 }, 25);
    expect(scale).toBe(0.25);
    // A 12px line then reads 3.0 mm (matches the design's "~3mm" callout).
    expect(measureLabel({ x: 0, y: 0 }, { x: 12, y: 0 }, scale)).toBe("3.0 mm");
    // A longer 200px line reads a whole-mm 50 mm.
    expect(measureLabel({ x: 0, y: 0 }, { x: 200, y: 0 }, scale)).toBe("50 mm");
  });

  it("refuses to calibrate off a degenerate or non-positive reference", () => {
    expect(calibrationMmPerPx({ x: 5, y: 5 }, { x: 5, y: 5 }, 25)).toBeNull(); // zero length
    expect(calibrationMmPerPx({ x: 0, y: 0 }, { x: 100, y: 0 }, 0)).toBeNull(); // zero mm
    expect(calibrationMmPerPx({ x: 0, y: 0 }, { x: 100, y: 0 }, Number.NaN)).toBeNull();
  });
});
