import {
  defaultActiveProgram,
  defaultSettings,
  normalizeBbbLeaderMainTopSet,
} from "@/lib/domain/programFlow";
import type { ActiveProgramSnapshot } from "@/lib/domain/types";
import { parseFullBackup, stringifyFullBackup } from "./backup";
import { PROGRAM_ID, SETTINGS_ID } from "./ids";
import { normalizeStoredSettings, storedSettingsPut } from "./settingsRow";
import {
  getDb,
  type ProgramRow,
  type SessionRow,
  type SettingsRow,
  type StoredSettingsShape,
} from "./schema";

export { PROGRAM_ID, SETTINGS_ID } from "./ids";

export async function loadSettings(): Promise<SettingsRow> {
  const db = getDb();
  if (!db) return { id: SETTINGS_ID, ...defaultSettings() };
  const row = await db.settings.get(SETTINGS_ID);
  if (row) return normalizeStoredSettings(row as StoredSettingsShape);
  const fresh: SettingsRow = { id: SETTINGS_ID, ...defaultSettings() };
  await db.settings.put(storedSettingsPut(fresh));
  return fresh;
}

export async function saveSettings(row: SettingsRow): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  await db.settings.put(storedSettingsPut(row));
  return true;
}

/** Writes settings + program atomically — keeps TM bumps in sync with clearing the TM hold. */
export async function persistSettingsAndProgram(
  settings: SettingsRow,
  program: ProgramRow,
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await db.transaction("rw", db.settings, db.program, async () => {
      await db.settings.put(storedSettingsPut(settings));
      await db.program.put(program);
    });
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

export async function loadProgram(): Promise<ProgramRow> {
  const db = getDb();
  if (!db)
    return { id: PROGRAM_ID, ...defaultActiveProgram() } as ProgramRow;
  const row = await db.program.get(PROGRAM_ID);
  if (row)
    return {
      ...row,
      pendingTmRestartToLeader: row.pendingTmRestartToLeader ?? false,
      bbbLeaderMainTopSet: normalizeBbbLeaderMainTopSet(row.bbbLeaderMainTopSet),
    } as ProgramRow;
  const fresh = { id: PROGRAM_ID, ...defaultActiveProgram() } as ProgramRow;
  await db.program.put(fresh);
  return fresh;
}

export async function saveProgram(row: ProgramRow): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  await db.program.put(row);
  return true;
}

export async function saveProgramSnapshot(
  snapshot: ActiveProgramSnapshot,
): Promise<boolean> {
  return saveProgram({ id: PROGRAM_ID, ...snapshot });
}

export async function addSession(session: Omit<SessionRow, "id">) {
  const db = getDb();
  if (!db) return undefined;
  return db.sessions.add(session as SessionRow);
}

/** Append many sessions and update program in one transaction. */
export async function bulkAddSessionsAndSaveProgram(
  sessions: Omit<SessionRow, "id">[],
  program: ProgramRow,
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await db.transaction("rw", db.sessions, db.program, async () => {
      if (sessions.length) {
        await db.sessions.bulkAdd(sessions as SessionRow[]);
      }
      await db.program.put(program);
    });
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

export async function listSessions(limit = 50): Promise<SessionRow[]> {
  const db = getDb();
  if (!db) return [];
  return db.sessions.orderBy("createdAt").reverse().limit(limit).toArray();
}

/** Full history (newest first), for export and decade-scale lists. */
export async function listAllSessions(): Promise<SessionRow[]> {
  const db = getDb();
  if (!db) return [];
  return db.sessions.orderBy("createdAt").reverse().toArray();
}

export async function deleteSession(id: number): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await db.sessions.delete(id);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

/** Removes every logged session. Settings and program are unchanged. */
export async function clearAllSessions(): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await db.sessions.clear();
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

export async function recordBackupExportSuccess(): Promise<boolean> {
  const s = await loadSettings();
  return saveSettings({ ...s, lastBackupAt: Date.now() });
}

export async function serializeFullBackupForDownload(): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  const [settings, program, sessions] = await Promise.all([
    loadSettings(),
    loadProgram(),
    listAllSessions(),
  ]);
  return stringifyFullBackup({ settings, program, sessions });
}

export async function replaceFromFullBackup(jsonText: string): Promise<
  { ok: true; sessionCount: number } | { ok: false; error: string }
> {
  let data;
  try {
    data = parseFullBackup(jsonText);
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "Could not read this backup file.",
    };
  }

  const db = getDb();
  if (!db) {
    return { ok: false, error: "Storage is unavailable in this environment." };
  }

  try {
    await db.transaction("rw", db.sessions, db.program, db.settings, async () => {
      await db.sessions.clear();
      if (data.sessions.length) {
        await db.sessions.bulkAdd(data.sessions as SessionRow[]);
      }
      await db.program.put(data.program);
      await db.settings.put(storedSettingsPut(data.settings));
    });
    return { ok: true, sessionCount: data.sessions.length };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      error: "Import failed — your existing data was not changed.",
    };
  }
}
