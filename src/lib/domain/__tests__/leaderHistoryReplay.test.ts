import { describe, expect, it } from "vitest";
import { generateCompletedSessionsThroughLeaderCycles } from "@/lib/domain/leaderHistoryReplay";
import type { ActiveProgramSnapshot } from "@/lib/domain/types";
import type { SettingsRow } from "@/lib/db/schema";

const START_TMS = {
  squat: 100,
  bench: 80,
  deadlift: 120,
  press: 50,
} as const;

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

function mockReplaySettings(): Pick<
  SettingsRow,
  | "roundingIncrement"
  | "supplementalLiftMode"
  | "supplementalBbbPercentOverride"
  | "tmBumpUpper"
  | "tmBumpLower"
> {
  return {
    roundingIncrement: 1.25,
    supplementalLiftMode: "same",
    supplementalBbbPercentOverride: null,
    tmBumpUpper: 2.5,
    tmBumpLower: 5,
  };
}

describe("generateCompletedSessionsThroughLeaderCycles", () => {
  it("returns empty when not starting in Leader", () => {
    const p = baseProgram({ phase: "anchor" });
    const res = generateCompletedSessionsThroughLeaderCycles({
      startProgram: p,
      settings: mockReplaySettings(),
      startingTrainingMaxes: { ...START_TMS },
      leaderWavesToSimulate: 1,
      includeDeloadInHistory: false,
      finalSessionTimestampMs: 1_700_000_000_000,
    });
    expect(res.sessions).toEqual([]);
    expect(res.finalProgram).toEqual(p);
    expect(res.finalTrainingMaxes).toEqual(START_TMS);
  });

  it("returns empty for zero waves", () => {
    const p = baseProgram();
    const res = generateCompletedSessionsThroughLeaderCycles({
      startProgram: p,
      settings: mockReplaySettings(),
      startingTrainingMaxes: { ...START_TMS },
      leaderWavesToSimulate: 0,
      includeDeloadInHistory: false,
      finalSessionTimestampMs: 0,
    });
    expect(res.sessions).toEqual([]);
    expect(res.finalTrainingMaxes).toEqual(START_TMS);
  });

  it("produces 12 leader sessions for one wave at 4-day frequency", () => {
    const p = baseProgram({ leaderCyclesTarget: 99 });
    const res = generateCompletedSessionsThroughLeaderCycles({
      startProgram: p,
      settings: mockReplaySettings(),
      startingTrainingMaxes: { ...START_TMS },
      leaderWavesToSimulate: 1,
      includeDeloadInHistory: false,
      finalSessionTimestampMs: 1_000,
    });
    expect(res.sessions.length).toBe(12);
    expect(res.sessions.every((s) => s.phase === "leader")).toBe(true);
    expect(res.finalProgram.phase).toBe("leader");
    expect(res.finalProgram.leaderCyclesCompleted).toBe(1);
    expect(res.finalProgram.pendingTmBump).toBe(true);
    expect(res.finalTrainingMaxes).toEqual(START_TMS);
  });

  it("enters deload after final wave when waves match target", () => {
    const p = baseProgram({ leaderCyclesTarget: 1 });
    const res = generateCompletedSessionsThroughLeaderCycles({
      startProgram: p,
      settings: mockReplaySettings(),
      startingTrainingMaxes: { ...START_TMS },
      leaderWavesToSimulate: 1,
      includeDeloadInHistory: false,
      finalSessionTimestampMs: 1_000,
    });
    expect(res.sessions.length).toBe(12);
    expect(res.finalProgram.phase).toBe("deload");
    expect(res.finalProgram.pendingTmBump).toBe(true);
    expect(res.finalTrainingMaxes).toEqual(START_TMS);
  });

  it("appends deload sessions when requested", () => {
    const p = baseProgram({ leaderCyclesTarget: 1 });
    const res = generateCompletedSessionsThroughLeaderCycles({
      startProgram: p,
      settings: mockReplaySettings(),
      startingTrainingMaxes: { ...START_TMS },
      leaderWavesToSimulate: 1,
      includeDeloadInHistory: true,
      finalSessionTimestampMs: 1_000,
    });
    expect(res.sessions.length).toBe(12 + 4);
    const deloadCount = res.sessions.filter((s) => s.phase === "deload").length;
    expect(deloadCount).toBe(4);
    expect(res.finalProgram.phase).toBe("anchor");
    expect(res.finalProgram.microWeek).toBe(1);
    expect(res.finalTrainingMaxes.squat).toBe(105);
    expect(res.finalTrainingMaxes.bench).toBe(82.5);
    expect(res.finalTrainingMaxes.deadlift).toBe(125);
    expect(res.finalTrainingMaxes.press).toBe(52.5);
  });

  it("stops at deload when more waves requested than fit before 7th week (target 1, waves 2)", () => {
    const p = baseProgram({ leaderCyclesTarget: 1 });
    const res = generateCompletedSessionsThroughLeaderCycles({
      startProgram: p,
      settings: mockReplaySettings(),
      startingTrainingMaxes: { ...START_TMS },
      leaderWavesToSimulate: 2,
      includeDeloadInHistory: false,
      finalSessionTimestampMs: 1_000,
    });
    expect(res.sessions.length).toBe(12);
    expect(res.finalProgram.phase).toBe("deload");
    expect(res.finalTrainingMaxes).toEqual(START_TMS);
  });

  it("runs two leader waves when block allows (target 99)", () => {
    const p = baseProgram({ leaderCyclesTarget: 99 });
    const res = generateCompletedSessionsThroughLeaderCycles({
      startProgram: p,
      settings: mockReplaySettings(),
      startingTrainingMaxes: { ...START_TMS },
      leaderWavesToSimulate: 2,
      includeDeloadInHistory: false,
      finalSessionTimestampMs: 1_000,
    });
    expect(res.sessions.length).toBe(24);
    expect(res.finalProgram.phase).toBe("leader");
    expect(res.finalProgram.leaderCyclesCompleted).toBe(2);
    expect(res.finalTrainingMaxes.squat).toBe(105);
    expect(res.finalTrainingMaxes.bench).toBe(82.5);
  });

  it("applies TM bumps between leader waves so later squats use higher prescribed loads", () => {
    const p = baseProgram({ leaderCyclesTarget: 99 });
    const res = generateCompletedSessionsThroughLeaderCycles({
      startProgram: p,
      settings: mockReplaySettings(),
      startingTrainingMaxes: { ...START_TMS },
      leaderWavesToSimulate: 2,
      includeDeloadInHistory: false,
      finalSessionTimestampMs: 1_000,
    });
    expect(res.sessions[0].lift).toBe("squat");
    expect(res.sessions[12].lift).toBe("squat");
    const w0 = res.sessions[0].mainSets[0]?.prescribedWeight ?? 0;
    const w12 = res.sessions[12].mainSets[0]?.prescribedWeight ?? 0;
    expect(w12).toBeGreaterThan(w0);
  });

  it("spaces session dates every other calendar day backward from final", () => {
    const finalMs = new Date(2026, 4, 30, 9, 15).getTime();
    const p = baseProgram({ leaderCyclesTarget: 99 });
    const res = generateCompletedSessionsThroughLeaderCycles({
      startProgram: p,
      settings: mockReplaySettings(),
      startingTrainingMaxes: { ...START_TMS },
      leaderWavesToSimulate: 1,
      includeDeloadInHistory: false,
      finalSessionTimestampMs: finalMs,
    });
    const n = res.sessions.length;
    expect(n).toBe(12);
    expect(res.sessions[n - 1]!.createdAt).toBe(finalMs);
    const expectedFirst = new Date(finalMs);
    expectedFirst.setDate(expectedFirst.getDate() - 2 * (n - 1));
    expect(res.sessions[0]!.createdAt).toBe(expectedFirst.getTime());
    const mid = new Date(finalMs);
    mid.setDate(mid.getDate() - 2 * (n - 1 - 6));
    expect(res.sessions[6]!.createdAt).toBe(mid.getTime());
  });
});
