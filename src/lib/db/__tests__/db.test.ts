import Dexie from "dexie";
import { describe, expect, it, beforeEach } from "vitest";
import {
  addSession,
  loadProgram,
  saveProgram,
} from "@/lib/db";
import { defaultActiveProgram } from "@/lib/domain/programFlow";
import { resetDbSingletonForTests } from "@/lib/db/schema";

describe("IndexedDB persistence", () => {
  beforeEach(async () => {
    resetDbSingletonForTests();
    await Dexie.delete("wendler531db");
    resetDbSingletonForTests();
  });

  it("persists program defaults across reload", async () => {
    const fresh = defaultActiveProgram({ workoutIndexInMicroWeek: 2 });
    await saveProgram({
      id: "default",
      leaderTemplateId: fresh.leaderTemplateId,
      anchorTemplateId: fresh.anchorTemplateId,
      frequency: fresh.frequency,
      leaderCyclesTarget: fresh.leaderCyclesTarget,
      anchorCyclesTarget: fresh.anchorCyclesTarget,
      phase: fresh.phase,
      microWeek: fresh.microWeek,
      workoutIndexInMicroWeek: fresh.workoutIndexInMicroWeek,
      leaderCyclesCompleted: fresh.leaderCyclesCompleted,
      anchorCyclesCompleted: fresh.anchorCyclesCompleted,
      pendingTmBump: fresh.pendingTmBump,
    });

    const loaded = await loadProgram();
    expect(loaded.workoutIndexInMicroWeek).toBe(2);
  });

  it("stores workout sessions", async () => {
    const id = await addSession({
      createdAt: Date.now(),
      lift: "squat",
      phase: "leader",
      microWeek: 1,
      workoutIndexInMicroWeek: 0,
      leaderTemplateId: "bbb",
      anchorTemplateId: "original_anchor",
      mainSets: [],
      supplemental: [],
      assistanceNotes: "rows + dips",
    });

    expect(typeof id).toBe("number");

    resetDbSingletonForTests();
    const { getDb } = await import("@/lib/db/schema");
    const stored = await getDb()!.sessions.get(id as number);
    expect(stored?.assistanceNotes).toBe("rows + dips");
  });
});
