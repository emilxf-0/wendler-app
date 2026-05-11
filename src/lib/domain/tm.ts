import { LIFTS, type LiftId } from "./types";

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

/** Non-negative finite bump (kg); invalid values fall back so we never write NaN TMs. */
export function safeTmBumpKg(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

export function applyTmBumps(
  tms: Record<LiftId, number>,
  bumps: Record<LiftId, number>,
): Record<LiftId, number> {
  const next: Record<LiftId, number> = { ...tms };
  for (const lift of LIFTS) {
    const base = next[lift];
    const d = bumps[lift];
    const b = Number.isFinite(base) ? base : 0;
    const add = Number.isFinite(d) ? d : 0;
    next[lift] = Math.max(0, b + add);
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
