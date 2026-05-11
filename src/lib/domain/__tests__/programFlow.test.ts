import { describe, expect, it } from "vitest";
import {
  advanceAfterCompletedWorkout,
  clearTmBumpHold,
  finishTmBumpReset,
} from "@/lib/domain/programFlow";
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
    pendingTmRestartToLeader: false,
    bbbLeaderMainTopSet: "amrap",
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
    expect(next.pendingTmBump).toBe(true);
    expect(next.pendingTmRestartToLeader).toBe(false);
  });

  it("queues TM review each time a Leader 3-week wave finishes", () => {
    const program = baseProgram({
      microWeek: 3,
      workoutIndexInMicroWeek: 3,
      frequency: 4,
      leaderCyclesTarget: 99,
      leaderCyclesCompleted: 0,
    });
    const { next } = advanceAfterCompletedWorkout(program);
    expect(next.phase).toBe("leader");
    expect(next.microWeek).toBe(1);
    expect(next.leaderCyclesCompleted).toBe(1);
    expect(next.pendingTmBump).toBe(true);
    expect(next.pendingTmRestartToLeader).toBe(false);
  });

  it("queues TM review mid-anchor-block without restarting Leader yet", () => {
    const program = baseProgram({
      phase: "anchor",
      microWeek: 3,
      workoutIndexInMicroWeek: 3,
      frequency: 4,
      anchorCyclesCompleted: 0,
      anchorCyclesTarget: 2,
    });
    const { next } = advanceAfterCompletedWorkout(program);
    expect(next.phase).toBe("anchor");
    expect(next.microWeek).toBe(1);
    expect(next.anchorCyclesCompleted).toBe(1);
    expect(next.pendingTmBump).toBe(true);
    expect(next.pendingTmRestartToLeader).toBe(false);
  });

  it("flags Anchor block complete separately from TM hold", () => {
    const program = baseProgram({
      phase: "anchor",
      microWeek: 3,
      workoutIndexInMicroWeek: 3,
      frequency: 4,
      anchorCyclesCompleted: 1,
      anchorCyclesTarget: 2,
    });
    const { next } = advanceAfterCompletedWorkout(program);
    expect(next.pendingTmBump).toBe(true);
    expect(next.pendingTmRestartToLeader).toBe(true);
    expect(next.anchorCyclesCompleted).toBe(0);
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

describe("tm bump helpers", () => {
  it("finishTmBumpReset clears restart flag", () => {
    const p = baseProgram({ pendingTmRestartToLeader: true });
    const out = finishTmBumpReset(p);
    expect(out.pendingTmBump).toBe(false);
    expect(out.pendingTmRestartToLeader).toBe(false);
    expect(out.phase).toBe("leader");
  });

  it("clearTmBumpHold leaves restart flag untouched", () => {
    const p = baseProgram({ pendingTmBump: true, pendingTmRestartToLeader: false });
    const out = clearTmBumpHold(p);
    expect(out.pendingTmBump).toBe(false);
    expect(out.phase).toBe(p.phase);
  });
});
