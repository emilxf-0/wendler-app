import { describe, expect, it } from "vitest";
import { advanceAfterCompletedWorkout } from "@/lib/domain/programFlow";
import type { ActiveProgramSnapshot } from "@/lib/domain/types";

function baseProgram(
  overrides: Partial<ActiveProgramSnapshot> = {},
): ActiveProgramSnapshot {
  return {
    leaderTemplateId: "bbb",
    anchorTemplateId: "original_anchor",
    frequency: 4,
    leaderCyclesTarget: 2,
    anchorCyclesTarget: 2,
    phase: "leader",
    microWeek: 1,
    workoutIndexInMicroWeek: 0,
    leaderCyclesCompleted: 0,
    anchorCyclesCompleted: 0,
    pendingTmBump: false,
    ...overrides,
  };
}

describe("advanceAfterCompletedWorkout", () => {
  it("increments workout index within micro-week", () => {
    const program = baseProgram({ workoutIndexInMicroWeek: 1 });
    const { next } = advanceAfterCompletedWorkout(program);
    expect(next.workoutIndexInMicroWeek).toBe(2);
  });

  it("rolls micro-week forward after completing final session", () => {
    const program = baseProgram({
      microWeek: 1,
      workoutIndexInMicroWeek: 3,
      frequency: 4,
    });
    const { next } = advanceAfterCompletedWorkout(program);
    expect(next.workoutIndexInMicroWeek).toBe(0);
    expect(next.microWeek).toBe(2);
  });

  it("enters deload after completing leader cycles target", () => {
    const program = baseProgram({
      microWeek: 3,
      workoutIndexInMicroWeek: 3,
      frequency: 4,
      leaderCyclesCompleted: 0,
      leaderCyclesTarget: 1,
      phase: "leader",
    });

    const { next } = advanceAfterCompletedWorkout(program);
    expect(next.phase).toBe("deload");
    expect(next.microWeek).toBe(1);
  });

  it("transitions deload to anchor after frequency sessions", () => {
    const program = baseProgram({
      phase: "deload",
      microWeek: 1,
      workoutIndexInMicroWeek: 3,
      frequency: 4,
    });
    const { next } = advanceAfterCompletedWorkout(program);
    expect(next.phase).toBe("anchor");
    expect(next.microWeek).toBe(1);
    expect(next.workoutIndexInMicroWeek).toBe(0);
  });
});
