import { describe, expect, it } from "vitest";
import { buildWorkoutPrescription } from "@/lib/domain/prescription";
import { buildWarmupSets } from "@/lib/domain/mainWork";
import {
  getTemplate,
  leaderTemplateUsesBbb,
} from "@/lib/domain/templates";

describe("buildWarmupSets", () => {
  it("prescribes 40/50/60% with 5/5/3 reps", () => {
    const sets = buildWarmupSets();
    expect(sets).toHaveLength(3);
    expect(sets.map((s) => s.percentTm)).toEqual([0.4, 0.5, 0.6]);
    expect(sets.map((s) => s.repsTarget)).toEqual([5, 5, 3]);
    expect(sets.map((s) => s.label)).toEqual([
      "40% × 5",
      "50% × 5",
      "60% × 3",
    ]);
  });
});

describe("buildWorkoutPrescription · warmups", () => {
  const bbb = getTemplate("bbb")!;

  it("includes warmups for Leader and Anchor", () => {
    const leader = buildWorkoutPrescription({
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
    expect(leader.warmupSets).toHaveLength(3);

    const anchor = buildWorkoutPrescription({
      ...{
        lift: "squat" as const,
        template: getTemplate("original_anchor")!,
        microWeek: 1 as const,
        tm: 100,
        supplementalLift: "squat" as const,
        supplementalTm: 100,
        roundingIncrement: 2.5,
        supplementalBbbPercentOverride: null,
        bbbLeaderMainTopSet: "amrap" as const,
      },
      phase: "anchor",
    });
    expect(anchor.warmupSets).toHaveLength(3);
  });

  it("omits warmups on deload", () => {
    const deload = buildWorkoutPrescription({
      lift: "squat",
      template: bbb,
      phase: "deload",
      microWeek: 1,
      tm: 100,
      supplementalLift: "squat",
      supplementalTm: 100,
      roundingIncrement: 2.5,
      supplementalBbbPercentOverride: null,
      bbbLeaderMainTopSet: "amrap",
    });
    expect(deload.warmupSets).toEqual([]);
  });
});

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
