import { describe, expect, it } from "vitest";
import {
  ASSISTANCE_EXERCISES,
  sanitizeAssistancePresets,
} from "@/lib/domain/assistanceCatalog";

describe("assistanceCatalog", () => {
  it("has unique exercise ids", () => {
    const ids = ASSISTANCE_EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("sanitizeAssistancePresets keeps valid ids in correct buckets", () => {
    const pushId = ASSISTANCE_EXERCISES.find((e) => e.category === "push")!.id;
    const pullId = ASSISTANCE_EXERCISES.find((e) => e.category === "pull")!.id;
    expect(
      sanitizeAssistancePresets({
        push: pushId,
        pull: pullId,
        single_leg: "not_an_id",
        core: "",
      }),
    ).toEqual({ push: pushId, pull: pullId });
  });

  it("sanitizeAssistancePresets drops cross-bucket mismatches", () => {
    const pullId = ASSISTANCE_EXERCISES.find((e) => e.category === "pull")!.id;
    expect(sanitizeAssistancePresets({ push: pullId })).toEqual({});
  });
});
