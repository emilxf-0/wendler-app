/**
 * Assistance movements grouped like Forever’s Push / Pull / Single-leg·Core buckets.
 * Names are generic gym labels (not copied text from the book).
 */

export type AssistanceCategory = "push" | "pull" | "single_leg" | "core";

export interface AssistanceTemplateEntry {
  exerciseId: string;
  sets: number;
  reps: number;
  /** Omit or null = bodyweight. */
  weightKg?: number | null;
}

/** Assistance templates per bucket (Setup → Today). */
export type AssistanceTemplateByCategory = Partial<
  Record<AssistanceCategory, AssistanceTemplateEntry[]>
>;

export interface AssistanceExercise {
  id: string;
  name: string;
  category: AssistanceCategory;
}

/** User-defined movements stored in Settings. */
export interface CustomAssistanceExercise {
  id: string;
  name: string;
  category: AssistanceCategory;
}

export type ResolveAssistanceResult =
  | { kind: "existing"; exerciseId: string }
  | { kind: "created"; exerciseId: string; exercise: CustomAssistanceExercise }
  | { kind: "invalid" };

export const CATEGORY_LABEL: Record<AssistanceCategory, string> = {
  push: "Push",
  pull: "Pull",
  single_leg: "Single-leg",
  core: "Core",
};

/** Category order in UI */
export const ASSISTANCE_CATEGORY_ORDER: AssistanceCategory[] = [
  "push",
  "pull",
  "single_leg",
  "core",
];

const RAW: AssistanceExercise[] = [
  /* Push */
  { id: "push_band_press", name: "Band chest press", category: "push" },
  { id: "push_db_bench", name: "Dumbbell bench press", category: "push" },
  { id: "push_db_floor", name: "Dumbbell floor press", category: "push" },
  { id: "push_db_incline", name: "Dumbbell incline bench", category: "push" },
  { id: "push_db_ohp", name: "Dumbbell overhead press", category: "push" },
  { id: "push_dips", name: "Dips", category: "push" },
  { id: "push_jm_press", name: "JM press", category: "push" },
  { id: "push_kb_bench", name: "Kettlebell bench / floor press", category: "push" },
  { id: "push_landmine_press", name: "Landmine press", category: "push" },
  { id: "push_machine_chest", name: "Machine chest press", category: "push" },
  { id: "push_oh_tricep_ext", name: "Overhead triceps extension", category: "push" },
  { id: "push_pushups", name: "Push-ups", category: "push" },
  { id: "push_skull_crusher", name: "Skull crushers (lying extension)", category: "push" },
  { id: "push_tricep_pushdown", name: "Triceps pushdown", category: "push" },

  /* Pull */
  { id: "pull_band_curl", name: "Band curls", category: "pull" },
  { id: "pull_band_pull_apart", name: "Band pull-aparts", category: "pull" },
  { id: "pull_barbell_curl", name: "Barbell curl", category: "pull" },
  { id: "pull_barbell_row", name: "Barbell row", category: "pull" },
  { id: "pull_cable_row", name: "Cable seated row", category: "pull" },
  { id: "pull_chest_supported_row", name: "Chest-supported row", category: "pull" },
  { id: "pull_chinup", name: "Chin-up", category: "pull" },
  { id: "pull_db_row", name: "One-arm dumbbell row", category: "pull" },
  { id: "pull_face_pull", name: "Face pull", category: "pull" },
  { id: "pull_fat_man_row", name: "Inverted row (Fat Man row)", category: "pull" },
  { id: "pull_hammer_curl", name: "Hammer curl", category: "pull" },
  { id: "pull_lat_pulldown", name: "Lat pulldown", category: "pull" },
  { id: "pull_neutral_pullup", name: "Neutral-grip pull-up", category: "pull" },
  { id: "pull_pendlay_row", name: "Pendlay row", category: "pull" },
  { id: "pull_pullup", name: "Pull-up", category: "pull" },
  { id: "pull_rear_delt", name: "Rear delt fly (DB or cable)", category: "pull" },
  { id: "pull_reverse_curl", name: "Reverse curl", category: "pull" },

  /* Single-leg */
  { id: "sl_box_stepup", name: "Box step-up", category: "single_leg" },
  { id: "sl_bulgarian_split_squat", name: "Bulgarian split squat", category: "single_leg" },
  { id: "sl_cossack_squat", name: "Cossack squat", category: "single_leg" },
  { id: "sl_kb_single_rdl", name: "Kettlebell single-leg RDL", category: "single_leg" },
  { id: "sl_lateral_lunge", name: "Lateral lunge", category: "single_leg" },
  { id: "sl_lunge_walking", name: "Walking lunge", category: "single_leg" },
  { id: "sl_lunge_reverse", name: "Reverse lunge", category: "single_leg" },
  { id: "sl_single_leg_press", name: "Single-leg press (machine)", category: "single_leg" },
  { id: "sl_split_squat", name: "Split squat", category: "single_leg" },

  /* Core */
  { id: "core_ab_wheel", name: "Ab wheel rollout", category: "core" },
  { id: "core_back_extension", name: "Back extension / hyperextension", category: "core" },
  { id: "core_cable_crunch", name: "Cable crunch", category: "core" },
  { id: "core_dead_bug", name: "Dead bug", category: "core" },
  { id: "core_decline_situp", name: "Decline sit-up", category: "core" },
  { id: "core_hanging_knee", name: "Hanging knee raise", category: "core" },
  { id: "core_hanging_leg_raise", name: "Hanging leg raise", category: "core" },
  { id: "core_lower_back_raise", name: "Lower-back raises / back raises", category: "core" },
  { id: "core_pallof_press", name: "Pallof press", category: "core" },
  { id: "core_plank", name: "Plank", category: "core" },
  { id: "core_reverse_hyper", name: "Reverse hyperextension", category: "core" },
  { id: "core_side_plank", name: "Side plank", category: "core" },
];

