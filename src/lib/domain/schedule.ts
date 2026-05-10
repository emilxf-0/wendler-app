import type { LiftId, MicroWeek } from "./types";

export const FOUR_DAY_SCHEDULE: LiftId[] = [
  "squat",
  "bench",
  "deadlift",
  "press",
];

/** Three-day Forever rotation — matches BBB examples in Forever */
export const THREE_DAY_BY_MICRO_WEEK: Record<MicroWeek, LiftId[]> = {
  1: ["squat", "bench", "deadlift"],
  2: ["press", "squat", "bench"],
  3: ["deadlift", "press", "squat"],
};

export function liftForSession(params: {
  frequency: 3 | 4;
  microWeek: MicroWeek;
  workoutIndexInMicroWeek: number;
}): LiftId | null {
  const { frequency, microWeek, workoutIndexInMicroWeek } = params;

  if (frequency === 4) {
    if (workoutIndexInMicroWeek < 0 || workoutIndexInMicroWeek > 3)
      return null;
    return FOUR_DAY_SCHEDULE[workoutIndexInMicroWeek];
  }

  const week = THREE_DAY_BY_MICRO_WEEK[microWeek];
  if (workoutIndexInMicroWeek < 0 || workoutIndexInMicroWeek > 2) return null;
  return week[workoutIndexInMicroWeek];
}
