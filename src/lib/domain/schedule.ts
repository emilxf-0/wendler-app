import type { LiftId } from "./types";

/** The other barbell lift in the same movement category (upper vs lower). */
const PAIRED_LIFT: Record<LiftId, LiftId> = {
  squat: "deadlift",
  deadlift: "squat",
  bench: "press",
  press: "bench",
};

export function pairedBarbellLift(lift: LiftId): LiftId {
  return PAIRED_LIFT[lift];
}

export function mainLiftIsUpperBody(lift: LiftId): boolean {
  return lift === "bench" || lift === "press";
}

export const FOUR_DAY_SCHEDULE: LiftId[] = [
  "squat",
  "bench",
  "deadlift",
  "press",
];

export function liftForSession(workoutIndexInMicroWeek: number): LiftId | null {
  if (workoutIndexInMicroWeek < 0 || workoutIndexInMicroWeek > 3) return null;
  return FOUR_DAY_SCHEDULE[workoutIndexInMicroWeek];
}
