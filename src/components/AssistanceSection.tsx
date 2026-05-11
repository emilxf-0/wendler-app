"use client";

import { useState } from "react";
import {
  ASSISTANCE_BY_CATEGORY,
  ASSISTANCE_CATEGORY_ORDER,
  CATEGORY_LABEL,
  assistanceDisplayName,
  getAssistanceExercise,
  type AssistanceCategory,
  type AssistancePresetsByCategory,
} from "@/lib/domain/assistanceCatalog";
import type { AssistanceSetRow } from "@/lib/db/schema";

export type AssistanceLine = AssistanceSetRow & { clientKey: string };

export function newAssistanceLine(
  exerciseId: string,
  reps: number,
  weightKg: number | null,
): AssistanceLine {
  return {
    clientKey:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    exerciseId,
    reps,
    weightKg,
  };
}

export function stripAssistanceLines(
  lines: AssistanceLine[],
): AssistanceSetRow[] {
  return lines
    .filter((l) => l.exerciseId && l.reps >= 1)
    .map(({ exerciseId, reps, weightKg }) => ({
      exerciseId,
      reps,
      weightKg,
    }));
}

function parseWeightKg(raw: string): number | null | undefined {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  if (Number.isNaN(n) || n < 0) return undefined;
  return n;
}

function presetExerciseForCategory(
  category: AssistanceCategory,
  presetId: string | undefined,
): string {
  if (!presetId) return "";
  const ex = getAssistanceExercise(presetId);
  if (!ex || ex.category !== category) return "";
  return presetId;
}

function CategoryAssistanceBlock({
  category,
  presetExerciseId,
  lines,
  onLinesChange,
}: {
  category: AssistanceCategory;
  presetExerciseId?: string;
  lines: AssistanceLine[];
  onLinesChange: (next: AssistanceLine[]) => void;
}) {
  const [exerciseId, setExerciseId] = useState(() =>
    presetExerciseForCategory(category, presetExerciseId),
  );
  const [reps, setReps] = useState(10);
  const [weightText, setWeightText] = useState("");

  function addOneSet() {
    if (!exerciseId || !Number.isFinite(reps) || reps < 1) return;
    const w = parseWeightKg(weightText);
    if (w === undefined) return;
    onLinesChange([...lines, newAssistanceLine(exerciseId, reps, w)]);
  }

  return (
    <div className="space-y-3 border-b border-zinc-800/80 pb-5 last:border-0 last:pb-0">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-400/90">
        {CATEGORY_LABEL[category]}
      </h3>
      <div className="flex flex-wrap items-end gap-2 sm:gap-3">
        <label className="min-w-[min(100%,14rem)] flex-1">
          <span className="sr-only">Movement</span>
          <select
            className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-base text-white"
            value={exerciseId}
            onChange={(e) => setExerciseId(e.target.value)}
          >
            <option value="">Movement…</option>
            {ASSISTANCE_BY_CATEGORY[category].map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex w-[4.5rem] flex-col gap-1 text-xs text-zinc-500">
          Reps
          <input
            type="number"
            min={1}
            max={999}
            inputMode="numeric"
            className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-center text-base text-white"
            value={reps}
            onChange={(e) => setReps(Number(e.target.value))}
          />
        </label>
        <label className="flex w-[5.5rem] flex-col gap-1 text-xs text-zinc-500">
          kg
          <input
            type="text"
            inputMode="decimal"
            placeholder="BW"
            className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-center text-base text-white placeholder:text-zinc-600"
            value={weightText}
            onChange={(e) => setWeightText(e.target.value)}
            aria-label="Weight in kg, leave empty for bodyweight"
          />
        </label>
        <button
          type="button"
          className="min-h-11 shrink-0 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-40"
          onClick={addOneSet}
          disabled={
            !exerciseId ||
            !Number.isFinite(reps) ||
            reps < 1 ||
            parseWeightKg(weightText) === undefined
          }
        >
          Add to log
        </button>
      </div>
    </div>
  );
}

export function AssistanceSection({
  hint,
  notes,
  onNotesChange,
  lines,
  onLinesChange,
  presetsByCategory = {},
}: {
  hint: string;
  notes: string;
  onNotesChange: (v: string) => void;
  lines: AssistanceLine[];
  onLinesChange: (next: AssistanceLine[]) => void;
  presetsByCategory?: AssistancePresetsByCategory;
}) {
  function removeLine(clientKey: string) {
    onLinesChange(lines.filter((l) => l.clientKey !== clientKey));
  }

  function updateLine(
    clientKey: string,
    patch: Partial<Pick<AssistanceSetRow, "reps" | "weightKg">>,
  ) {
    onLinesChange(
      lines.map((l) =>
        l.clientKey === clientKey ? { ...l, ...patch } : l,
      ),
    );
  }

  return (
    <section className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-medium text-white sm:text-xl">Assistance</h2>
        <p className="mt-1 text-sm text-zinc-400 sm:text-base">{hint}</p>
      </div>

      <div className="space-y-6">
        {ASSISTANCE_CATEGORY_ORDER.map((cat) => (
          <CategoryAssistanceBlock
            key={cat}
            category={cat}
            presetExerciseId={presetsByCategory[cat]}
            lines={lines}
            onLinesChange={onLinesChange}
          />
        ))}
      </div>

      {lines.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-zinc-300">Logged sets</h3>
          <ul className="space-y-2">
            {lines.map((line) => (
              <li
                key={line.clientKey}
                className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 sm:flex-row sm:flex-wrap sm:items-center"
              >
                <span className="min-w-0 flex-1 font-medium text-white">
                  {assistanceDisplayName(line.exerciseId)}
                </span>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <label className="flex items-center gap-2 text-xs text-zinc-500">
                    Reps
                    <input
                      type="number"
                      min={1}
                      max={999}
                      className="w-16 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-center text-base text-white"
                      value={line.reps}
                      onChange={(e) =>
                        updateLine(line.clientKey, {
                          reps: Math.max(1, Number(e.target.value)),
                        })
                      }
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-zinc-500">
                    kg
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="BW"
                      className="w-20 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-center text-base text-white placeholder:text-zinc-600"
                      value={
                        line.weightKg === null ? "" : String(line.weightKg)
                      }
                      onChange={(e) => {
                        const v = parseWeightKg(e.target.value);
                        if (v !== undefined) {
                          updateLine(line.clientKey, { weightKg: v });
                        }
                      }}
                      aria-label="Weight kg, empty for BW"
                    />
                  </label>
                  <button
                    type="button"
                    className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
                    onClick={() => removeLine(line.clientKey)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">
          No assistance logged — add one set at a time per category above.
        </p>
      )}

      <label className="block space-y-2">
        <span className="text-sm font-medium text-zinc-400">Notes (optional)</span>
        <textarea
          className="min-h-[88px] w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-base leading-relaxed text-white"
          placeholder="Anything else…"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
        />
      </label>
    </section>
  );
}
