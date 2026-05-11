/** Whether supplemental prescriptions use today's main TM or the paired UB/LB TM. */
export type SupplementalLiftMode = "same" | "paired";

export type LiftId = "squat" | "bench" | "deadlift" | "press";

export type TemplateRole = "leader" | "anchor" | "either";

/** 5/3/1 weekly wave ordering vs Forever-style 3/5/1 percentage waves */
export type MainWaveVariant = "wendler_531" | "wendler_351";

export type TopSetKind =
  | "fixed"
  | "amrap"
  | "pr_goal"; // user-defined goal reps; same prescribed weight as amrap top

/** Leader BBB mains only: classic PR-set week vs Forever-style 5's PRO (no AMRAP top). */
export type BbbLeaderMainTopSet = Extract<TopSetKind, "amrap" | "fixed">;

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

/** FSL-style volume: percentages follow a chosen main-wave step (typically first working set). */
export interface SupplementalKindFsl {
  kind: "fsl";
  sets: number;
  reps: number;
  /** Which main-set step (0 = first working, 1 = second, 2 = top) supplies the % — currently only 0 is used. */
  percentTmFromMainIndex: 0 | 1 | 2;
}

/**
 * Volume at a percentage taken from the current micro-week wave:
 * step 0 ≈ FSL (first working set), 1 ≈ SSL (second), 2 ≈ top/heaviest ramp step.
 */
export interface SupplementalWaveStepVolume {
  kind: "wave_step_volume";
  sets: number;
  reps: number;
  waveStep: 0 | 1 | 2;
}

export type SupplementalSpec =
  | SupplementalKindNone
  | SupplementalBBB
  | SupplementalKindFsl
  | SupplementalWaveStepVolume;

/** Which primary bar prescription to use for the main lift of the day */
export type PrimaryMainSequence = "standard_wave" | "five_by_five_three_one";

export interface TemplateDefinition {
  id: string;
  name: string;
  role: TemplateRole;
  shortDescription: string;
  recommendedTmNote: string;
  mainWave: MainWaveVariant;
  /** Used only when primaryMainSequence is standard_wave */
  topSet: TopSetKind;
  primaryMainSequence: PrimaryMainSequence;
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
  /** True only after finishing the full Anchor block; Dashboard then restarts Leader. */
  pendingTmRestartToLeader: boolean;
  /**
   * Leader phase only: applies when `leaderTemplateId` is a BBB template (`bbb`, `bbb_351`).
   * PR sets = AMRAP top working set; 5's PRO = prescribed reps on every main set (no AMRAP).
   */
  bbbLeaderMainTopSet: BbbLeaderMainTopSet;
}

export const LIFTS: LiftId[] = ["squat", "bench", "deadlift", "press"];

export const LIFT_LABEL: Record<LiftId, string> = {
  squat: "Squat",
  bench: "Bench press",
  deadlift: "Deadlift",
  press: "Press",
};
