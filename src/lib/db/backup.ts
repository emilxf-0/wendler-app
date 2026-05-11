import type { LiftId, MicroWeek, Phase } from "@/lib/domain/types";
import { LIFTS, SESSIONS_PER_MICRO_WEEK } from "@/lib/domain/types";
import { clampWorkoutIndexInMicroWeek } from "@/lib/domain/programBackfill";
import { normalizeBbbLeaderMainTopSet } from "@/lib/domain/programFlow";
import { PROGRAM_ID } from "./ids";
import { normalizeStoredSettings } from "./settingsRow";
import type {
  AssistanceEntryStored,
  ProgramRow,
  SessionRow,
  SetLogRow,
  SettingsRow,
  StoredSettingsShape,
  SupplementalLogRow,
} from "./schema";

export const WENDLER_FULL_BACKUP_KIND = "wendler531/full" as const;
export const WENDLER_FULL_BACKUP_SCHEMA_VERSION = 1;

/** Upper bound for import size (~6 sessions/wk × 52 × 80 yr with headroom). */
export const BACKUP_IMPORT_SESSION_LIMIT = 25_000;

const PHASES: readonly Phase[] = ["leader", "deload", "anchor"];
const MICRO_WEEKS: readonly MicroWeek[] = [1, 2, 3];

function isLiftId(v: unknown): v is LiftId {
  return typeof v === "string" && (LIFTS as readonly string[]).includes(v);
}

function isPhase(v: unknown): v is Phase {
  return typeof v === "string" && (PHASES as readonly string[]).includes(v);
}

function isMicroWeek(v: unknown): v is MicroWeek {
  return typeof v === "number" && (MICRO_WEEKS as readonly number[]).includes(v);
}

function parseMainSets(raw: unknown): SetLogRow[] {
  if (!Array.isArray(raw)) throw new Error("Invalid backup: mainSets.");
  const out: SetLogRow[] = [];
  let i = 0;
  for (const row of raw) {
    i += 1;
    if (!row || typeof row !== "object") {
      throw new Error(`Invalid backup: mainSets[${i - 1}].`);
    }
    const o = row as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label : "";
    const prescribedWeight =
      typeof o.prescribedWeight === "number" && Number.isFinite(o.prescribedWeight)
        ? o.prescribedWeight
        : 0;
    let repsTarget: number | string = 5;
    if (o.repsTarget === "amrap") repsTarget = "amrap";
    else if (typeof o.repsTarget === "number" && Number.isFinite(o.repsTarget)) {
      repsTarget = o.repsTarget;
    }
    const entry: SetLogRow = {
      label,
      prescribedWeight,
      repsTarget,
      completed: Boolean(o.completed),
    };
    if (typeof o.actualWeight === "number" && Number.isFinite(o.actualWeight)) {
      entry.actualWeight = o.actualWeight;
    }
    if (typeof o.actualReps === "number" && Number.isFinite(o.actualReps)) {
      entry.actualReps = o.actualReps;
    }
    out.push(entry);
  }
  return out;
}

function parseSupplementalLogs(raw: unknown): SupplementalLogRow[] {
  if (!Array.isArray(raw)) throw new Error("Invalid backup: supplemental.");
  const out: SupplementalLogRow[] = [];
  let i = 0;
  for (const row of raw) {
    i += 1;
    if (!row || typeof row !== "object") {
      throw new Error(`Invalid backup: supplemental[${i - 1}].`);
    }
    const o = row as Record<string, unknown>;
    const sets =
      typeof o.sets === "number" && Number.isFinite(o.sets)
        ? Math.max(0, Math.floor(o.sets))
        : 0;
    const reps =
      typeof o.reps === "number" && Number.isFinite(o.reps)
        ? Math.max(0, Math.floor(o.reps))
        : 0;
    const prescribedWeight =
      typeof o.prescribedWeight === "number" && Number.isFinite(o.prescribedWeight)
        ? o.prescribedWeight
        : 0;
    const label = typeof o.label === "string" ? o.label : "";
    const completedRaw = Array.isArray(o.completedSets) ? o.completedSets : [];
    const completedSets = completedRaw.map((x) => Boolean(x));
    while (completedSets.length < sets) completedSets.push(false);
    completedSets.length = sets;
    out.push({ label, sets, reps, prescribedWeight, completedSets });
  }
  return out;
}

