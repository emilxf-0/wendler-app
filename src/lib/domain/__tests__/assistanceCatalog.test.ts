import { describe, expect, it } from "vitest";
import {
  ASSISTANCE_EXERCISES,
  createCustomAssistanceExercise,
  expandTemplateToLines,
  resolveAssistanceExercise,
  sanitizeAssistanceTemplate,
  sanitizeCustomAssistanceExercises,
  templateSetCount,
} from "@/lib/domain/assistanceCatalog";

describe("assistanceCatalog", () => {
  it("has unique exercise ids", () => {
    const ids = ASSISTANCE_EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("sanitizeAssistanceTemplate keeps valid template entries", () => {
    const pushId = ASSISTANCE_EXERCISES.find((e) => e.category === "push")!.id;
    const pullId = ASSISTANCE_EXERCISES.find((e) => e.category === "pull")!.id;
    expect(
      sanitizeAssistanceTemplate({
        push: [{ exerciseId: pushId, sets: 5, reps: 10 }],
        pull: [{ exerciseId: pullId, sets: 3, reps: 8, weightKg: null }],
        single_leg: "not_an_id",
        core: [],
      }),
    ).toEqual({
      push: [{ exerciseId: pushId, sets: 5, reps: 10 }],
      pull: [{ exerciseId: pullId, sets: 3, reps: 8, weightKg: null }],
    });
  });

  it("sanitizeAssistanceTemplate migrates legacy single-exercise ids", () => {
    const pushId = ASSISTANCE_EXERCISES.find((e) => e.category === "push")!.id;
    expect(sanitizeAssistanceTemplate({ push: pushId })).toEqual({
      push: [{ exerciseId: pushId, sets: 1, reps: 10 }],
    });
  });

  it("sanitizeAssistanceTemplate drops cross-bucket mismatches", () => {
    const pullId = ASSISTANCE_EXERCISES.find((e) => e.category === "pull")!.id;
    expect(sanitizeAssistanceTemplate({ push: pullId })).toEqual({});
  });

  it("sanitizeAssistanceTemplate keeps custom exercise ids", () => {
    const custom = [
      createCustomAssistanceExercise("Landmine row variant", "pull"),
    ];
    expect(
      sanitizeAssistanceTemplate(
        { pull: [{ exerciseId: custom[0]!.id, sets: 3, reps: 12 }] },
        custom,
      ),
    ).toEqual({
      pull: [{ exerciseId: custom[0]!.id, sets: 3, reps: 12 }],
    });
  });

  it("expandTemplateToLines expands sets into individual rows", () => {
    const pushIds = ASSISTANCE_EXERCISES.filter((e) => e.category === "push");
    const pushId = pushIds[0]!.id;
    const pushId2 = pushIds[1]!.id;
    const template = sanitizeAssistanceTemplate({
      push: [
        { exerciseId: pushId, sets: 2, reps: 10 },
        { exerciseId: pushId2, sets: 1, reps: 5, weightKg: 20 },
      ],
    });
    expect(templateSetCount(template)).toBe(3);
    expect(expandTemplateToLines(template)).toEqual([
      { exerciseId: pushId, reps: 10, weightKg: null },
      { exerciseId: pushId, reps: 10, weightKg: null },
      { exerciseId: pushId2, reps: 5, weightKg: 20 },
    ]);
  });

  it("resolveAssistanceExercise matches catalog by name", () => {
    const pushup = ASSISTANCE_EXERCISES.find((e) => e.id === "push_pushups")!;
    const result = resolveAssistanceExercise("Push-ups", "push", []);
    expect(result).toEqual({
      kind: "existing",
      exerciseId: pushup.id,
    });
  });

  it("resolveAssistanceExercise creates custom exercise for unknown name by default", () => {
    const result = resolveAssistanceExercise("My special curl", "pull", []);
    expect(result.kind).toBe("created");
    if (result.kind === "created") {
      expect(result.exercise.name).toBe("My special curl");
      expect(result.exercise.category).toBe("pull");
      expect(result.exerciseId).toMatch(/^custom_/);
    }
  });

  it("resolveAssistanceExercise returns invalid for unknown name when createIfMissing is false", () => {
    expect(
      resolveAssistanceExercise("My special curl", "pull", [], {
        createIfMissing: false,
      }),
    ).toEqual({ kind: "invalid" });
  });

  it("sanitizeCustomAssistanceExercises drops invalid rows and dedupes names", () => {
    const valid = createCustomAssistanceExercise("Extra row", "pull");
    expect(
      sanitizeCustomAssistanceExercises([
        valid,
        { id: "custom_dup", name: "Extra row", category: "pull" },
        { id: "not_custom", name: "Bad", category: "pull" },
        { id: "custom_x", name: "", category: "pull" },
      ]),
    ).toEqual([valid]);
  });
});
