import {
  sanitizeAssistanceTemplate,
  sanitizeCustomAssistanceExercises,
} from "@/lib/domain/assistanceCatalog";
import { defaultSettings } from "@/lib/domain/programFlow";
import { parseSupplementalPercentOverride } from "@/lib/domain/supplementalPercent";
import { LIFTS } from "@/lib/domain/types";
import type { SupplementalLiftMode } from "@/lib/domain/types";
import type { SettingsRow, StoredSettingsShape } from "./schema";
import { SETTINGS_ID } from "./ids";

const LB_TO_KG = 0.45359237;

function coerceSupplementalLiftMode(v: unknown): SupplementalLiftMode {
  return v === "paired" ? "paired" : "same";
}

function roundToQuarterKg(n: number): number {
  return Math.round(n * 4) / 4;
}

/** Convert legacy pound-based rows on read; strips `units`. */
export function normalizeStoredSettings(raw: StoredSettingsShape): SettingsRow {
  const defs = defaultSettings();
  const id = raw.id ?? SETTINGS_ID;

  let roundingIncrement =
    typeof raw.roundingIncrement === "number"
      ? raw.roundingIncrement
      : defs.roundingIncrement;
  let tmBumpUpper =
    typeof raw.tmBumpUpper === "number" ? raw.tmBumpUpper : defs.tmBumpUpper;
  let tmBumpLower =
    typeof raw.tmBumpLower === "number" ? raw.tmBumpLower : defs.tmBumpLower;
  const trainingMaxes = { ...defs.trainingMaxes, ...(raw.trainingMaxes ?? {}) };

  if (raw.units === "lb") {
    const f = LB_TO_KG;
    roundingIncrement = Math.max(
      0.25,
      roundToQuarterKg(roundingIncrement * f) || defs.roundingIncrement,
    );
    tmBumpUpper = Math.max(0.25, roundToQuarterKg(tmBumpUpper * f));
    tmBumpLower = Math.max(0.25, roundToQuarterKg(tmBumpLower * f));
    for (const lift of LIFTS) {
      const v = (trainingMaxes[lift] ?? 0) * f;
      trainingMaxes[lift] = Math.round(v * 10) / 10;
    }
  }

  const lbRaw = (raw as { lastBackupAt?: unknown }).lastBackupAt;
  const lastBackupAt =
    lbRaw === null || lbRaw === undefined
      ? null
      : typeof lbRaw === "number" && Number.isFinite(lbRaw)
        ? lbRaw
        : null;

  const customAssistanceExercises = sanitizeCustomAssistanceExercises(
    (raw as { customAssistanceExercises?: unknown }).customAssistanceExercises,
  );

  return {
    id,
    roundingIncrement,
    tmBumpUpper,
    tmBumpLower,
    trainingMaxes,
    supplementalLiftMode: coerceSupplementalLiftMode(
      (raw as { supplementalLiftMode?: unknown }).supplementalLiftMode,
    ),
    supplementalBbbPercentOverride: parseSupplementalPercentOverride(
      (raw as { supplementalBbbPercentOverride?: unknown })
        .supplementalBbbPercentOverride,
    ),
    assistancePresetUpper: sanitizeAssistanceTemplate(
      (raw as { assistancePresetUpper?: unknown }).assistancePresetUpper,
      customAssistanceExercises,
    ),
    assistancePresetLower: sanitizeAssistanceTemplate(
      (raw as { assistancePresetLower?: unknown }).assistancePresetLower,
      customAssistanceExercises,
    ),
    customAssistanceExercises,
    lastBackupAt,
  };
}

/** Shape written to IndexedDB (known fields only). */
export function storedSettingsPut(row: SettingsRow): SettingsRow & {
  id: string;
} {
  return {
    id: row.id,
    roundingIncrement: row.roundingIncrement,
    trainingMaxes: row.trainingMaxes,
    tmBumpUpper: row.tmBumpUpper,
    tmBumpLower: row.tmBumpLower,
    supplementalLiftMode: coerceSupplementalLiftMode(row.supplementalLiftMode),
    supplementalBbbPercentOverride: row.supplementalBbbPercentOverride,
    assistancePresetUpper: row.assistancePresetUpper,
    assistancePresetLower: row.assistancePresetLower,
    customAssistanceExercises: row.customAssistanceExercises,
    lastBackupAt: row.lastBackupAt ?? null,
  };
}
