import Dexie, { type Table } from "dexie";
import type { LiftId, Phase } from "@/lib/domain/types";

export interface SettingsRow {
  id: string;
  units: "lb" | "kg";
  roundingIncrement: number;
  trainingMaxes: Record<LiftId, number>;
  tmBumpUpper: number;
  tmBumpLower: number;
}

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
  assistanceNotes: string;
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
