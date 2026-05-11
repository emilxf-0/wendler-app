"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { generateCompletedSessionsThroughLeaderCycles } from "@/lib/domain/leaderHistoryReplay";
import {
  applyAdvancedProgramPosition,
  presetAnchorWeek1,
  presetDeloadAfterLeaderBlock,
  type AdvancedPositionPatch,
} from "@/lib/domain/programBackfill";
import { defaultActiveProgram, rowToSnapshot } from "@/lib/domain/programFlow";
import { templatesForRole } from "@/lib/domain/templates";
import type { LiftId, Phase } from "@/lib/domain/types";
import { LIFT_LABEL, LIFTS } from "@/lib/domain/types";
import {
  bulkAddSessionsAndSaveProgram,
  loadProgram,
  loadSettings,
  persistSettingsAndProgram,
  saveProgram,
} from "@/lib/db";
import type { ProgramRow } from "@/lib/db/schema";

export default function ProgramPage() {
  const [row, setRow] = useState<ProgramRow | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    void loadProgram().then(setRow);
  }, []);

  async function persist(next: ProgramRow) {
    setRow(next);
    await saveProgram(next);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1500);
  }

  const leaders = useMemo(() => templatesForRole("leader"), []);
  const anchors = useMemo(() => templatesForRole("anchor"), []);

  if (!row) {
    return (
      <p className="text-base text-zinc-400" aria-live="polite">
        Loading program…
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">Program</h1>
        <p className="mt-3 text-base leading-relaxed text-zinc-400 sm:text-lg">
          Pick a Leader template for volume phases and an Anchor template for
          sharper intensity work. Deload weeks bridge the two automatically.
        </p>
        {savedFlash ? (
          <p className="mt-3 text-base text-emerald-400" role="status">
            Saved locally on this device.
          </p>
        ) : null}
      </header>

      <section className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
        <h2 className="text-lg font-medium text-white sm:text-xl">
          Weekly frequency
        </h2>
        <div className="flex flex-wrap gap-3">
          {[3, 4].map((f) => (
            <button
              key={f}
              type="button"
              className={`min-h-12 rounded-xl px-5 py-3 text-base font-semibold transition ${
                row.frequency === f
                  ? "bg-emerald-600 text-black"
                  : "border border-zinc-700 text-zinc-100 hover:bg-zinc-900"
              }`}
              onClick={() =>
                void persist({
                  ...row,
                  frequency: f as 3 | 4,
                  workoutIndexInMicroWeek: 0,
                })
              }
            >
              {f} days / week
            </button>
          ))}
        </div>
      </section>

      <TemplatePicker
        title="Leader template"
        templates={leaders}
        selectedId={row.leaderTemplateId}
        onSelect={(id) => void persist({ ...row, leaderTemplateId: id })}
      />

      <TemplatePicker
        title="Anchor template"
        templates={anchors}
        selectedId={row.anchorTemplateId}
        onSelect={(id) => void persist({ ...row, anchorTemplateId: id })}
      />

      <section className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
        <h2 className="text-lg font-medium text-white sm:text-xl">
          Cycle targets
        </h2>
        <div className="flex flex-wrap gap-6">
          <label className="flex flex-col gap-2 text-base">
            <span className="text-zinc-300">Leader cycles before deload</span>
            <input
              type="number"
              min={1}
              max={6}
              className="touch-control w-32 rounded-xl border border-zinc-700 bg-zinc-950 text-white"
              value={row.leaderCyclesTarget}
              onChange={(e) =>
                void persist({
                  ...row,
                  leaderCyclesTarget: Number(e.target.value),
                })
              }
            />
          </label>
          <label className="flex flex-col gap-2 text-base">
            <span className="text-zinc-300">
              Anchor cycles before next Leader block
            </span>
            <input
              type="number"
              min={1}
              max={6}
              className="touch-control w-32 rounded-xl border border-zinc-700 bg-zinc-950 text-white"
              value={row.anchorCyclesTarget}
              onChange={(e) =>
                void persist({
                  ...row,
                  anchorCyclesTarget: Number(e.target.value),
                })
              }
            />
          </label>
        </div>
      </section>

      <BackfillSection
        row={row}
        persist={persist}
        setRow={setRow}
        flashSaved={() => {
          setSavedFlash(true);
          window.setTimeout(() => setSavedFlash(false), 1500);
        }}
      />

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
        <h2 className="text-lg font-medium text-white sm:text-xl">Danger zone</h2>
        <p className="mt-3 text-base leading-relaxed text-zinc-400">
          Reset programming progress but keep training maxes intact.
        </p>
        <button
          type="button"
          className="mt-4 min-h-12 rounded-xl border border-red-800 px-5 py-3 text-base text-red-100 hover:bg-red-950/60"
          onClick={() => {
            const ok = window.confirm(
              "Reset program progress to defaults? Training maxes stay unchanged.",
            );
            if (!ok) return;
            void persist({
              ...row,
              ...defaultActiveProgram({
                leaderTemplateId: row.leaderTemplateId,
                anchorTemplateId: row.anchorTemplateId,
                frequency: row.frequency,
                leaderCyclesTarget: row.leaderCyclesTarget,
                anchorCyclesTarget: row.anchorCyclesTarget,
              }),
              id: row.id,
            });
          }}
        >
          Reset program progress
        </button>
      </section>

      <details className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 text-base text-zinc-400">
        <summary className="cursor-pointer text-lg text-white">
          Debug snapshot
        </summary>
        <pre className="mt-4 overflow-x-auto text-sm text-zinc-500">
          {JSON.stringify(row, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function BackfillSection({
  row,
  persist,
  setRow,
  flashSaved,
}: {
  row: ProgramRow;
  persist: (next: ProgramRow) => Promise<void>;
  setRow: (next: ProgramRow) => void;
  flashSaved: () => void;
}) {
  const snap = useMemo(() => rowToSnapshot(row), [row]);
  const [adv, setAdv] = useState<AdvancedPositionPatch>({
    phase: row.phase,
    microWeek: row.microWeek,
    workoutIndexInMicroWeek: row.workoutIndexInMicroWeek,
    leaderCyclesCompleted: row.leaderCyclesCompleted,
    anchorCyclesCompleted: row.anchorCyclesCompleted,
    pendingTmBump: row.pendingTmBump,
    pendingTmRestartToLeader: row.pendingTmRestartToLeader ?? false,
  });

  useEffect(() => {
    setAdv({
      phase: row.phase,
      microWeek: row.microWeek,
      workoutIndexInMicroWeek: row.workoutIndexInMicroWeek,
      leaderCyclesCompleted: row.leaderCyclesCompleted,
      anchorCyclesCompleted: row.anchorCyclesCompleted,
      pendingTmBump: row.pendingTmBump,
      pendingTmRestartToLeader: row.pendingTmRestartToLeader ?? false,
    });
  }, [row]);

  const [replayWaves, setReplayWaves] = useState(2);
  const [replayIncludeDeload, setReplayIncludeDeload] = useState(false);
  const [replayStartLocal, setReplayStartLocal] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [replayStartTms, setReplayStartTms] = useState<
    Record<LiftId, number>
  >({
    squat: 0,
    bench: 0,
    deadlift: 0,
    press: 0,
  });
  const [replayWriteEndTmsToSetup, setReplayWriteEndTmsToSetup] =
    useState(false);
  const [backfillBusy, setBackfillBusy] = useState(false);

  useEffect(() => {
    void loadSettings().then((s) => {
      setReplayStartTms({ ...s.trainingMaxes });
    });
  }, []);

  async function runHistoryReplay() {
    const waves = Math.floor(replayWaves);
    if (waves < 1) {
      window.alert("Enter at least 1 Leader wave to simulate.");
      return;
    }
    const startMs = new Date(replayStartLocal).getTime();
    if (!Number.isFinite(startMs)) {
      window.alert("Pick a valid start date / time.");
      return;
    }
    const badLift = LIFTS.find((lift) => (replayStartTms[lift] ?? 0) <= 0);
    if (badLift) {
      window.alert(
        `Enter a positive training max (kg) for ${LIFT_LABEL[badLift]} at the start of the replay.`,
      );
      return;
    }
    const settings = await loadSettings();
    const minSessions = waves * 3 * row.frequency;
    const okGo = window.confirm(
      `Add synthetic Leader history (${minSessions} sessions if you complete ${waves} full wave(s) before deload), then move your program to match? First session uses the “start” TMs you entered; after each 3-week wave the replay applies your Setup TM bumps (upper / lower, kg) like the Dashboard. Download a backup on History first (recommended).`,
    );
    if (!okGo) return;

    setBackfillBusy(true);
    try {
      const startProgram = defaultActiveProgram({
        leaderTemplateId: row.leaderTemplateId,
        anchorTemplateId: row.anchorTemplateId,
        frequency: row.frequency,
        leaderCyclesTarget: row.leaderCyclesTarget,
        anchorCyclesTarget: row.anchorCyclesTarget,
      });
      const replaySettings = {
        roundingIncrement: settings.roundingIncrement,
        supplementalLiftMode: settings.supplementalLiftMode,
        supplementalBbbPercentOverride: settings.supplementalBbbPercentOverride,
        tmBumpUpper: settings.tmBumpUpper,
        tmBumpLower: settings.tmBumpLower,
      };
      const { sessions, finalProgram, finalTrainingMaxes } =
        generateCompletedSessionsThroughLeaderCycles({
          startProgram,
          settings: replaySettings,
          startingTrainingMaxes: replayStartTms,
          leaderWavesToSimulate: waves,
          includeDeloadInHistory: replayIncludeDeload,
          baseTimestampMs: startMs,
        });

      if (sessions.length === 0) {
        window.alert(
          "No sessions generated — check Leader waves and cycle targets.",
        );
        return;
      }

      const merged: ProgramRow = {
        ...row,
        ...finalProgram,
        id: row.id,
      };
      const wrote = await bulkAddSessionsAndSaveProgram(sessions, merged);
      if (!wrote) {
        window.alert(
          "Could not save — storage may be unavailable (e.g. private browsing).",
        );
        return;
      }

      if (replayWriteEndTmsToSetup) {
        const latest = await loadSettings();
        const settingsOk = await persistSettingsAndProgram(
          { ...latest, trainingMaxes: { ...finalTrainingMaxes } },
          merged,
        );
        if (!settingsOk) {
          window.alert(
            "Sessions were saved, but updating Setup training maxes failed.",
          );
        }
      }

      setRow(merged);
      flashSaved();
      window.alert(
        `Added ${sessions.length} sessions. Program position updated. End-of-replay TMs (kg): squat ${finalTrainingMaxes.squat}, bench ${finalTrainingMaxes.bench}, deadlift ${finalTrainingMaxes.deadlift}, press ${finalTrainingMaxes.press}.${replayWriteEndTmsToSetup ? " Setup was updated to match." : ""}`,
      );
    } finally {
      setBackfillBusy(false);
    }
  }

  const maxIx = row.frequency === 4 ? 3 : 2;

  return (
    <section className="space-y-8 rounded-2xl border border-zinc-700/80 bg-zinc-950/30 p-5 sm:p-6">
      <header>
        <h2 className="text-lg font-medium text-white sm:text-xl">
          Catch up / backfill
        </h2>
        <p className="mt-3 text-base leading-relaxed text-zinc-400">
          Align this app with work you already finished, or add approximate
          History from past Leader blocks. If{" "}
          <span className="text-zinc-300">Training max review</span> is on,
          Today stays blocked until you clear it on the Dashboard.
        </p>
      </header>

      <div className="space-y-3">
        <h3 className="text-base font-medium text-zinc-200">Quick position</h3>
        <p className="text-base text-zinc-500">
          Use when you already ran your Leader block outside the app. Set
          training maxes in Setup first if you bumped them since then.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            className="min-h-12 rounded-xl border border-zinc-600 bg-zinc-900/80 px-5 py-3 text-left text-base font-medium text-zinc-100 transition hover:border-emerald-600/60 hover:bg-zinc-900"
            onClick={() =>
              void persist({
                ...row,
                ...presetDeloadAfterLeaderBlock(snap, false),
              })
            }
          >
            After Leader → Deload{" "}
            <span className="block text-sm font-normal text-zinc-500">
              TMs already match Setup; no Dashboard hold
            </span>
          </button>
          <button
            type="button"
            className="min-h-12 rounded-xl border border-zinc-600 bg-zinc-900/80 px-5 py-3 text-left text-base font-medium text-zinc-100 transition hover:border-amber-700/50 hover:bg-zinc-900"
            onClick={() =>
              void persist({
                ...row,
                ...presetDeloadAfterLeaderBlock(snap, true),
              })
            }
          >
            After Leader → Deload + TM review{" "}
            <span className="block text-sm font-normal text-zinc-500">
              Show Dashboard card before logging
            </span>
          </button>
          <button
            type="button"
            className="min-h-12 rounded-xl border border-zinc-600 bg-zinc-900/80 px-5 py-3 text-left text-base font-medium text-zinc-100 transition hover:border-emerald-600/60 hover:bg-zinc-900"
            onClick={() =>
              void persist({ ...row, ...presetAnchorWeek1(snap) })
            }
          >
            Start Anchor (week 1){" "}
            <span className="block text-sm font-normal text-zinc-500">
              Skip or past 7th-week deload
            </span>
          </button>
        </div>
      </div>

      <details className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <summary className="cursor-pointer text-base font-medium text-white">
          Advanced — phase, week, session slot
        </summary>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-base">
            <span className="text-zinc-400">Phase</span>
            <select
              className="touch-control rounded-xl border border-zinc-700 bg-zinc-950 text-white"
              value={adv.phase}
              onChange={(e) =>
                setAdv((a) => ({
                  ...a,
                  phase: e.target.value as Phase,
                }))
              }
            >
              <option value="leader">Leader</option>
              <option value="deload">7th week · Deload</option>
              <option value="anchor">Anchor</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-base">
            <span className="text-zinc-400">Micro-wave week (1–3)</span>
            <input
              type="number"
              min={1}
              max={3}
              className="touch-control rounded-xl border border-zinc-700 bg-zinc-950 text-white"
              value={adv.microWeek}
              onChange={(e) =>
                setAdv((a) => ({
                  ...a,
                  microWeek: Number(e.target.value),
                }))
              }
            />
          </label>
          <label className="flex flex-col gap-2 text-base">
            <span className="text-zinc-400">
              Session slot (0–{maxIx} · {row.frequency} days/week)
            </span>
            <input
              type="number"
              min={0}
              max={maxIx}
              className="touch-control rounded-xl border border-zinc-700 bg-zinc-950 text-white"
              value={adv.workoutIndexInMicroWeek}
              onChange={(e) =>
                setAdv((a) => ({
                  ...a,
                  workoutIndexInMicroWeek: Number(e.target.value),
                }))
              }
            />
          </label>
          <label className="flex flex-col gap-2 text-base">
            <span className="text-zinc-400">Leader cycles completed</span>
            <input
              type="number"
              min={0}
              max={6}
              className="touch-control rounded-xl border border-zinc-700 bg-zinc-950 text-white"
              value={adv.leaderCyclesCompleted}
              onChange={(e) =>
                setAdv((a) => ({
                  ...a,
                  leaderCyclesCompleted: Number(e.target.value),
                }))
              }
            />
          </label>
          <label className="flex flex-col gap-2 text-base">
            <span className="text-zinc-400">Anchor cycles completed</span>
            <input
              type="number"
              min={0}
              max={6}
              className="touch-control rounded-xl border border-zinc-700 bg-zinc-950 text-white"
              value={adv.anchorCyclesCompleted}
              onChange={(e) =>
                setAdv((a) => ({
                  ...a,
                  anchorCyclesCompleted: Number(e.target.value),
                }))
              }
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-base text-zinc-300">
            <input
              type="checkbox"
              className="touch-checkbox accent-emerald-500"
              checked={adv.pendingTmBump}
              onChange={(e) =>
                setAdv((a) => ({ ...a, pendingTmBump: e.target.checked }))
              }
            />
            Pending TM review
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-base text-zinc-300">
            <input
              type="checkbox"
              className="touch-checkbox accent-emerald-500"
              checked={adv.pendingTmRestartToLeader}
              onChange={(e) =>
                setAdv((a) => ({
                  ...a,
                  pendingTmRestartToLeader: e.target.checked,
                }))
              }
            />
            After Anchor block (restart Leader next)
          </label>
        </div>
        <button
          type="button"
          className="mt-5 min-h-12 rounded-xl border border-emerald-700/60 bg-emerald-950/35 px-5 py-3 text-base font-medium text-emerald-100 hover:bg-emerald-950/55"
          onClick={() =>
            void persist({
              ...row,
              ...applyAdvancedProgramPosition(snap, adv),
            })
          }
        >
          Apply advanced position
        </button>
      </details>

      <div className="space-y-4 rounded-xl border border-amber-900/40 bg-amber-950/20 p-4 sm:p-5">
        <h3 className="text-base font-medium text-amber-100">
          Generate Leader history (optional)
        </h3>
        <p className="text-base leading-relaxed text-amber-200/75">
          Replays full Leader waves from week 1 using your templates and cycle
          targets. Enter training maxes as they were at the{" "}
          <span className="font-medium text-amber-100/95">start</span> of this
          replay; after each finished 3-week wave the generator applies bumps
          from Setup (same upper / lower kg as the Dashboard). Often fewer than{" "}
          {Math.max(1, Math.floor(replayWaves))}×3×{row.frequency} sessions if
          “Leader cycles before deload” ends your block early (7th week).{" "}
          <Link
            href="/history"
            className="font-medium text-emerald-400 underline-offset-2 hover:underline"
          >
            History → Download backup
          </Link>{" "}
          first is strongly recommended.
        </p>
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <span className="text-base font-medium text-zinc-200">
              Starting TMs (kg, before first bump in replay)
            </span>
            <button
              type="button"
              className="min-h-10 rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-500 hover:bg-zinc-900"
              onClick={() =>
                void loadSettings().then((s) =>
                  setReplayStartTms({ ...s.trainingMaxes }),
                )
              }
            >
              Fill from Setup
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {LIFTS.map((lift) => (
              <label key={lift} className="flex flex-col gap-2 text-base">
                <span className="text-zinc-400">{LIFT_LABEL[lift]}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.5}
                  className="touch-control rounded-xl border border-zinc-700 bg-zinc-950 text-white"
                  value={replayStartTms[lift] || ""}
                  onChange={(e) =>
                    setReplayStartTms((prev) => ({
                      ...prev,
                      [lift]: Number(e.target.value),
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-5">
          <label className="flex flex-col gap-2 text-base">
            <span className="text-zinc-400">Leader waves to simulate</span>
            <input
              type="number"
              min={1}
              max={12}
              className="touch-control w-28 rounded-xl border border-zinc-700 bg-zinc-950 text-white"
              value={replayWaves}
              onChange={(e) => setReplayWaves(Number(e.target.value))}
            />
          </label>
          <label className="flex flex-col gap-2 text-base">
            <span className="text-zinc-400">First session starts at</span>
            <input
              type="datetime-local"
              className="touch-control rounded-xl border border-zinc-700 bg-zinc-950 text-white"
              value={replayStartLocal}
              onChange={(e) => setReplayStartLocal(e.target.value)}
            />
          </label>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-base text-zinc-300">
          <input
            type="checkbox"
            className="touch-checkbox accent-amber-500"
            checked={replayIncludeDeload}
            onChange={(e) => setReplayIncludeDeload(e.target.checked)}
          />
          If replay ends in Deload, log 7th-week sessions too (then opens Anchor
          week 1)
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-base text-zinc-300">
          <input
            type="checkbox"
            className="touch-checkbox accent-amber-500"
            checked={replayWriteEndTmsToSetup}
            onChange={(e) => setReplayWriteEndTmsToSetup(e.target.checked)}
          />
          After replay, write end-of-replay TMs to Setup (optional)
        </label>
        <button
          type="button"
          disabled={backfillBusy}
          className="min-h-12 rounded-xl border border-amber-700/70 bg-amber-950/50 px-5 py-3 text-base font-medium text-amber-50 hover:bg-amber-950/70 disabled:opacity-50"
          onClick={() => void runHistoryReplay()}
        >
          {backfillBusy ? "Working…" : "Generate sessions & update program"}
        </button>
      </div>
    </section>
  );
}

function TemplatePicker({
  title,
  templates,
  selectedId,
  onSelect,
}: {
  title: string;
  templates: ReturnType<typeof templatesForRole>;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
      <h2 className="text-lg font-medium text-white sm:text-xl">{title}</h2>
      <div className="grid gap-4">
        {templates.map((t) => {
          const active = t.id === selectedId;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className={`rounded-2xl border px-5 py-4 text-left transition sm:py-5 ${
                active
                  ? "border-emerald-600 bg-emerald-950/40"
                  : "border-zinc-800 hover:border-zinc-600"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-xl font-semibold text-white">{t.name}</span>
                {active ? (
                  <span className="shrink-0 text-sm font-medium uppercase tracking-wide text-emerald-400">
                    Selected
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-base leading-relaxed text-zinc-400">
                {t.shortDescription}
              </p>
              <p className="mt-3 text-sm text-zinc-500 sm:text-base">
                {t.recommendedTmNote}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
