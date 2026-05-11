import type { ActiveProgramSnapshot, MicroWeek, Phase } from "./types";
import { SESSIONS_PER_MICRO_WEEK } from "./types";

const MAX_WORKOUT_INDEX = SESSIONS_PER_MICRO_WEEK - 1;

/** Upper bound (inclusive) for `workoutIndexInMicroWeek` — matches `liftForSession`. */
export function maxWorkoutIndexInMicroWeek(): number {
  return MAX_WORKOUT_INDEX;
}

export function clampWorkoutIndexInMicroWeek(workoutIndexInMicroWeek: number): number {
  const n = Math.floor(workoutIndexInMicroWeek);
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_WORKOUT_INDEX, Math.max(0, n));
}

function clampMicroWeek(n: number): MicroWeek {
  const v = Math.floor(n);
  if (v <= 1) return 1;
  if (v >= 3) return 3;
  return 2 as MicroWeek;
}

/**
 * After finishing all Leader cycles in real life — land on 7th-week deload at session slot 0.
 * Caller picks whether TM review is still pending (mirrors in-app transition) or already handled.
 */
export function presetDeloadAfterLeaderBlock(
  program: ActiveProgramSnapshot,
  pendingTmBump: boolean,
): ActiveProgramSnapshot {
  return {
    ...program,
    phase: "deload",
    microWeek: 1,
    workoutIndexInMicroWeek: 0,
    leaderCyclesCompleted: 0,
    anchorCyclesCompleted: 0,
    pendingTmRestartToLeader: false,
    pendingTmBump,
  };
}

/** Skip deload — start Anchor block at week 1. */
export function presetAnchorWeek1(
  program: ActiveProgramSnapshot,
): ActiveProgramSnapshot {
  return {
    ...program,
    phase: "anchor",
    microWeek: 1,
    workoutIndexInMicroWeek: 0,
    pendingTmBump: false,
    pendingTmRestartToLeader: false,
    // Mid-block Anchor counters preserved if user advanced manually;
    // for a fresh Anchor block after deload, set these to 0 in UI when needed.
    anchorCyclesCompleted: 0,
  };
}

export type AdvancedPositionPatch = {
  phase: Phase;
  microWeek: number;
  workoutIndexInMicroWeek: number;
  leaderCyclesCompleted: number;
  anchorCyclesCompleted: number;
  pendingTmBump: boolean;
  pendingTmRestartToLeader: boolean;
};

/** Merge explicit phase / week / slot and counters — indices are clamped to valid schedule bounds. */
export function applyAdvancedProgramPosition(
  program: ActiveProgramSnapshot,
  patch: AdvancedPositionPatch,
): ActiveProgramSnapshot {
  return {
    ...program,
    phase: patch.phase,
    microWeek: clampMicroWeek(patch.microWeek),
    workoutIndexInMicroWeek: clampWorkoutIndexInMicroWeek(
      patch.workoutIndexInMicroWeek,
    ),
    leaderCyclesCompleted: Math.max(
      0,
      Math.floor(patch.leaderCyclesCompleted) || 0,
    ),
    anchorCyclesCompleted: Math.max(
      0,
      Math.floor(patch.anchorCyclesCompleted) || 0,
    ),
    pendingTmBump: patch.pendingTmBump,
    pendingTmRestartToLeader: patch.pendingTmRestartToLeader,
  };
}