function sortByName(a: AssistanceExercise, b: AssistanceExercise) {
  return a.name.localeCompare(b.name);
}

export const ASSISTANCE_EXERCISES: AssistanceExercise[] = [...RAW].sort(
  sortByName,
);

const byCategory = new Map<AssistanceCategory, AssistanceExercise[]>();
for (const c of ASSISTANCE_CATEGORY_ORDER) {
  byCategory.set(c, []);
}
for (const ex of RAW) {
  byCategory.get(ex.category)!.push(ex);
}
for (const c of ASSISTANCE_CATEGORY_ORDER) {
  byCategory.get(c)!.sort(sortByName);
}

export const ASSISTANCE_BY_CATEGORY: Record<
  AssistanceCategory,
  readonly AssistanceExercise[]
> = {
  push: byCategory.get("push")!,
  pull: byCategory.get("pull")!,
  single_leg: byCategory.get("single_leg")!,
  core: byCategory.get("core")!,
};

const byId = new Map(RAW.map((e) => [e.id, e]));

function customToAssistanceExercise(
  c: CustomAssistanceExercise,
): AssistanceExercise {
  return { id: c.id, name: c.name, category: c.category };
}

function slugifyExerciseName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40) || "exercise"
  );
}

export function createCustomAssistanceExercise(
  name: string,
  category: AssistanceCategory,
): CustomAssistanceExercise {
  const trimmed = name.trim();
  const suffix = Math.random().toString(36).slice(2, 6);
  return {
    id: `custom_${slugifyExerciseName(trimmed)}_${suffix}`,
    name: trimmed,
    category,
  };
}

export function exercisesForCategory(
  category: AssistanceCategory,
  custom: readonly CustomAssistanceExercise[] = [],
): AssistanceExercise[] {
  const customs = custom
    .filter((c) => c.category === category)
    .map(customToAssistanceExercise);
  return [...ASSISTANCE_BY_CATEGORY[category], ...customs].sort(sortByName);
}

export function allAssistanceExercises(
  custom: readonly CustomAssistanceExercise[] = [],
): AssistanceExercise[] {
  return [...ASSISTANCE_EXERCISES, ...custom.map(customToAssistanceExercise)].sort(
    sortByName,
  );
}

export function getAssistanceExercise(
  id: string,
  custom: readonly CustomAssistanceExercise[] = [],
): AssistanceExercise | undefined {
  const builtIn = byId.get(id);
  if (builtIn) return builtIn;
  const customEx = custom.find((c) => c.id === id);
  return customEx ? customToAssistanceExercise(customEx) : undefined;
}

export function assistanceDisplayName(
  id: string,
  custom: readonly CustomAssistanceExercise[] = [],
): string {
  return getAssistanceExercise(id, custom)?.name ?? id;
}

export function assistanceCategoryOf(
  id: string,
  custom: readonly CustomAssistanceExercise[] = [],
): AssistanceCategory | undefined {
  return getAssistanceExercise(id, custom)?.category;
}

export function findAssistanceExerciseByName(
  name: string,
  category: AssistanceCategory,
  custom: readonly CustomAssistanceExercise[] = [],
): AssistanceExercise | undefined {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  for (const ex of ASSISTANCE_BY_CATEGORY[category]) {
    if (ex.name.toLowerCase() === lower) return ex;
  }
  for (const c of custom) {
    if (c.category === category && c.name.toLowerCase() === lower) {
      return customToAssistanceExercise(c);
    }
  }
  return undefined;
}

