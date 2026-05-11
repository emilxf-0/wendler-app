import { describe, expect, it } from "vitest";
import { buildWorkoutPrescription } from "@/lib/domain/prescription";
import {
  getTemplate,
  leaderTemplateUsesBbb,
} from "@/lib/domain/templates";

describe("buildWorkoutPrescription · BBB leader mains", () => {
  const bbb = getTemplate("bbb")!;
  const anchorOriginal = getTemplate("original_anchor")!;

  it("uses AMRAP top when bbbLeaderMainTopSet is amrap", () => {
    const p = buildWorkoutPrescription({
      lift: "squat",
      template: bbb,
      phase: "leader",
      microWeek: 1,
      tm: 100,
      supplementalLift: "squat",
      supplementalTm: 100,
      roundingIncrement: 2.5,
      supplementalBbbPercentOverride: null,
      bbbLeaderMainTopSet: "amrap",
    });
    expect(p.mainSets[2]?.repsTarget).toBe("amrap");
  });

  it("uses fixed reps on top when bbbLeaderMainTopSet is fixed (5's PRO)", () => {
    const p = buildWorkoutPrescription({
      lift: "squat",
      template: bbb,
      phase: "leader",
      microWeek: 1,
      tm: 100,
      supplementalLift: "squat",
      supplementalTm: 100,
      roundingIncrement: 2.5,
      supplementalBbbPercentOverride: null,
      bbbLeaderMainTopSet: "fixed",
    });
    expect(p.mainSets[2]?.repsTarget).toBe(5);
  });

  it("ignores bbbLeaderMainTopSet outside Leader BBB (Anchor follows template)", () => {
    const p = buildWorkoutPrescription({
      lift: "squat",
      template: anchorOriginal,
      phase: "anchor",
      microWeek: 1,
      tm: 100,
      supplementalLift: "squat",
      supplementalTm: 100,
      roundingIncrement: 2.5,
      supplementalBbbPercentOverride: null,
      bbbLeaderMainTopSet: "fixed",
    });
    expect(p.mainSets[2]?.repsTarget).toBe("amrap");
  });
});

describe("leaderTemplateUsesBbb", () => {
  it("is true for BBB leaders only", () => {
    expect(leaderTemplateUsesBbb("bbb")).toBe(true);
    expect(leaderTemplateUsesBbb("bbb_351")).toBe(true);
    expect(leaderTemplateUsesBbb("fsl_leader")).toBe(false);
  });
});
