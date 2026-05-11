import Dexie from "dexie";
import { describe, expect, it, beforeEach } from "vitest";
import { parseFullBackup, stringifyFullBackup } from "@/lib/db/backup";
import {
  addSession,
  loadProgram,
  loadSettings,
  replaceFromFullBackup,
  saveProgram,
  saveSettings,
  listAllSessions,
} from "@/lib/db";
import { defaultActiveProgram, defaultSettings } from "@/lib/domain/programFlow";
import { SETTINGS_ID } from "@/lib/db/ids";

describe("Full backup JSON", () => {
  beforeEach(async () => {
    const { resetDbSingletonForTests } = await import("@/lib/db/schema");
    resetDbSingletonForTests();
    await Dexie.delete("wendler531db");
    resetDbSingletonForTests();
  });

  it("roundtrips parse → replace → export", async () => {
    const defs = defaultActiveProgram({ workoutIndexInMicroWeek: 1 });
    await saveProgram({
      id: "default",
      leaderTemplateId: defs.leaderTemplateId,
      anchorTemplateId: defs.anchorTemplateId,
      frequency: defs.frequency,
      leaderCyclesTarget: defs.leaderCyclesTarget,
      anchorCyclesTarget: defs.anchorCyclesTarget,
      phase: defs.phase,
      microWeek: defs.microWeek,
      workoutIndexInMicroWeek: defs.workoutIndexInMicroWeek,
      leaderCyclesCompleted: defs.leaderCyclesCompleted,
      anchorCyclesCompleted: defs.anchorCyclesCompleted,
      pendingTmBump: defs.pendingTmBump,
      pendingTmRestartToLeader: defs.pendingTmRestartToLeader,
    });

    await saveSettings({
      id: SETTINGS_ID,
      ...defaultSettings(),
      lastBackupAt: 123,
    });

    await addSession({
      createdAt: 1_720_000_000_000,
      lift: "squat",
      phase: "leader",
      microWeek: 2,
      workoutIndexInMicroWeek: 0,
      leaderTemplateId: "bbb",
      anchorTemplateId: "original_anchor",
      mainSets: [
        {
          label: "65×5",
          prescribedWeight: 100,
          repsTarget: 5,
          completed: true,
        },
      ],
      supplemental: [],
      assistanceNotes: "notes here",
    });

    const loadedSettings = await loadSettings();
    const loadedProgram = await loadProgram();
    const loadedSessions = await listAllSessions();
    expect(loadedSessions).toHaveLength(1);

    const json = stringifyFullBackup({
      settings: loadedSettings,
      program: loadedProgram,
      sessions: loadedSessions,
    });

    const parsedInner = parseFullBackup(json);
    expect(parsedInner.sessions).toHaveLength(1);

    await Dexie.delete("wendler531db");
    const { resetDbSingletonForTests } = await import("@/lib/db/schema");
    resetDbSingletonForTests();

    const restored = await replaceFromFullBackup(json);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;

    expect(restored.sessionCount).toBe(1);

    const afterSessions = await listAllSessions();
    expect(afterSessions).toHaveLength(1);
    expect(afterSessions[0]?.lift).toBe("squat");
    expect(afterSessions[0]?.assistanceNotes).toBe("notes here");

    const afterProgram = await loadProgram();
    expect(afterProgram.workoutIndexInMicroWeek).toBe(1);

    const afterSettings = await loadSettings();
    expect(afterSettings.lastBackupAt).toBe(123);
    expect(afterSettings.roundingIncrement).toBeCloseTo(defaultSettings().roundingIncrement);
  });
});
