import { describe, expect, it } from "vitest";
import { roundWorkingWeight } from "@/lib/domain/rounding";
import { workingWeightForSet } from "@/lib/domain/prescription";

describe("roundWorkingWeight", () => {
  it("rounds to nearest increment", () => {
    expect(roundWorkingWeight(177.5, 5)).toBe(180);
    expect(roundWorkingWeight(177.5, 2.5)).toBe(177.5);
    expect(roundWorkingWeight(190.3, 2.5)).toBe(190);
  });
});

describe("workingWeightForSet", () => {
  it("matches TM scaled percentages", () => {
    expect(workingWeightForSet(400, 0.65, 2.5)).toBe(260);
    expect(workingWeightForSet(300, 0.775, 2.5)).toBe(232.5);
  });
});
