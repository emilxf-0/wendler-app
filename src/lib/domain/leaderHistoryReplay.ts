import type { SessionRow, SettingsRow } from "@/lib/db/schema";
import {
  advanceAfterCompletedWorkout,
  clearTmBumpHold,
  defaultSettings,
  effectiveTemplate,
} from "@/lib/domain/programFlow";
import { buildWorkoutPrescription } from "@/lib/domain/prescription";
import { completedSessionLogsFromPrescription } from "@/lib/domain/sessionLogFromPrescription";
import { liftForSession, pairedBarbellLift } from "@/lib/domain/schedule";
import {
  applyTmBumps,
  safeTmBumpKg,
  standardBumpDeltas,
} from "@/lib/domain/tm";
import type { ActiveProgramSnapshot, LiftId } from "@/lib/domain/types";

/** Prescription fields + TM bump sizes (training maxes come from `startingTrainingMaxes` + simulated bumps). */
export type ReplaySettings = Pick<
  SettingsRow,
  | "roundingIncrement"
  | "supplementalLiftMode"
  | "supplementalBbbPercentOverride"
  | "tmBumpUpper"
  | "tmBumpLower"
>;

export type LeaderHistoryReplayResult = {
  sessions: Omit<SessionRow, "id">[];
  finalProgram: ActiveProgramSnapshot;
  /** TMs after all bumps applied during the replay (end of simulated timeline). */
  finalTrainingMaxes: Record<LiftId, number>;
};

function applyStandardReplayBump(
  tms: Record<LiftId, number>,
  settings: ReplaySettings,
): Record<LiftId, number> {
  const defs = defaultSettings();
  const upper = safeTmBumpKg(settings.tmBumpUpper, defs.tmBumpUpper);
  const lower = safeTmBumpKg(settings.tmBumpLower, defs.tmBumpLower);
  return applyTmBumps(
    tms,
    standardBumpDeltas({ tmBumpUpper: upper, tmBumpLower: lower }),
  );
}

function buildOneSession(params: {
  snapshot: ActiveProgramSnapshot;
  settings: ReplaySettings;
  trainingMaxes: Record<LiftId, number>;
  createdAt: number;
}): Omit<SessionRow, "id"> | null {
  const { snapshot, settings, trainingMaxes, createdAt } = params;
  const lift = liftForSession({
    frequency: snapshot.frequency,
    microWeek: snapshot.microWeek,
    workoutIndexInMicroWeek: snapshot.workoutIndexInMicroWeek,
  });
  if (!lift) return null;

  const supplementalLift: LiftId =
    settings.supplementalLiftMode === "paired"
      ? pairedBarbellLift(lift)
      : lift;

  const tm = trainingMaxes[lift] ?? 0;
  const template = effectiveTemplate(snapshot);
  const prescription = buildWorkoutPrescription({
    lift,
    template,
    phase: snapshot.phase,
    microWeek: snapshot.microWeek,
    tm,
    supplementalLift,
    supplementalTm: trainingMaxes[supplementalLift] ?? 0,
    roundingIncrement: settings.roundingIncrement,
    supplementalBbbPercentOverride: settings.supplementalBbbPercentOverride,
    bbbLeaderMainTopSet: snapshot.bbbLeaderMainTopSet,
  });

  const { mainSets, supplemental } = completedSessionLogsFromPrescription({
    prescription,
    tm,
    roundingIncrement: settings.roundingIncrement,
  });

  return {
    createdAt,
    lift,
    phase: snapshot.phase,
    microWeek: snapshot.microWeek,
    workoutIndexInMicroWeek: snapshot.workoutIndexInMicroWeek,
    leaderTemplateId: snapshot.leaderTemplateId,
    anchorTemplateId: snapshot.anchorTemplateId,
    mainSets,
    supplemental,
    assistanceNotes: "",
  };
}

/**
 * Replay Leader waves from week 1. Uses `startingTrainingMaxes` for the first session(s);
 * whenever the program would show a TM review (`pendingTmBump`), applies Setup-style bumps
 * (`tmBumpUpper` / `tmBumpLower`) before the next session — same rhythm as the Dashboard.
 */
export function generateCompletedSessionsThroughLeaderCycles(params: {
  startProgram: ActiveProgramSnapshot;
  settings: ReplaySettings;
  startingTrainingMaxes: Record<LiftId, number>;
  leaderWavesToSimulate: number;
  includeDeloadInHistory: boolean;
  baseTimestampMs: number;
  sessionSpacingMs?: number;
}): LeaderHistoryReplayResult {
  const {
    startProgram,
    settings,
    startingTrainingMaxes,
    leaderWavesToSimulate,
    includeDeloadInHistory,
    baseTimestampMs,
    sessionSpacingMs = 60_000,
  } = params;

  if (startProgram.phase !== "leader") {
    return {
      sessions: [],
      finalProgram: startProgram,
      finalTrainingMaxes: { ...startingTrainingMaxes },
    };
  }

  const waves = Math.floor(leaderWavesToSimulate);
  if (waves < 1) {
    return {
      sessions: [],
      finalProgram: startProgram,
      finalTrainingMaxes: { ...startingTrainingMaxes },
    };
  }

  let tms: Record<LiftId, number> = { ...startingTrainingMaxes };

  let snap: ActiveProgramSnapshot = { ...startProgram };
  const sessions: Omit<SessionRow, "id">[] = [];
  let tsIndex = 0;
  let leaderWavesDone = 0;

  while (leaderWavesDone < waves && snap.phase === "leader") {
    if (snap.pendingTmBump) {
      tms = applyStandardReplayBump(tms, settings);
      snap = clearTmBumpHold(snap);
    }
    if (snap.phase !== "leader") {
      break;
    }

    const createdAt = baseTimestampMs + tsIndex * sessionSpacingMs;
    tsIndex += 1;

    const row = buildOneSession({
      snapshot: snap,
      settings,
      trainingMaxes: tms,
      createdAt,
    });
    if (!row) break;
    sessions.push(row);

    const prevSnap = snap;
    const { next } = advanceAfterCompletedWorkout(snap);
    snap = next;

    const startedNewLeaderWave =
      snap.phase === "leader" &&
      snap.microWeek === 1 &&
      snap.workoutIndexInMicroWeek === 0 &&
      (prevSnap.microWeek !== 1 || prevSnap.workoutIndexInMicroWeek !== 0);

    const finishedLeaderBlockToDeload =
      snap.phase === "deload" && prevSnap.phase === "leader";

    if (startedNewLeaderWave || finishedLeaderBlockToDeload) {
      leaderWavesDone += 1;
    }
  }

  if (includeDeloadInHistory && snap.phase === "deload") {
    let guard = 0;
    const maxDeload = snap.frequency + 2;
    while (snap.phase === "deload" && guard < maxDeload) {
      guard += 1;
      if (snap.pendingTmBump) {
        tms = applyStandardReplayBump(tms, settings);
        snap = clearTmBumpHold(snap);
      }

      const createdAt = baseTimestampMs + tsIndex * sessionSpacingMs;
      tsIndex += 1;

      const row = buildOneSession({
        snapshot: snap,
        settings,
        trainingMaxes: tms,
        createdAt,
      });
      if (!row) break;
      sessions.push(row);

      const { next } = advanceAfterCompletedWorkout(snap);
      snap = next;
    }
  }

  return {
    sessions,
    finalProgram: snap,
    finalTrainingMaxes: tms,
  };
}
