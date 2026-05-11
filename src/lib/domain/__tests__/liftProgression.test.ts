import { describe, expect, it } from "vitest";
import type { SessionRow } from "@/lib/db/schema";
import {
  peakCompletedMainKg,
  progressionSeriesForLift,
} from "@/lib/domain/liftProgression";

function session(partial: Partial<SessionRow> & Pick<SessionRow, "createdAt" | "lift">): SessionRow {
  return {
    phase: "leader",
    microWeek: 1,
    workoutIndexInMicroWeek: 0,
    leaderTemplateId: "l",
    anchorTemplateId: "a",
    mainSets: [],
    supplemental: [],
    assistanceNotes: "",
    ...partial,
  };
}

describe("peakCompletedMainKg", () => {
  it("returns max weight among completed main sets", () => {
    const p = peakCompletedMainKg(
      session({
        createdAt: 1,
        lift: "squat",
        mainSets: [
          { label: "a", prescribedWeight: 100, repsTarget: 5, completed: true },
          { label: "b", prescribedWeight: 120, repsTarget: 5, completed: true },
          { label: "c", prescribedWeight: 140, repsTarget: "amrap", completed: false },
        ],
      }),
    );
    expect(p).toBe(120);
  });

  it("prefers actualWeight when present", () => {
    const p = peakCompletedMainKg(
      session({
        createdAt: 1,
        lift: "bench",
        mainSets: [
          {
            label: "top",
            prescribedWeight: 80,
            repsTarget: "amrap",
            completed: true,
            actualWeight: 85,
          },
        ],
      }),
    );
    expect(p).toBe(85);
  });

  it("returns null when nothing completed", () => {
    expect(
      peakCompletedMainKg(
        session({
          createdAt: 1,
          lift: "press",
          mainSets: [
            { label: "a", prescribedWeight: 50, repsTarget: 5, completed: false },
          ],
        }),
      ),
    ).toBeNull();
  });
});

describe("progressionSeriesForLift", () => {
  it("filters by lift and sorts by time", () => {
    const s: SessionRow[] = [
      session({
        id: 2,
        createdAt: 200,
        lift: "squat",
        mainSets: [
          { label: "x", prescribedWeight: 110, repsTarget: 5, completed: true },
        ],
      }),
      session({
        id: 1,
        createdAt: 100,
        lift: "squat",
        mainSets: [
          { label: "x", prescribedWeight: 100, repsTarget: 5, completed: true },
        ],
      }),
      session({
        id: 3,
        createdAt: 150,
        lift: "bench",
        mainSets: [
          { label: "x", prescribedWeight: 999, repsTarget: 5, completed: true },
        ],
      }),
    ];
    expect(progressionSeriesForLift(s, "squat")).toEqual([
      { at: 100, kg: 100 },
      { at: 200, kg: 110 },
    ]);
  });
});
