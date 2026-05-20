"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  clampSupplementalTmFraction,
  SUPPLEMENTAL_TM_FRACTION_MAX,
  SUPPLEMENTAL_TM_FRACTION_MIN,
} from "@/lib/domain/supplementalPercent";
import { roundWorkingWeight } from "@/lib/domain/rounding";
import {
  estimateOneRepMax,
  suggestedTrainingMax,
} from "@/lib/domain/tm";
import type { LiftId, SupplementalLiftMode } from "@/lib/domain/types";
import { LIFT_LABEL, LIFTS } from "@/lib/domain/types";
import { defaultActiveProgram, defaultSettings } from "@/lib/domain/programFlow";
import { defaultBbbFractionForLeaderTemplate } from "@/lib/domain/templates";
import {
  ASSISTANCE_BY_CATEGORY,
  ASSISTANCE_CATEGORY_ORDER,
  CATEGORY_LABEL,
  type AssistanceTemplateByCategory,
  type AssistanceTemplateEntry,
  type CustomAssistanceExercise,
} from "@/lib/domain/assistanceCatalog";
import { optionalFiniteNumberFromInput } from "@/lib/numericInput";
import { AssistanceExercisePicker } from "@/components/AssistanceExercisePicker";
import { loadProgram, loadSettings, saveSettings } from "@/lib/db";
import type { ProgramRow, SettingsRow } from "@/lib/db/schema";

const SUPP_PCT_INPUT_MIN = SUPPLEMENTAL_TM_FRACTION_MIN * 100;
const SUPP_PCT_INPUT_MAX = SUPPLEMENTAL_TM_FRACTION_MAX * 100;

function clampIntPct(n: number): number {
  return Math.min(
    SUPP_PCT_INPUT_MAX,
    Math.max(SUPP_PCT_INPUT_MIN, Math.round(n)),
  );
}

