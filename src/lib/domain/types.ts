/** Canonical barbell lifts in Wendler programming order for scheduling. */
export type LiftId = "squat" | "bench" | "deadlift" | "press";

export type Unit = "lb" | "kg";

export type TemplateRole = "leader" | "anchor" | "either";

/** 5/3/1 weekly wave ordering vs Forever-style 3/5/1 percentage waves */
export type MainWaveVariant = "wendler_531" | "wendler_351";

export type TopSetKind =
  | "fixed"
  | "amrap"
  | "pr_goal"; // user-defined goal reps; same prescribed weight as amrap top

export interface MainSetPrescription {
  percentTm: number;
  repsTarget: number | "amrap";
  label: string;
}

export interface SupplementalKindNone {
  kind: "none";
}

export interface SupplementalBBB {
  kind: "bbb";
  sets: number;
  reps: number;
  /** Fraction of TM, e.g. 0.5 for 50% */
  percentTm: number;
}

export interface SupplementalFSL {
  kind: "fsl";
  sets: number;
  reps: number;
  /** Percent TM for supplemental — typically matches first main working set of the wave */
  percentTmFromMainIndex: 0;
}

export type SupplementalSpec =
  | SupplementalKindNone
  | SupplementalBBB
  | SupplementalFSL;

export interface TemplateDefinition {
  id: string;
  name: string;
  role: TemplateRole;
  shortDescription: string;
  recommendedTmNote: string;
  mainWave: MainWaveVariant;
  topSet: TopSetKind;
  supplemental: SupplementalSpec;
}

export type Phase = "leader" | "deload" | "anchor";

export type MicroWeek = 1 | 2 | 3;

export interface ActiveProgramSnapshot {
  leaderTemplateId: string;
  anchorTemplateId: string;
  frequency: 3 | 4;
  leaderCyclesTarget: number;
  anchorCyclesTarget: number;
  phase: Phase;
  microWeek: MicroWeek;
  workoutIndexInMicroWeek: number;
  leaderCyclesCompleted: number;
  anchorCyclesCompleted: number;
  pendingTmBump: boolean;
}

export interface UserSettingsSnapshot {
  units: Unit;
  roundingIncrement: number;
  trainingMaxes: Record<LiftId, number>;
  tmBumpUpper: number;
  tmBumpLower: number;
}

export const LIFTS: LiftId[] = ["squat", "bench", "deadlift", "press"];

export const LIFT_LABEL: Record<LiftId, string> = {
  squat: "Squat",
  bench: "Bench press",
  deadlift: "Deadlift",
  press: "Press",
};