function parseAssistanceEntries(raw: unknown): AssistanceEntryStored[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) throw new Error("Invalid backup: assistanceEntries.");
  const out: AssistanceEntryStored[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const exerciseId = o.exerciseId;
    if (typeof exerciseId !== "string") continue;
    if (Object.prototype.hasOwnProperty.call(o, "weightKg")) {
      const reps =
        typeof o.reps === "number" && Number.isFinite(o.reps)
          ? Math.max(0, Math.floor(o.reps))
          : 0;
      const weightKg =
        o.weightKg === null
          ? null
          : typeof o.weightKg === "number" && Number.isFinite(o.weightKg)
            ? o.weightKg
            : null;
      out.push({ exerciseId, reps, weightKg });
    } else if (
      typeof o.sets === "number" &&
      Number.isFinite(o.sets) &&
      typeof o.reps === "number" &&
      Number.isFinite(o.reps)
    ) {
      out.push({
        exerciseId,
        sets: Math.max(0, Math.floor(o.sets)),
        reps: Math.max(0, Math.floor(o.reps)),
      });
    }
  }
  return out.length ? out : undefined;
}

function parseProgramRecord(record: Record<string, unknown>): ProgramRow {
  const leaderTemplateId = record.leaderTemplateId;
  const anchorTemplateId = record.anchorTemplateId;
  if (typeof leaderTemplateId !== "string" || leaderTemplateId.length === 0) {
    throw new Error("Invalid backup: program.leaderTemplateId.");
  }
  if (typeof anchorTemplateId !== "string" || anchorTemplateId.length === 0) {
    throw new Error("Invalid backup: program.anchorTemplateId.");
  }
  const frequency = record.frequency;
  if (frequency !== 3 && frequency !== 4) {
    throw new Error("Invalid backup: program.frequency.");
  }
  const phase = record.phase;
  if (!isPhase(phase)) throw new Error("Invalid backup: program.phase.");
  const microWeekRaw = record.microWeek;
  if (!isMicroWeek(microWeekRaw)) throw new Error("Invalid backup: program.microWeek.");

  const workoutIndexInMicroWeek = record.workoutIndexInMicroWeek;
  const leaderCyclesCompleted = record.leaderCyclesCompleted;
  const anchorCyclesCompleted = record.anchorCyclesCompleted;
  if (typeof workoutIndexInMicroWeek !== "number" || !Number.isFinite(workoutIndexInMicroWeek)) {
    throw new Error("Invalid backup: program.workoutIndexInMicroWeek.");
  }
  if (typeof leaderCyclesCompleted !== "number" || !Number.isFinite(leaderCyclesCompleted)) {
    throw new Error("Invalid backup: program.leaderCyclesCompleted.");
  }
  if (typeof anchorCyclesCompleted !== "number" || !Number.isFinite(anchorCyclesCompleted)) {
    throw new Error("Invalid backup: program.anchorCyclesCompleted.");
  }
  const leaderCyclesTarget =
    typeof record.leaderCyclesTarget === "number" &&
    Number.isFinite(record.leaderCyclesTarget)
      ? record.leaderCyclesTarget
      : 2;
  const anchorCyclesTarget =
    typeof record.anchorCyclesTarget === "number" &&
    Number.isFinite(record.anchorCyclesTarget)
      ? record.anchorCyclesTarget
      : 2;

  return {
    id: PROGRAM_ID,
    leaderTemplateId,
    anchorTemplateId,
    frequency: SESSIONS_PER_MICRO_WEEK,
    leaderCyclesTarget,
    anchorCyclesTarget,
    phase,
    microWeek: microWeekRaw,
    workoutIndexInMicroWeek: clampWorkoutIndexInMicroWeek(workoutIndexInMicroWeek),
    leaderCyclesCompleted,
    anchorCyclesCompleted,
    pendingTmBump: Boolean(record.pendingTmBump),
    pendingTmRestartToLeader: Boolean(record.pendingTmRestartToLeader),
    bbbLeaderMainTopSet: normalizeBbbLeaderMainTopSet(record.bbbLeaderMainTopSet),
  };
}

