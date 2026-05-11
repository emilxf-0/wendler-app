/**
 * Assistance movements grouped like Forever’s Push / Pull / Single-leg·Core buckets.
 * Names are generic gym labels (not copied text from the book).
 */

export type AssistanceCategory = "push" | "pull" | "single_leg" | "core";

/** Optional default assistance movement IDs per bucket (Setup → Today). */
export type AssistancePresetsByCategory = Partial<
  Record<AssistanceCategory, string>
>;

export interface AssistanceExercise {
  id: string;
  name: string;
  category: AssistanceCategory;
}

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

export function getAssistanceExercise(
  id: string,
): AssistanceExercise | undefined {
  return byId.get(id);
}

export function assistanceDisplayName(id: string): string {
  return byId.get(id)?.name ?? id;
}

export function assistanceCategoryOf(id: string): AssistanceCategory | undefined {
  return byId.get(id)?.category;
}

export function sanitizeAssistancePresets(
  raw: unknown,
): AssistancePresetsByCategory {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: AssistancePresetsByCategory = {};
  for (const cat of ASSISTANCE_CATEGORY_ORDER) {
    const id = o[cat];
    if (typeof id !== "string" || id === "") continue;
    const ex = getAssistanceExercise(id);
    if (ex?.category === cat) out[cat] = id;
  }
  return out;
}
