import type { SetLogRow, SupplementalLogRow } from "@/lib/db/schema";
import {
  workingWeightForSet,
  type WorkoutPrescription,
} from "@/lib/domain/prescription";

/** Main + supplemental logs with every set marked completed (synthetic / “complete workout”). */
export function completedSessionLogsFromPrescription(params: {
  prescription: WorkoutPrescription;
  tm: number;
  roundingIncrement: number;
}): {
  warmupSets: SetLogRow[];
  mainSets: SetLogRow[];
  supplemental: SupplementalLogRow[];
} {
  const { prescription, tm, roundingIncrement } = params;

  const warmupSets: SetLogRow[] = prescription.warmupSets.map((set) => ({
    label: set.label,
    prescribedWeight: workingWeightForSet(tm, set.percentTm, roundingIncrement),
    repsTarget: set.repsTarget,
    completed: true,
  }));

  const mainSets: SetLogRow[] = prescription.mainSets.map((set) => ({
    label: set.label,
    prescribedWeight: workingWeightForSet(tm, set.percentTm, roundingIncrement),
    repsTarget: set.repsTarget,
    completed: true,
  }));

  const supplemental: SupplementalLogRow[] = prescription.supplemental.map(
    (supp) => ({
      label: supp.label,
      sets: supp.sets,
      reps: supp.reps,
      prescribedWeight: supp.prescribedWeight,
      completedSets: Array.from({ length: supp.sets }, () => true),
    }),
  );

  return { warmupSets, mainSets, supplemental };
}
