import type { LiftId } from "./types";

/** Wendler's common e1RM estimate from the Forever book. */
export function estimateOneRepMax(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * reps * 0.0333 + weight;
}

export function suggestedTrainingMax(
  estimatedOneRepMax: number,
  tmFraction: number,
): number {
  if (estimatedOneRepMax <= 0) return 0;
  return estimatedOneRepMax * tmFraction;
}

export function applyTmBumps(
  tms: Record<LiftId, number>,
  bumps: Record<LiftId, number>,
): Record<LiftId, number> {
  const next = { ...tms };
  for (const lift of Object.keys(bumps) as LiftId[]) {
    next[lift] = Math.max(0, (next[lift] ?? 0) + (bumps[lift] ?? 0));
  }
  return next;
}

export function standardBumpDeltas(params: {
  tmBumpUpper: number;
  tmBumpLower: number;
}): Record<LiftId, number> {
  const { tmBumpUpper, tmBumpLower } = params;
  return {
    squat: tmBumpLower,
    deadlift: tmBumpLower,
    bench: tmBumpUpper,
    press: tmBumpUpper,
  };
}
