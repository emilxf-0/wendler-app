import type {
  ActiveProgramSnapshot,
  LiftId,
  MicroWeek,
} from "./types";
import { getTemplate } from "./templates";

export function rowToSnapshot(row: {
  leaderTemplateId: string;
  anchorTemplateId: string;
  frequency: 3 | 4;
  leaderCyclesTarget: number;
  anchorCyclesTarget: number;
  phase: ActiveProgramSnapshot["phase"];
  microWeek: MicroWeek;
  workoutIndexInMicroWeek: number;
  leaderCyclesCompleted: number;
  anchorCyclesCompleted: number;
  pendingTmBump: boolean;
}): ActiveProgramSnapshot {
  return {
    leaderTemplateId: row.leaderTemplateId,
    anchorTemplateId: row.anchorTemplateId,
    frequency: row.frequency,
    leaderCyclesTarget: row.leaderCyclesTarget,
    anchorCyclesTarget: row.anchorCyclesTarget,
    phase: row.phase,
    microWeek: row.microWeek,
    workoutIndexInMicroWeek: row.workoutIndexInMicroWeek,
    leaderCyclesCompleted: row.leaderCyclesCompleted,
    anchorCyclesCompleted: row.anchorCyclesCompleted,
    pendingTmBump: row.pendingTmBump,
  };
}
export function defaultActiveProgram(
  overrides?: Partial<ActiveProgramSnapshot>,
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

export function defaultSettings() {
  const trainingMaxes: Record<LiftId, number> = {
    squat: 0,
    bench: 0,
    deadlift: 0,
    press: 0,
  };
  return {
    units: "lb" as const,
    roundingIncrement: 2.5,
    trainingMaxes,
    tmBumpUpper: 5,
    tmBumpLower: 10,
  };
}

export function effectiveTemplate(program: ActiveProgramSnapshot) {
  const id =
    program.phase === "anchor"
      ? program.anchorTemplateId
      : program.leaderTemplateId;
  const t = getTemplate(id);
  if (!t) {
    throw new Error(`Unknown template ${id}`);
  }
  return t;
}

export interface AdvanceResult {
  next: ActiveProgramSnapshot;
  milestones: string[];
}

/**
 * Call after user logs a completed workout for the current session.
 */
export function advanceAfterCompletedWorkout(
  program: ActiveProgramSnapshot,
): AdvanceResult {
  const milestones: string[] = [];
  let next: ActiveProgramSnapshot = { ...program };

  const freq = next.frequency;

  if (next.pendingTmBump) {
    milestones.push(
      "Training max bump is pending — update training maxes in Setup before continuing.",
    );
    return { next, milestones };
  }

  next = {
    ...next,
    workoutIndexInMicroWeek: next.workoutIndexInMicroWeek + 1,
  };

  if (next.phase === "deload") {
    if (next.workoutIndexInMicroWeek >= freq) {
      next.workoutIndexInMicroWeek = 0;
      next.phase = "anchor";
      next.microWeek = 1;
      milestones.push("Deload complete — starting Anchor block.");
    }
    return { next, milestones };
  }

  if (next.workoutIndexInMicroWeek >= freq) {
    next.workoutIndexInMicroWeek = 0;
    const prevWeek = next.microWeek;
    next.microWeek = ((prevWeek % 3) + 1) as MicroWeek;

    if (prevWeek === 3) {
      if (next.phase === "leader") {
        next.leaderCyclesCompleted += 1;
        milestones.push(
          `Leader cycle ${next.leaderCyclesCompleted}/${next.leaderCyclesTarget} finished.`,
        );
        if (next.leaderCyclesCompleted >= next.leaderCyclesTarget) {
          next.phase = "deload";
          next.microWeek = 1;
          next.leaderCyclesCompleted = 0;
          milestones.push(
            "Leader block finished — run your 7th-week deload before Anchor.",
          );
        }
      } else if (next.phase === "anchor") {
        next.anchorCyclesCompleted += 1;
        milestones.push(
          `Anchor cycle ${next.anchorCyclesCompleted}/${next.anchorCyclesTarget} finished.`,
        );
        if (next.anchorCyclesCompleted >= next.anchorCyclesTarget) {
          next.pendingTmBump = true;
          next.anchorCyclesCompleted = 0;
          next.microWeek = 1;
          next.workoutIndexInMicroWeek = 0;
          milestones.push(
            "Anchor block finished — apply conservative TM increases, then start the next Leader block.",
          );
        }
      }
    }
  }

  return { next, milestones };
}

/** After TM bump UI — clear pending flag and return to leader phase fresh */
export function finishTmBumpReset(
  program: ActiveProgramSnapshot,
): ActiveProgramSnapshot {
  return {
    ...program,
    pendingTmBump: false,
    phase: "leader",
    microWeek: 1,
    workoutIndexInMicroWeek: 0,
    leaderCyclesCompleted: 0,
    anchorCyclesCompleted: 0,
  };
}
