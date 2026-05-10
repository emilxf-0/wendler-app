import {
  defaultActiveProgram,
  defaultSettings,
} from "@/lib/domain/programFlow";
import type { ActiveProgramSnapshot } from "@/lib/domain/types";
import { getDb, type ProgramRow, type SessionRow, type SettingsRow } from "./schema";

const SETTINGS_ID = "default";
const PROGRAM_ID = "default";

export async function loadSettings(): Promise<SettingsRow> {
  const db = getDb();
  if (!db) return { id: SETTINGS_ID, ...defaultSettings() };
  const row = await db.settings.get(SETTINGS_ID);
  if (row) return row;
  const fresh = { id: SETTINGS_ID, ...defaultSettings() };
  await db.settings.put(fresh);
  return fresh;
}

export async function saveSettings(row: SettingsRow): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db.settings.put(row);
}

export async function loadProgram(): Promise<ProgramRow> {
  const db = getDb();
  if (!db)
    return { id: PROGRAM_ID, ...defaultActiveProgram() } as ProgramRow;
  const row = await db.program.get(PROGRAM_ID);
  if (row) return row;
  const fresh = { id: PROGRAM_ID, ...defaultActiveProgram() } as ProgramRow;
  await db.program.put(fresh);
  return fresh;
}

export async function saveProgram(row: ProgramRow): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db.program.put(row);
}

export async function saveProgramSnapshot(
  snapshot: ActiveProgramSnapshot,
): Promise<void> {
  await saveProgram({ id: PROGRAM_ID, ...snapshot });
}

export async function addSession(session: Omit<SessionRow, "id">) {
  const db = getDb();
  if (!db) return undefined;
  return db.sessions.add(session as SessionRow);
}

export async function listSessions(limit = 50): Promise<SessionRow[]> {
  const db = getDb();
  if (!db) return [];
  return db.sessions.orderBy("createdAt").reverse().limit(limit).toArray();
}
