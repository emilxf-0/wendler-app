import Dexie, { type Table } from "dexie";
import type { AssistancePresetsByCategory } from "@/lib/domain/assistanceCatalog";
import type {
  BbbLeaderMainTopSet,
  LiftId,
  Phase,
  SupplementalLiftMode,
} from "@/lib/domain/types";

export interface SettingsRow {
  id: string;
  roundingIncrement: number;
  trainingMaxes: Record<LiftId, number>;
  tmBumpUpper: number;
  tmBumpLower: number;
  supplementalLiftMode: SupplementalLiftMode;
  /** BBB supplemental as fraction of supplemental TM — `null` means use Leader template % */
  supplementalBbbPercentOverride: number | null;
  /** Default assistance picks when today's main lift is bench or press */
  assistancePresetUpper: AssistancePresetsByCategory;
  /** Default assistance picks when today's main lift is squat or deadlift */
  assistancePresetLower: AssistancePresetsByCategory;
  /** Local device: last successful JSON backup (epoch ms), not synced. */
  lastBackupAt: number | null;
}

/** Stored rows may include this until re-saved without migration fields. */
export type StoredSettingsShape = SettingsRow & { units?: "lb" | "kg" };

export interface ProgramRow {
  id: string;
  leaderTemplateId: string;
  anchorTemplateId: string;
  frequency: 3 | 4;
  leaderCyclesTarget: number;
  anchorCyclesTarget: number;
  phase: Phase;
  microWeek: 1 | 2 | 3;
  workoutIndexInMicroWeek: number;
  leaderCyclesCompleted: number;
  anchorCyclesCompleted: number;
  pendingTmBump: boolean;
  pendingTmRestartToLeader: boolean;
  bbbLeaderMainTopSet: BbbLeaderMainTopSet;
}

export interface SetLogRow {
  label: string;
  prescribedWeight: number;
  repsTarget: number | string;
  completed: boolean;
  actualWeight?: number;
  actualReps?: number;
}

export interface SupplementalLogRow {
  label: string;
  sets: number;
  reps: number;
  prescribedWeight: number;
  completedSets: boolean[];
}

/** One logged assistance set (add “Add set” once per set). */
export interface AssistanceSetRow {
  exerciseId: string;
  reps: number;
  /** Loaded weight in kg; null = bodyweight (no added load). */
  weightKg: number | null;
}

/** Older saves: total sets × reps at BW */
export interface AssistanceLegacyCompoundRow {
  exerciseId: string;
  sets: number;
  reps: number;
}

export type AssistanceEntryStored =
  | AssistanceSetRow
  | AssistanceLegacyCompoundRow;

export function isAssistanceSetRow(
  e: AssistanceEntryStored,
): e is AssistanceSetRow {
  return Object.prototype.hasOwnProperty.call(e, "weightKg");
}

export function formatAssistanceEntry(e: AssistanceEntryStored): string {
  if (isAssistanceSetRow(e)) {
    const w =
      e.weightKg == null ? "BW" : `${e.weightKg} kg`;
    return `${e.reps} reps · ${w}`;
  }
  return `${e.sets}×${e.reps} · BW`;
}

export interface SessionRow {
  id?: number;
  createdAt: number;
  lift: LiftId;
  phase: Phase;
  microWeek: number;
  workoutIndexInMicroWeek: number;
  leaderTemplateId: string;
  anchorTemplateId: string;
  mainSets: SetLogRow[];
  supplemental: SupplementalLogRow[];
  /** Legacy free-text; optional notes alongside structured assistance */
  assistanceNotes: string;
  assistanceEntries?: AssistanceEntryStored[];
}

export class WendlerDB extends Dexie {
  settings!: Table<SettingsRow>;
  program!: Table<ProgramRow>;
  sessions!: Table<SessionRow>;

  constructor() {
    super("wendler531db");
    this.version(1).stores({
      settings: "id",
      program: "id",
      sessions: "++id, createdAt, lift",
    });
    // Example migration scaffold:
    // this.version(2).stores({ ... }).upgrade(async (tx) => { ... });
  }
}

let dbInstance: WendlerDB | null = null;

export function getDb(): WendlerDB | null {
  if (typeof indexedDB === "undefined") return null;
  if (!dbInstance) dbInstance = new WendlerDB();
  return dbInstance;
}

/** Test-only: reset singleton */
export function resetDbSingletonForTests() {
  dbInstance = null;
}