function parseSessionRecord(rec: Record<string, unknown>): Omit<SessionRow, "id"> {
  const lift = rec.lift;
  if (!isLiftId(lift)) throw new Error("Invalid backup: session.lift.");
  const phase = rec.phase;
  if (!isPhase(phase)) throw new Error("Invalid backup: session.phase.");
  const createdAt = rec.createdAt;
  if (typeof createdAt !== "number" || !Number.isFinite(createdAt)) {
    throw new Error("Invalid backup: session.createdAt.");
  }
  const mw = rec.microWeek;
  if (typeof mw !== "number" || mw < 1 || mw > 3 || !Number.isInteger(mw)) {
    throw new Error("Invalid backup: session.microWeek.");
  }
  const wIx = rec.workoutIndexInMicroWeek;
  if (typeof wIx !== "number" || !Number.isFinite(wIx)) {
    throw new Error("Invalid backup: session.workoutIndexInMicroWeek.");
  }

  const mainSets = parseMainSets(rec.mainSets);
  const supplemental = parseSupplementalLogs(rec.supplemental);
  const assistanceNotes =
    typeof rec.assistanceNotes === "string" ? rec.assistanceNotes : "";
  const assistanceEntries =
    rec.assistanceEntries === undefined
      ? undefined
      : parseAssistanceEntries(rec.assistanceEntries);

  return {
    createdAt,
    lift,
    phase,
    microWeek: mw,
    workoutIndexInMicroWeek: wIx,
    leaderTemplateId: String(rec.leaderTemplateId ?? ""),
    anchorTemplateId: String(rec.anchorTemplateId ?? ""),
    mainSets,
    supplemental,
    assistanceNotes,
    ...(assistanceEntries ? { assistanceEntries } : {}),
  };
}

export interface ParsedFullBackup {
  settings: SettingsRow;
  program: ProgramRow;
  sessions: Omit<SessionRow, "id">[];
}

export function stringifyFullBackup(params: {
  settings: SettingsRow;
  program: ProgramRow;
  sessions: SessionRow[];
}): string {
  const exportedAt = new Date().toISOString();
  const sessionsOut = params.sessions.map((s) => {
    const copy: Omit<SessionRow, "id"> & { id?: number } = { ...s };
    delete copy.id;
    return copy;
  });
  const doc = {
    kind: WENDLER_FULL_BACKUP_KIND,
    schemaVersion: WENDLER_FULL_BACKUP_SCHEMA_VERSION,
    exportedAt,
    settings: params.settings,
    program: params.program,
    sessions: sessionsOut,
  };
  return JSON.stringify(doc, null, 2);
}

export function parseFullBackup(jsonText: string): ParsedFullBackup {
  let root: unknown;
  try {
    root = JSON.parse(jsonText);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (!root || typeof root !== "object") {
    throw new Error("Invalid backup file.");
  }
  const doc = root as Record<string, unknown>;

  if (doc.kind !== WENDLER_FULL_BACKUP_KIND) {
    throw new Error(
      doc.kind === undefined || doc.kind === null
        ? "Unrecognized backup (missing format tag)."
        : "Unrecognized backup format.",
    );
  }
  if (doc.schemaVersion !== WENDLER_FULL_BACKUP_SCHEMA_VERSION) {
    throw new Error("Unsupported backup version — export a new backup from this app.");
  }

  if (!doc.settings || typeof doc.settings !== "object") {
    throw new Error("Invalid backup: missing settings.");
  }
  const settings = normalizeStoredSettings(doc.settings as StoredSettingsShape);

  if (!doc.program || typeof doc.program !== "object") {
    throw new Error("Invalid backup: missing program.");
  }
  const program = parseProgramRecord(doc.program as Record<string, unknown>);

  const rawSessions = doc.sessions;
  if (!Array.isArray(rawSessions)) {
    throw new Error("Invalid backup: missing sessions list.");
  }
  if (rawSessions.length > BACKUP_IMPORT_SESSION_LIMIT) {
    throw new Error(`Backup exceeds ${BACKUP_IMPORT_SESSION_LIMIT} sessions.`);
  }

  const sessions: Omit<SessionRow, "id">[] = [];
  let ix = 0;
  for (const s of rawSessions) {
    ix += 1;
    if (!s || typeof s !== "object") {
      throw new Error(`Invalid backup: sessions[${ix - 1}].`);
    }
    sessions.push(parseSessionRecord(s as Record<string, unknown>));
  }

  return { settings, program, sessions };
}
