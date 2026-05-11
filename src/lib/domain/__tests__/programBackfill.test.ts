import { describe, expect, it } from "vitest";
import {
  applyAdvancedProgramPosition,
  clampWorkoutIndexInMicroWeek,
  maxWorkoutIndexInMicroWeek,
  presetAnchorWeek1,
  presetDeloadAfterLeaderBlock,
} from "@/lib/domain/programBackfill";
import type { ActiveProgramSnapshot } from "@/lib/domain/types";
import { SESSIONS_PER_MICRO_WEEK } from "@/lib/domain/types";

function baseProgram(
  overrides: Partial<ActiveProgramSnapshot> = {},
): ActiveProgramSnapshot {
  return {
    leaderTemplateId: "bbb",
    anchorTemplateId: "original_anchor",
    frequency: SESSIONS_PER_MICRO_WEEK,
    leaderCyclesTarget: 2,
    anchorCyclesTarget: 2,
    phase: "leader",
    microWeek: 1,
    workoutIndexInMicroWeek: 0,
    leaderCyclesCompleted: 0,
    anchorCyclesCompleted: 0,
    pendingTmBump: false,
    pendingTmRestartToLeader: false,
    bbbLeaderMainTopSet: "amrap",
    ...overrides,
  };
}

describe("clampWorkoutIndexInMicroWeek", () => {
  it("clamps four-lift schedule to 0–3", () => {
    expect(maxWorkoutIndexInMicroWeek()).toBe(3);
    expect(clampWorkoutIndexInMicroWeek(-5)).toBe(0);
    expect(clampWorkoutIndexInMicroWeek(2)).toBe(2);
    expect(clampWorkoutIndexInMicroWeek(99)).toBe(3);
  });
});

describe("presets", () => {
  it("presetDeloadAfterLeaderBlock lands on deload with chosen bump flag", () => {
    const p = baseProgram({ leaderCyclesCompleted: 1, pendingTmBump: true });
    const a = presetDeloadAfterLeaderBlock(p, false);
    expect(a.phase).toBe("deload");
    expect(a.microWeek).toBe(1);
    expect(a.workoutIndexInMicroWeek).toBe(0);
    expect(a.leaderCyclesCompleted).toBe(0);
    expect(a.anchorCyclesCompleted).toBe(0);
    expect(a.pendingTmBump).toBe(false);
    expect(a.pendingTmRestartToLeader).toBe(false);

    const b = presetDeloadAfterLeaderBlock(p, true);
    expect(b.pendingTmBump).toBe(true);
  });

  it("presetAnchorWeek1 clears bump flags and resets anchor cycle counter", () => {
    const p = baseProgram({
      phase: "deload",
      anchorCyclesCompleted: 1,
      pendingTmBump: true,
    });
    const out = presetAnchorWeek1(p);
    expect(out.phase).toBe("anchor");
    expect(out.microWeek).toBe(1);
    expect(out.workoutIndexInMicroWeek).toBe(0);
    expect(out.anchorCyclesCompleted).toBe(0);
    expect(out.pendingTmBump).toBe(false);
    expect(out.pendingTmRestartToLeader).toBe(false);
  });
});

describe("applyAdvancedProgramPosition", () => {
  it("clamps micro-week and session slot", () => {
    const p = baseProgram();
    const out = applyAdvancedProgramPosition(p, {
      phase: "anchor",
      microWeek: 99,
      workoutIndexInMicroWeek: 100,
      leaderCyclesCompleted: 3,
      anchorCyclesCompleted: 1,
      pendingTmBump: true,
      pendingTmRestartToLeader: false,
    });
    expect(out.phase).toBe("anchor");
    expect(out.microWeek).toBe(3);
    expect(out.workoutIndexInMicroWeek).toBe(3);
    expect(out.leaderCyclesCompleted).toBe(3);
    expect(out.anchorCyclesCompleted).toBe(1);
  });
});