function BbbSupplementalControl({
  row,
  persist,
  programRow,
}: {
  row: SettingsRow;
  persist: (next: SettingsRow) => Promise<void>;
  programRow: ProgramRow | null;
}) {
  const leaderId =
    programRow?.leaderTemplateId ?? defaultActiveProgram().leaderTemplateId;
  const templateFrac = useMemo(
    () => defaultBbbFractionForLeaderTemplate(leaderId),
    [leaderId],
  );
  const templatePct = clampIntPct(Math.round(templateFrac * 100));

  const [localPct, setLocalPct] = useState<number>(() =>
    row.supplementalBbbPercentOverride !== null
      ? clampIntPct(Math.round(row.supplementalBbbPercentOverride * 100))
      : templatePct,
  );

  const dragRef = useRef(false);

  useEffect(() => {
    if (dragRef.current) return;
    setLocalPct(
      row.supplementalBbbPercentOverride !== null
        ? clampIntPct(Math.round(row.supplementalBbbPercentOverride * 100))
        : templatePct,
    );
  }, [row.supplementalBbbPercentOverride, templatePct]);

  function commitFromSlider() {
    dragRef.current = false;
    const frac = clampSupplementalTmFraction(localPct / 100);
    const followsTemplate = clampIntPct(localPct) === templatePct;
    void persist({
      ...row,
      supplementalBbbPercentOverride: followsTemplate ? null : frac,
    });
  }

  function applyPreset(frac: number | null) {
    dragRef.current = false;
    if (frac === null) {
      void persist({ ...row, supplementalBbbPercentOverride: null });
      setLocalPct(templatePct);
      return;
    }
    const f = clampSupplementalTmFraction(frac);
    void persist({ ...row, supplementalBbbPercentOverride: f });
    setLocalPct(clampIntPct(Math.round(f * 100)));
  }

  const followingTemplate = row.supplementalBbbPercentOverride === null;
  const activeSliderPct =
    row.supplementalBbbPercentOverride !== null
      ? clampIntPct(Math.round(row.supplementalBbbPercentOverride * 100))
      : null;

  const rangeId = "supplemental-bbb-range";

  const presets: ReadonlyArray<{
    label: string;
    frac: number | null;
  }> = [
    { label: `Template (${templatePct}%)`, frac: null },
    { label: "50%", frac: 0.5 },
    { label: "55%", frac: 0.55 },
    { label: "60%", frac: 0.6 },
  ];

  return (
    <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h4 className="text-base font-medium text-white">BBB supplemental</h4>
        <output
          className="text-lg font-semibold tabular-nums text-emerald-300"
          htmlFor={rangeId}
        >
          {localPct}%
          <span className="ml-2 text-sm font-normal text-zinc-500">
            {followingTemplate ? "· Leader template" : "· fixed load"}
          </span>
        </output>
      </div>

      <p className="text-sm leading-relaxed text-zinc-500">
        First Set Last always follows your weekly main prescriptions. BBB uses
        this percentage of your supplemental TM unless you pick a fixed preset
        below.
      </p>

      <div className="flex flex-wrap gap-2">
        {presets.map((p) => {
          const targetPct =
            p.frac === null ? null : clampIntPct(Math.round(p.frac * 100));
          const active =
            p.frac === null
              ? followingTemplate
              : !followingTemplate && activeSliderPct === targetPct;
          return (
            <button
              key={p.label}
              type="button"
              className={`min-h-11 rounded-xl border px-4 py-2 text-base font-medium transition ${
                active
                  ? "border-emerald-600 bg-emerald-950/40 text-white"
                  : "border-zinc-700 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-900"
              }`}
              onClick={() => applyPreset(p.frac)}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <label className="text-sm text-zinc-500" htmlFor={rangeId}>
          Fine-tune (whole % only — release to save)
        </label>
        <input
          id={rangeId}
          type="range"
          min={SUPP_PCT_INPUT_MIN}
          max={SUPP_PCT_INPUT_MAX}
          step={1}
          className="slider-touch h-14 w-full cursor-pointer accent-emerald-500"
          value={localPct}
          aria-valuemin={SUPP_PCT_INPUT_MIN}
          aria-valuemax={SUPP_PCT_INPUT_MAX}
          aria-valuenow={localPct}
          onPointerDown={() => {
            dragRef.current = true;
          }}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            setLocalPct(clampIntPct(n));
          }}
          onPointerUp={() => commitFromSlider()}
          onPointerCancel={() => commitFromSlider()}
          onKeyDown={(e) => {
            if (
              e.key === "ArrowLeft" ||
              e.key === "ArrowRight" ||
              e.key === "Home" ||
              e.key === "End"
            ) {
              dragRef.current = true;
            }
          }}
          onKeyUp={(e) => {
            if (
              e.key !== "ArrowLeft" &&
              e.key !== "ArrowRight" &&
              e.key !== "Home" &&
              e.key !== "End"
            ) {
              return;
            }
            window.setTimeout(() => {
              dragRef.current = false;
              commitFromSlider();
            }, 0);
          }}
        />
        <div className="flex justify-between text-xs text-zinc-500 tabular-nums">
          <span>{SUPP_PCT_INPUT_MIN}%</span>
          <span>{SUPP_PCT_INPUT_MAX}%</span>
        </div>
      </div>
    </div>
  );
}

function parsePositiveKg(raw: string): number | null {
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export default function SetupPage() {
  const [row, setRow] = useState<SettingsRow | null>(null);
  const [program, setProgram] = useState<ProgramRow | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [trueMaxKgByLift, setTrueMaxKgByLift] = useState<
    Record<LiftId, string>
  >({
    squat: "",
    bench: "",
    deadlift: "",
    press: "",
  });
  const [tmPercentOfTrueMaxText, setTmPercentOfTrueMaxText] = useState("90");
  const [roundingText, setRoundingText] = useState<string | null>(null);
  const [tmBumpUpperText, setTmBumpUpperText] = useState<string | null>(
    null,
  );
  const [tmBumpLowerText, setTmBumpLowerText] = useState<string | null>(null);
  const [trainingMaxDraftByLift, setTrainingMaxDraftByLift] = useState<
    Partial<Record<LiftId, string>>
  >({});

  useEffect(() => {
    void loadSettings().then(setRow);
  }, []);

  useEffect(() => {
    void loadProgram().then(setProgram);
  }, []);

  async function persist(next: SettingsRow) {
    setRow(next);
    await saveSettings(next);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1500);
  }

  const trueMaxPreviewByLift = useMemo(() => {
    const incrementRaw = row?.roundingIncrement;
    const increment =
      typeof incrementRaw === "number" &&
      Number.isFinite(incrementRaw) &&
      incrementRaw > 0
        ? incrementRaw
        : defaultSettings().roundingIncrement;
    const pctParsed = optionalFiniteNumberFromInput(tmPercentOfTrueMaxText);
    const pct = pctParsed !== undefined ? pctParsed : 90;
    const frac = Math.min(1, Math.max(0.01, pct / 100));
    const next: Record<LiftId, number | null> = {
      squat: null,
      bench: null,
      deadlift: null,
      press: null,
    };
    for (const lift of LIFTS) {
      const trueMax = parsePositiveKg(trueMaxKgByLift[lift]);
      if (trueMax == null) continue;
      const rawTm = suggestedTrainingMax(trueMax, frac);
      next[lift] = roundWorkingWeight(rawTm, increment);
    }
    return next;
  }, [trueMaxKgByLift, tmPercentOfTrueMaxText, row?.roundingIncrement]);

  function applyTrueMaxDerivedTms() {
    if (!row) return;
    const nextTrainingMaxes = { ...row.trainingMaxes };
    let any = false;
    for (const lift of LIFTS) {
      const tm = trueMaxPreviewByLift[lift];
      if (tm != null && tm > 0) {
        nextTrainingMaxes[lift] = tm;
        any = true;
      }
    }
    if (!any) return;
    void persist({ ...row, trainingMaxes: nextTrainingMaxes });
  }

  if (!row) {
    return (
      <p className="text-base text-zinc-400" aria-live="polite">
        Loading settings…
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">Setup</h1>
        <p className="mt-3 text-base leading-relaxed text-zinc-400 sm:text-lg">
          All weights are in kilograms. Training maxes drive every percentage.
          Keep them conservative so weeks stay repeatable.
        </p>
        {savedFlash ? (
          <p className="mt-3 text-base text-emerald-400" role="status">
            Saved locally on this device.
          </p>
        ) : null}
      </header>

      <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
        <h2 className="text-lg font-medium text-white sm:text-xl">Rounding</h2>
        <p className="text-base text-zinc-400">
          Plate-friendly rounding for working loads (often 2.5 kg jumps).
        </p>
        <label className="flex max-w-xs flex-col gap-2">
          <span className="text-base text-zinc-300">Round to nearest (kg)</span>
          <input
            type="number"
            step="0.25"
            min={0.25}
            className="touch-control rounded-xl border border-zinc-700 bg-zinc-950 text-white"
            value={roundingText ?? String(row.roundingIncrement)}
            onChange={(e) => {
              const raw = e.target.value;
              setRoundingText(raw);
              const n = optionalFiniteNumberFromInput(raw);
              if (n !== undefined && n >= 0.25) {
                void persist({ ...row, roundingIncrement: n });
              }
            }}
            onBlur={() => setRoundingText(null)}
          />
        </label>
      </section>

      <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
        <h2 className="text-lg font-medium text-white sm:text-xl">
          Training maxes
        </h2>
        <p className="text-base text-zinc-400">
          Easiest when starting: enter a real or best-estimate{" "}
          <span className="text-zinc-300">true max (1RM)</span> per lift, pick
          how much of that number your TM should be (often 85–90%), then apply.
          Adjust individual TMs below if you want them manually.
        </p>
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 sm:p-5">
          <label className="flex max-w-xs flex-col gap-2 text-base">
            <span className="text-zinc-300">
              Training max as % of true max
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={50}
              max={100}
              step={1}
              className="touch-control rounded-xl border border-zinc-700 bg-zinc-950 text-white"
              value={tmPercentOfTrueMaxText}
              onChange={(e) => setTmPercentOfTrueMaxText(e.target.value)}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            {LIFTS.map((lift) => {
              const preview = trueMaxPreviewByLift[lift];
              return (
                <div key={lift} className="flex flex-col gap-2 text-base">
                  <label className="flex flex-col gap-2">
                    <span className="text-zinc-300">
                      {LIFT_LABEL[lift]} — true max (kg)
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.5}
                      className="touch-control rounded-xl border border-zinc-700 bg-zinc-950 text-white"
                      value={trueMaxKgByLift[lift]}
                      placeholder="e.g. 140"
                      onChange={(e) =>
                        setTrueMaxKgByLift((prev) => ({
                          ...prev,
                          [lift]: e.target.value,
                        }))
                      }
                    />
                  </label>
                  {preview != null ? (
                    <p className="text-sm tabular-nums text-zinc-500">
                      Rounded TM:{" "}
                      <span className="font-medium text-emerald-300">
                        {preview.toFixed(2)} kg
                      </span>{" "}
                      (
                      {optionalFiniteNumberFromInput(tmPercentOfTrueMaxText) ??
                        90}
                      % of true max)
                    </p>
                  ) : (
                    <p className="text-sm text-zinc-600">Enter a true max</p>
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="min-h-12 w-full rounded-xl bg-emerald-600 px-5 py-3 text-base font-semibold text-black hover:bg-emerald-500 active:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            disabled={
              !LIFTS.some((l) => trueMaxPreviewByLift[l] != null)
            }
            onClick={applyTrueMaxDerivedTms}
          >
            Save calculated TMs (lifts with a true max filled)
          </button>
        </div>
        <h3 className="pt-2 text-base font-medium text-zinc-200 sm:text-lg">
          Training maxes on file
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {LIFTS.map((lift) => (
            <label key={lift} className="flex flex-col gap-2 text-base">
              <span className="text-zinc-300">{LIFT_LABEL[lift]}</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.5}
                className="touch-control rounded-xl border border-zinc-700 bg-zinc-950 text-white"
                value={
                  trainingMaxDraftByLift[lift] ??
                  (row.trainingMaxes[lift]
                    ? String(row.trainingMaxes[lift])
                    : "")
                }
                placeholder="0"
                onChange={(e) => {
                  const raw = e.target.value;
                  setTrainingMaxDraftByLift((d) => ({ ...d, [lift]: raw }));
                  const n = optionalFiniteNumberFromInput(raw);
                  if (n !== undefined && n >= 0) {
                    void persist({
                      ...row,
                      trainingMaxes: {
                        ...row.trainingMaxes,
                        [lift]: n,
                      },
                    });
                  }
                }}
                onBlur={() =>
                  setTrainingMaxDraftByLift((d) => {
                    const { [lift]: _, ...rest } = d;
                    return rest;
                  })
                }
              />
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
        <h2 className="text-lg font-medium text-white sm:text-xl">
          Supplemental work
        </h2>
        <p className="text-base leading-relaxed text-zinc-400">
          BBB and FSL percentages can use your TM for today&apos;s main lift or
          for the paired lift in the same category (bench ↔ press, squat ↔
          deadlift) — Forever-style &quot;opposite&quot; BBB option.
        </p>
        <fieldset className="space-y-3">
          <legend className="sr-only">Which training max drives supplemental?</legend>
          {(
            [
              {
                mode: "same" as const,
                title: "Same as main lift",
                hint: "Supplemental sets use percentages of today's bar TM.",
              },
              {
                mode: "paired" as const,
                title: "Paired lift (other upper / lower)",
                hint: "Supplemental percentages use the other lift's TM in that category.",
              },
            ] satisfies Readonly<
              Array<{
                mode: SupplementalLiftMode;
                title: string;
                hint: string;
              }>
            >
          ).map(({ mode, title, hint }) => (
            <label
              key={mode}
              className="flex cursor-pointer gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald-500/70"
            >
              <input
                type="radio"
                name="supplementalLiftMode"
                className="touch-checkbox mt-1 accent-emerald-500"
                checked={row.supplementalLiftMode === mode}
                onChange={() =>
                  void persist({ ...row, supplementalLiftMode: mode })
                }
              />
              <span className="min-w-0">
                <span className="block text-base font-medium text-white">
                  {title}
                </span>
                <span className="mt-1 block text-sm text-zinc-500 sm:text-base">
                  {hint}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="mt-8 space-y-5 border-t border-zinc-800 pt-8">
          <h3 className="text-base font-medium text-white sm:text-lg">
            BBB supplemental load
          </h3>
          <p className="text-base text-zinc-500">
            Percentage of your{" "}
            <span className="text-zinc-400">supplemental TM</span> used for Boring But Big volume.
            The Template preset matches your current Leader template from the Program
            page; switch templates there and it updates automatically.
          </p>
          <BbbSupplementalControl
            row={row}
            persist={persist}
            programRow={program}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
        <h2 className="text-lg font-medium text-white sm:text-xl">
          Assistance templates (Today)
        </h2>
        <p className="text-base leading-relaxed text-zinc-400">
          Build templates with multiple movements, sets, and reps per Push /
          Pull / Single-leg / Core bucket — separate templates for upper- vs
          lower-body main days. Type a movement name or pick from the list; new
          names are saved to My exercises. On Today, load the template and check
          sets off as you go.
        </p>
        <CustomAssistanceExercisesList row={row} persist={persist} />
        <div className="space-y-10 border-t border-zinc-800 pt-8">
          <AssistanceTemplateEditor
            title="Upper-body main day"
            subtitle="Bench or press sessions."
            value={row.assistancePresetUpper}
            customExercises={row.customAssistanceExercises}
            onCreateCustom={(exercise) => {
              if (
                row.customAssistanceExercises.some(
                  (c) =>
                    c.id === exercise.id ||
                    (c.category === exercise.category &&
                      c.name.toLowerCase() === exercise.name.toLowerCase()),
                )
              ) {
                return;
              }
              void persist({
                ...row,
                customAssistanceExercises: [
                  ...row.customAssistanceExercises,
                  exercise,
                ].sort((a, b) => a.name.localeCompare(b.name)),
              });
            }}
            onPersistSlice={(slice) =>
              void persist({ ...row, assistancePresetUpper: slice })
            }
          />
          <AssistanceTemplateEditor
            title="Lower-body main day"
            subtitle="Squat or deadlift sessions."
            value={row.assistancePresetLower}
            customExercises={row.customAssistanceExercises}
            onCreateCustom={(exercise) => {
              if (
                row.customAssistanceExercises.some(
                  (c) =>
                    c.id === exercise.id ||
                    (c.category === exercise.category &&
                      c.name.toLowerCase() === exercise.name.toLowerCase()),
                )
              ) {
                return;
              }
              void persist({
                ...row,
                customAssistanceExercises: [
                  ...row.customAssistanceExercises,
                  exercise,
                ].sort((a, b) => a.name.localeCompare(b.name)),
              });
            }}
            onPersistSlice={(slice) =>
              void persist({ ...row, assistancePresetLower: slice })
            }
          />
        </div>
      </section>

      <TmEstimator row={row} onPersist={persist} />

      <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
        <h2 className="text-lg font-medium text-white sm:text-xl">
          Between-block TM bumps
        </h2>
        <p className="text-base leading-relaxed text-zinc-400">
          Defaults mirror common Forever guidance — small jumps (kg) — repeat
          cycles rather than chasing huge increases.
        </p>
        <div className="flex flex-wrap gap-5">
          <label className="flex max-w-[14rem] flex-col gap-2 text-base">
            <span className="text-zinc-300">
              Upper-body bump (bench / press), kg
            </span>
            <input
              type="number"
              step={0.5}
              min={0}
              className="touch-control rounded-xl border border-zinc-700 bg-zinc-950 text-white"
              value={tmBumpUpperText ?? String(row.tmBumpUpper)}
              onChange={(e) => {
                const raw = e.target.value;
                setTmBumpUpperText(raw);
                const n = optionalFiniteNumberFromInput(raw);
                if (n !== undefined && n >= 0) {
                  void persist({ ...row, tmBumpUpper: n });
                }
              }}
              onBlur={() => setTmBumpUpperText(null)}
            />
          </label>
          <label className="flex max-w-[14rem] flex-col gap-2 text-base">
            <span className="text-zinc-300">
              Lower-body bump (squat / deadlift), kg
            </span>
            <input
              type="number"
              step={0.5}
              min={0}
              className="touch-control rounded-xl border border-zinc-700 bg-zinc-950 text-white"
              value={tmBumpLowerText ?? String(row.tmBumpLower)}
              onChange={(e) => {
                const raw = e.target.value;
                setTmBumpLowerText(raw);
                const n = optionalFiniteNumberFromInput(raw);
                if (n !== undefined && n >= 0) {
                  void persist({ ...row, tmBumpLower: n });
                }
              }}
              onBlur={() => setTmBumpLowerText(null)}
            />
          </label>
        </div>
      </section>
    </div>
  );
}

function CustomAssistanceExercisesList({
  row,
  persist,
}: {
  row: SettingsRow;
  persist: (next: SettingsRow) => void | Promise<void>;
}) {
  const custom = row.customAssistanceExercises;
  return (
    <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <h3 className="text-sm font-medium text-zinc-300">My exercises</h3>
      {custom.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Custom movements you add in templates or on Today appear here.
        </p>
      ) : (
        <ul className="space-y-2">
          {custom.map((ex) => (
            <li
              key={ex.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2"
            >
              <span className="text-base text-white">{ex.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-zinc-500">
                  {CATEGORY_LABEL[ex.category]}
                </span>
                <button
                  type="button"
                  className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
                  onClick={() =>
                    void persist({
                      ...row,
                      customAssistanceExercises: custom.filter(
                        (c) => c.id !== ex.id,
                      ),
                    })
                  }
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function defaultTemplateEntry(
  category: (typeof ASSISTANCE_CATEGORY_ORDER)[number],
): AssistanceTemplateEntry {
  const first = ASSISTANCE_BY_CATEGORY[category][0];
  return {
    exerciseId: first?.id ?? "",
    sets: 5,
    reps: 10,
  };
}

function AssistanceTemplateEditor({
  title,
  subtitle,
  value,
  customExercises,
  onCreateCustom,
  onPersistSlice,
}: {
  title: string;
  subtitle: string;
  value: AssistanceTemplateByCategory;
  customExercises: CustomAssistanceExercise[];
  onCreateCustom: (exercise: CustomAssistanceExercise) => void;
  onPersistSlice: (next: AssistanceTemplateByCategory) => void;
}) {
  function updateCategory(
    category: (typeof ASSISTANCE_CATEGORY_ORDER)[number],
    entries: AssistanceTemplateEntry[],
  ) {
    const next: AssistanceTemplateByCategory = { ...value };
    if (entries.length === 0) {
      delete next[category];
    } else {
      next[category] = entries;
    }
    onPersistSlice(next);
  }

  function updateEntry(
    category: (typeof ASSISTANCE_CATEGORY_ORDER)[number],
    index: number,
    patch: Partial<AssistanceTemplateEntry>,
  ) {
    const current = [...(value[category] ?? [])];
    const row = current[index];
    if (!row) return;
    current[index] = { ...row, ...patch };
    updateCategory(category, current);
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-medium text-white sm:text-lg">{title}</h3>
        <p className="mt-1 text-sm text-zinc-500 sm:text-base">{subtitle}</p>
      </div>
      {ASSISTANCE_CATEGORY_ORDER.map((cat) => {
        const entries = value[cat] ?? [];
        return (
          <div
            key={cat}
            className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4"
          >
            <h4 className="text-sm font-semibold uppercase tracking-wide text-emerald-400/90">
              {CATEGORY_LABEL[cat]}
            </h4>
            {entries.length === 0 ? (
              <p className="text-sm text-zinc-500">No exercises in template.</p>
            ) : (
              <ul className="space-y-3">
                {entries.map((entry, idx) => (
                  <li
                    key={`${cat}-${idx}-${entry.exerciseId}`}
                    className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
                  >
                    <label className="min-w-[min(100%,14rem)] flex-1">
                      <span className="mb-1 block text-xs text-zinc-500">
                        Movement
                      </span>
                      <AssistanceExercisePicker
                        category={cat}
                        customExercises={customExercises}
                        exerciseId={entry.exerciseId}
                        onExerciseIdChange={(id) =>
                          updateEntry(cat, idx, { exerciseId: id })
                        }
                        onCreateCustom={onCreateCustom}
                        commitOnBlur
                        allowCreateOnBlur
                        className="touch-control w-full rounded-xl border border-zinc-700 bg-zinc-950 text-white"
                      />
                    </label>
                    <label className="flex w-[4.5rem] flex-col gap-1 text-xs text-zinc-500">
                      Sets
                      <input
                        type="number"
                        min={1}
                        max={99}
                        inputMode="numeric"
                        className="touch-control w-full rounded-xl border border-zinc-700 bg-zinc-950 text-center text-white"
                        value={entry.sets}
                        onChange={(e) => {
                          const n = optionalFiniteNumberFromInput(e.target.value);
                          if (n !== undefined && n >= 1) {
                            updateEntry(cat, idx, { sets: Math.floor(n) });
                          }
                        }}
                      />
                    </label>
                    <label className="flex w-[4.5rem] flex-col gap-1 text-xs text-zinc-500">
                      Reps
                      <input
                        type="number"
                        min={1}
                        max={999}
                        inputMode="numeric"
                        className="touch-control w-full rounded-xl border border-zinc-700 bg-zinc-950 text-center text-white"
                        value={entry.reps}
                        onChange={(e) => {
                          const n = optionalFiniteNumberFromInput(e.target.value);
                          if (n !== undefined && n >= 1) {
                            updateEntry(cat, idx, { reps: Math.floor(n) });
                          }
                        }}
                      />
                    </label>
                    <label className="flex w-[5.5rem] flex-col gap-1 text-xs text-zinc-500">
                      kg
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="BW"
                        className="touch-control w-full rounded-xl border border-zinc-700 bg-zinc-950 text-center text-white placeholder:text-zinc-600"
                        value={
                          entry.weightKg == null ? "" : String(entry.weightKg)
                        }
                        onChange={(e) => {
                          const t = e.target.value.trim();
                          if (t === "") {
                            updateEntry(cat, idx, { weightKg: null });
                            return;
                          }
                          const n = Number(t.replace(",", "."));
                          if (!Number.isNaN(n) && n >= 0) {
                            updateEntry(cat, idx, { weightKg: n });
                          }
                        }}
                        aria-label="Weight in kg, leave empty for bodyweight"
                      />
                    </label>
                    <button
                      type="button"
                      className="min-h-11 rounded-xl border border-zinc-600 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
                      onClick={() =>
                        updateCategory(
                          cat,
                          entries.filter((_, i) => i !== idx),
                        )
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="min-h-11 rounded-xl border border-emerald-700/60 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-950/40"
              onClick={() =>
                updateCategory(cat, [...entries, defaultTemplateEntry(cat)])
              }
            >
              Add exercise
            </button>
          </div>
        );
      })}
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
  const [weightText, setWeightText] = useState("100");
  const [repsText, setRepsText] = useState("5");
  const [fractionText, setFractionText] = useState("0.9");

  const suggestion = useMemo(() => {
    const weight = optionalFiniteNumberFromInput(weightText) ?? 0;
    const reps = Math.round(optionalFiniteNumberFromInput(repsText) ?? 0);
    const fraction = optionalFiniteNumberFromInput(fractionText) ?? 0.9;
    const e1 = estimateOneRepMax(weight, reps);
    const rawTm = suggestedTrainingMax(e1, fraction);
    const tm = roundWorkingWeight(rawTm, row.roundingIncrement);
    return { e1, tm };
  }, [weightText, repsText, fractionText, row.roundingIncrement]);

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
      <h2 className="text-lg font-medium text-white sm:text-xl">
        Suggested TM from reps
      </h2>
      <p className="text-base leading-relaxed text-zinc-400">
        Uses the Forever estimate{" "}
        <code className="rounded-lg bg-zinc-950 px-2 py-1 text-[0.9em] text-zinc-200">
          weight × reps × 0.0333 + weight
        </code>{" "}
        (kg), then scales by your chosen TM fraction (often 0.85–0.90). The
        suggested TM is rounded to the nearest step from your Rounding setting
        above.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-base">
          <span className="text-zinc-300">Lift</span>
          <select
            className="touch-control rounded-xl border border-zinc-700 bg-zinc-950 text-white"
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
        <label className="flex flex-col gap-2 text-base">
          <span className="text-zinc-300">TM fraction of estimate</span>
          <input
            type="number"
            step={0.01}
            min={0.5}
            max={1}
            className="touch-control rounded-xl border border-zinc-700 bg-zinc-950 text-white"
            value={fractionText}
            onChange={(e) => setFractionText(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2 text-base">
          <span className="text-zinc-300">Hard working-set weight (kg)</span>
          <input
            type="number"
            min={0}
            step={0.5}
            className="touch-control rounded-xl border border-zinc-700 bg-zinc-950 text-white"
            value={weightText}
            onChange={(e) => setWeightText(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2 text-base">
          <span className="text-zinc-300">Clean reps</span>
          <input
            type="number"
            min={1}
            className="touch-control rounded-xl border border-zinc-700 bg-zinc-950 text-white"
            value={repsText}
            onChange={(e) => setRepsText(e.target.value)}
          />
        </label>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-base text-zinc-300">
        <div>
          Estimated 1RM:{" "}
          <span className="font-medium text-white">
            {suggestion.e1.toFixed(1)} kg
          </span>
        </div>
        <div className="mt-2">
          Suggested TM (
          {Math.round(
            (optionalFiniteNumberFromInput(fractionText) ?? 0.9) * 100,
          )}
          %):{" "}
          <span className="font-medium text-white">
            {suggestion.tm.toFixed(1)} kg
          </span>
        </div>
      </div>
      <button
        type="button"
        className="min-h-12 rounded-xl bg-emerald-600 px-5 py-3 text-base font-semibold text-black hover:bg-emerald-500 active:bg-emerald-600"
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
