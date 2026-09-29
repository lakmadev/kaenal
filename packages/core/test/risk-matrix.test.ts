import { describe, expect, it } from "vitest";
import { matrixCounts, scoreBand } from "../src/risk-matrix.js";

describe("scoreBand", () => {
  it("classifies critical at and above 16", () => {
    expect(scoreBand(16)).toBe("critical");
    expect(scoreBand(25)).toBe("critical");
    expect(scoreBand(15)).toBe("high"); // just below the critical boundary
  });

  it("classifies high at and above 10", () => {
    expect(scoreBand(10)).toBe("high");
    expect(scoreBand(9)).toBe("medium"); // just below the high boundary
  });

  it("classifies medium at and above 6", () => {
    expect(scoreBand(6)).toBe("medium");
    expect(scoreBand(5)).toBe("low"); // just below the medium boundary
  });

  it("classifies everything else low", () => {
    expect(scoreBand(1)).toBe("low");
    expect(scoreBand(0)).toBe("low");
  });
});

describe("matrixCounts", () => {
  it("returns an all-zero 5×5 grid for an empty register", () => {
    const grid = matrixCounts([]);
    expect(grid).toHaveLength(5);
    for (const row of grid) {
      expect(row).toHaveLength(5);
      expect(row.every((c) => c === 0)).toBe(true);
    }
  });

  it("tabulates per-cell counts correctly", () => {
    const risks = [
      { likelihood: 1, impact: 1 },
      { likelihood: 1, impact: 1 },
      { likelihood: 5, impact: 5 },
      { likelihood: 3, impact: 4 },
    ];
    const grid = matrixCounts(risks);
    expect(grid[0]![0]).toBe(2); // (1,1) hit twice
    expect(grid[4]![4]).toBe(1); // (5,5) hit once
    expect(grid[2]![3]).toBe(1); // (3,4) hit once
    // every other cell stays 0
    const total = grid.flat().reduce((a, b) => a + b, 0);
    expect(total).toBe(4);
  });

  it("ignores a point outside the 1-5 range rather than throwing or miscounting", () => {
    const grid = matrixCounts([{ likelihood: 0, impact: 3 }, { likelihood: 6, impact: 3 }]);
    expect(grid.flat().reduce((a, b) => a + b, 0)).toBe(0);
  });
});
