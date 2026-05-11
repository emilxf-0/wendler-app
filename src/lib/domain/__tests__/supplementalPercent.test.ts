import { describe, expect, it } from "vitest";
import {
  clampSupplementalTmFraction,
  parseSupplementalPercentOverride,
} from "@/lib/domain/supplementalPercent";

describe("clampSupplementalTmFraction", () => {
  it("clamps below min and above max", () => {
    expect(clampSupplementalTmFraction(0.01)).toBe(0.05);
    expect(clampSupplementalTmFraction(1.25)).toBe(1);
  });
});

describe("parseSupplementalPercentOverride", () => {
  it("parses fractions and percentages", () => {
    expect(parseSupplementalPercentOverride(null)).toBe(null);
    expect(parseSupplementalPercentOverride(undefined)).toBe(null);
    expect(parseSupplementalPercentOverride(0.55)).toBe(0.55);
    expect(parseSupplementalPercentOverride(65)).toBe(0.65);
    expect(parseSupplementalPercentOverride("40")).toBe(0.4);
  });

  it("returns null when out of sensible range", () => {
    expect(parseSupplementalPercentOverride(0.02)).toBe(null);
    expect(parseSupplementalPercentOverride(150)).toBe(null);
    expect(parseSupplementalPercentOverride(Number.NaN)).toBe(null);
  });
});
