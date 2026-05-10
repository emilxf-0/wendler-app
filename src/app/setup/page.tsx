"use client";

import { useEffect, useMemo, useState } from "react";
import {
  estimateOneRepMax,
  suggestedTrainingMax,
} from "@/lib/domain/tm";
import type { LiftId } from "@/lib/domain/types";
import { LIFT_LABEL, LIFTS } from "@/lib/domain/types";
import { loadSettings, saveSettings } from "@/lib/db";
import type { SettingsRow } from "@/lib/db/schema";

export default function SetupPage() {
  const [row, setRow] = useState<SettingsRow | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    void loadSettings().then(setRow);
  }, []);

  async function persist(next: SettingsRow) {
    setRow(next);
    await saveSettings(next);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1500);
  }

  if (!row) {
    return (
      <p className="text-sm text-zinc-400" aria-live="polite">
        Loading settings…
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-white">Setup</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Training maxes drive every percentage. Keep them conservative so weeks
          stay repeatable.
        </p>
        {savedFlash ? (
          <p className="mt-2 text-sm text-emerald-400" role="status">
            Saved locally on this device.
          </p>
        ) : null}
      </header>

      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="font-medium text-white">Units & rounding</h2>
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Units</span>
            <select
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              value={row.units}
              onChange={(e) =>
                void persist({
                  ...row,
                  units: e.target.value as SettingsRow["units"],
                  roundingIncrement:
                    e.target.value === "kg"
                      ? 1.25
                      : row.roundingIncrement || 2.5,
                })
              }
            >
              <option value="lb">Pounds</option>
              <option value="kg">Kilograms</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Round to nearest</span>
            <input
              type="number"
              step="0.25"
              min={0.25}
              className="w-36 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              value={row.roundingIncrement}
              onChange={(e) =>
                void persist({
                  ...row,
                  roundingIncrement: Number(e.target.value),
                })
              }
            />
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="font-medium text-white">Training maxes</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {LIFTS.map((lift) => (
            <label key={lift} className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-400">{LIFT_LABEL[lift]}</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={row.units === "kg" ? 0.5 : 1}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
                value={row.trainingMaxes[lift] || ""}
                placeholder="0"
                onChange={(e) =>
                  void persist({
                    ...row,
                    trainingMaxes: {
                      ...row.trainingMaxes,
                      [lift]: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
          ))}
        </div>
      </section>

      <TmEstimator row={row} onPersist={persist} />

      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="font-medium text-white">Between-block TM bumps</h2>
        <p className="text-sm text-zinc-400">
          Defaults mirror common Forever guidance — keep jumps small and repeat
          cycles rather than chasing huge jumps.
        </p>
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Upper-body bump (bench / press)</span>
            <input
              type="number"
              step="0.5"
              min={0}
              className="w-36 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              value={row.tmBumpUpper}
              onChange={(e) =>
                void persist({
                  ...row,
                  tmBumpUpper: Number(e.target.value),
                })
              }
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">
              Lower-body bump (squat / deadlift)
            </span>
            <input
              type="number"
              step="0.5"
              min={0}
              className="w-36 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              value={row.tmBumpLower}
              onChange={(e) =>
                void persist({
                  ...row,
                  tmBumpLower: Number(e.target.value),
                })
              }
            />
          </label>
        </div>
      </section>
    </div>
  );
}

function TmEstimator({
  row,
  onPersist,
}: {
  row: SettingsRow;
  onPersist: (next: SettingsRow) => void;
}) {
  const [lift, setLift] = useState<LiftId>("squat");
  const [weight, setWeight] = useState(135);
  const [reps, setReps] = useState(5);
  const [fraction, setFraction] = useState(0.9);

  const suggestion = useMemo(() => {
    const e1 = estimateOneRepMax(weight, reps);
    const tm = suggestedTrainingMax(e1, fraction);
    return { e1, tm };
  }, [weight, reps, fraction]);

  return (
    <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="font-medium text-white">Suggested TM from reps</h2>
      <p className="text-sm text-zinc-400">
        Uses the Forever estimate{" "}
        <code className="rounded bg-zinc-950 px-1 py-0.5 text-xs">
          weight × reps × 0.0333 + weight
        </code>{" "}
        then scales by your chosen TM fraction (often 0.85–0.90).
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">Lift</span>
          <select
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            value={lift}
            onChange={(e) => setLift(e.target.value as LiftId)}
          >
            {LIFTS.map((l) => (
              <option key={l} value={l}>
                {LIFT_LABEL[l]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">TM fraction of estimate</span>
          <input
            type="number"
            step={0.01}
            min={0.5}
            max={1}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            value={fraction}
            onChange={(e) => setFraction(Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">Hard working-set weight</span>
          <input
            type="number"
            min={0}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">Clean reps</span>
          <input
            type="number"
            min={1}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            value={reps}
            onChange={(e) => setReps(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
        <div>
          Estimated 1RM:{" "}
          <span className="font-medium text-white">
            {suggestion.e1.toFixed(1)} {row.units}
          </span>
        </div>
        <div className="mt-1">
          Suggested TM ({Math.round(fraction * 100)}%):{" "}
          <span className="font-medium text-white">
            {suggestion.tm.toFixed(1)} {row.units}
          </span>
        </div>
      </div>
      <button
        type="button"
        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-black hover:bg-emerald-500"
        onClick={() =>
          onPersist({
            ...row,
            trainingMaxes: {
              ...row.trainingMaxes,
              [lift]: suggestion.tm,
            },
          })
        }
      >
        Apply suggestion to {LIFT_LABEL[lift]}
      </button>
    </section>
  );
}