export function resolveAssistanceExercise(
  input: string,
  category: AssistanceCategory,
  custom: readonly CustomAssistanceExercise[] = [],
  options?: { createIfMissing?: boolean },
): ResolveAssistanceResult {
  const trimmed = input.trim();
  if (!trimmed) return { kind: "invalid" };

  const byIdMatch = getAssistanceExercise(trimmed, custom);
  if (byIdMatch?.category === category) {
    return { kind: "existing", exerciseId: byIdMatch.id };
  }

  const byName = findAssistanceExerciseByName(trimmed, category, custom);
  if (byName) {
    return { kind: "existing", exerciseId: byName.id };
  }

  if (options?.createIfMissing === false) {
    return { kind: "invalid" };
  }

  const exercise = createCustomAssistanceExercise(trimmed, category);
  return { kind: "created", exerciseId: exercise.id, exercise };
}

export function sanitizeCustomAssistanceExercises(
  raw: unknown,
): CustomAssistanceExercise[] {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set<string>();
  const seenNamesByCategory = new Map<AssistanceCategory, Set<string>>();
  const out: CustomAssistanceExercise[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const name = typeof o.name === "string" ? o.name.trim() : "";
    const category = o.category;
    if (
      !id.startsWith("custom_") ||
      !name ||
      !ASSISTANCE_CATEGORY_ORDER.includes(category as AssistanceCategory)
    ) {
      continue;
    }
    if (seenIds.has(id)) continue;
    const cat = category as AssistanceCategory;
    const names = seenNamesByCategory.get(cat) ?? new Set<string>();
    if (names.has(name.toLowerCase())) continue;
    names.add(name.toLowerCase());
    seenNamesByCategory.set(cat, names);
    seenIds.add(id);
    out.push({ id, name, category: cat });
  }

  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function sanitizeTemplateEntry(
  raw: unknown,
  category: AssistanceCategory,
  custom: readonly CustomAssistanceExercise[] = [],
): AssistanceTemplateEntry | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const exerciseId = o.exerciseId;
  if (typeof exerciseId !== "string" || exerciseId === "") return undefined;
  const ex = getAssistanceExercise(exerciseId, custom);
  if (ex?.category !== category) return undefined;

  const setsN = o.sets;
  const repsN = o.reps;
  if (
    typeof setsN !== "number" ||
    !Number.isFinite(setsN) ||
    setsN < 1 ||
    setsN > 99
  ) {
    return undefined;
  }
  if (
    typeof repsN !== "number" ||
    !Number.isFinite(repsN) ||
    repsN < 1 ||
    repsN > 999
  ) {
    return undefined;
  }

  let weightKg: number | null | undefined;
  if ("weightKg" in o) {
    const w = o.weightKg;
    if (w === null || w === undefined) {
      weightKg = null;
    } else if (typeof w === "number" && Number.isFinite(w) && w >= 0) {
      weightKg = w;
    } else {
      return undefined;
    }
  }

  const entry: AssistanceTemplateEntry = {
    exerciseId,
    sets: Math.floor(setsN),
    reps: Math.floor(repsN),
  };
  if (weightKg !== undefined) entry.weightKg = weightKg;
  return entry;
}

function sanitizeCategoryTemplate(
  raw: unknown,
  category: AssistanceCategory,
  custom: readonly CustomAssistanceExercise[] = [],
): AssistanceTemplateEntry[] | undefined {
  if (typeof raw === "string" && raw !== "") {
    const ex = getAssistanceExercise(raw, custom);
    if (ex?.category !== category) return undefined;
    return [{ exerciseId: raw, sets: 1, reps: 10 }];
  }
  if (!Array.isArray(raw)) return undefined;
  const entries: AssistanceTemplateEntry[] = [];
  for (const item of raw) {
    const entry = sanitizeTemplateEntry(item, category, custom);
    if (entry) entries.push(entry);
  }
  return entries.length > 0 ? entries : undefined;
}

export function sanitizeAssistanceTemplate(
  raw: unknown,
  custom: readonly CustomAssistanceExercise[] = [],
): AssistanceTemplateByCategory {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: AssistanceTemplateByCategory = {};
  for (const cat of ASSISTANCE_CATEGORY_ORDER) {
    const entries = sanitizeCategoryTemplate(o[cat], cat, custom);
    if (entries) out[cat] = entries;
  }
  return out;
}

export function templateSetCount(
  template: AssistanceTemplateByCategory,
): number {
  let n = 0;
  for (const cat of ASSISTANCE_CATEGORY_ORDER) {
    for (const entry of template[cat] ?? []) {
      n += entry.sets;
    }
  }
  return n;
}

export function expandTemplateToLines(
  template: AssistanceTemplateByCategory,
): Array<{ exerciseId: string; reps: number; weightKg: number | null }> {
  const lines: Array<{
    exerciseId: string;
    reps: number;
    weightKg: number | null;
  }> = [];
  for (const cat of ASSISTANCE_CATEGORY_ORDER) {
    for (const entry of template[cat] ?? []) {
      const weightKg = entry.weightKg ?? null;
      for (let i = 0; i < entry.sets; i++) {
        lines.push({
          exerciseId: entry.exerciseId,
          reps: entry.reps,
          weightKg,
        });
      }
    }
  }
  return lines;
}
