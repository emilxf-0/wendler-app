import { describe, expect, it } from "vitest";
import { applyTmBumps, safeTmBumpKg, standardBumpDeltas } from "@/lib/domain/tm";

describe("safeTmBumpKg", () => {
  it("falls back when value is NaN", () => {
    expect(safeTmBumpKg(Number.NaN, 2.5)).toBe(2.5);
    expect(safeTmBumpKg("x", 2.5)).toBe(2.5);
  });

  it("accepts finite non-negative bumps", () => {
    expect(safeTmBumpKg(0, 2.5)).toBe(0);
    expect(safeTmBumpKg(3.5, 2.5)).toBe(3.5);
  });
});

describe("applyTmBumps", () => {
  it("ignores NaN in stored TMs instead of poisoning them", () => {
    const tms = {
      squat: Number.NaN,
      bench: 100,
      deadlift: Number.NaN,
      press: 60,
    };
    const bumps = standardBumpDeltas({ tmBumpUpper: 2.5, tmBumpLower: 5 });
    const out = applyTmBumps(tms, bumps);
    expect(Number.isFinite(out.squat)).toBe(true);
    expect(Number.isFinite(out.deadlift)).toBe(true);
    expect(out.bench).toBe(102.5);
    expect(out.press).toBe(62.5);
    expect(out.squat).toBe(5);
    expect(out.deadlift).toBe(5);
  });
});
