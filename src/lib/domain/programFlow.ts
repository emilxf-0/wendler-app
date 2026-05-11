import type {
  ActiveProgramSnapshot,
  LiftId,
  MicroWeek,
  SupplementalLiftMode,
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
  pendingTmRestartToLeader: boolean;
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
    pendingTmRestartToLeader: row.pendingTmRestartToLeader,
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
    pendingTmRestartToLeader: false,
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
    roundingIncrement: 1.25,
    trainingMaxes,
    tmBumpUpper: 2.5,
    tmBumpLower: 5,
    supplementalLiftMode: "same" as SupplementalLiftMode,
    supplementalBbbPercentOverride: null,
    assistancePresetUpper: {},
    assistancePresetLower: {},
    lastBackupAt: null,
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
        next.pendingTmBump = true;
        next.pendingTmRestartToLeader = false;
        milestones.push(
          "Review or bump training maxes on the Dashboard before continuing.",
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
        next.pendingTmBump = true;
        next.pendingTmRestartToLeader = false;
        milestones.push(
          "Review or bump training maxes on the Dashboard before continuing.",
        );
        if (next.anchorCyclesCompleted >= next.anchorCyclesTarget) {
          next.pendingTmRestartToLeader = true;
          next.anchorCyclesCompleted = 0;
          next.microWeek = 1;
          next.workoutIndexInMicroWeek = 0;
          milestones.push(
            "Anchor block finished — after TM review the app will restart your next block in Leader.",
          );
        }
      }
    }
  }

  return { next, milestones };
}

/** After full Anchor block: clear TM hold and restart Leader. */
export function finishTmBumpReset(
  program: ActiveProgramSnapshot,
): ActiveProgramSnapshot {
  return {
    ...program,
    pendingTmBump: false,
    pendingTmRestartToLeader: false,
    phase: "leader",
    microWeek: 1,
    workoutIndexInMicroWeek: 0,
    leaderCyclesCompleted: 0,
    anchorCyclesCompleted: 0,
  };
}

/** After a mid-block TM review: clear hold only. */
export function clearTmBumpHold(
  program: ActiveProgramSnapshot,
): ActiveProgramSnapshot {
  return { ...program, pendingTmBump: false };
}
