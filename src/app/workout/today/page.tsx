"use client";

import { useEffect, useMemo, useState } from "react";
import {
  advanceAfterCompletedWorkout,
  effectiveTemplate,
  rowToSnapshot,
} from "@/lib/domain/programFlow";
import {
  buildWorkoutPrescription,
  workingWeightForSet,
  type WorkoutPrescription,
} from "@/lib/domain/prescription";
import { liftForSession } from "@/lib/domain/schedule";
import type { ActiveProgramSnapshot, LiftId } from "@/lib/domain/types";
import { LIFT_LABEL } from "@/lib/domain/types";
import {
  addSession,
  loadProgram,
  loadSettings,
  saveProgram,
} from "@/lib/db";
import type { ProgramRow } from "@/lib/db/schema";
import type { SettingsRow } from "@/lib/db/schema";
import type { SetLogRow, SupplementalLogRow } from "@/lib/db/schema";

export default function TodayPage() {
  const [program, setProgram] = useState<ProgramRow | null>(null);
  const [settings, setSettings] = useState<SettingsRow | null>(null);

  useEffect(() => {
    void (async () => {
      const [p, s] = await Promise.all([loadProgram(), loadSettings()]);
      setProgram(p);
      setSettings(s);
    })();
  }, []);

  const snapshot = useMemo(() => (program ? rowToSnapshot(program) : null), [
    program,
  ]);

  const lift = snapshot
    ? liftForSession({
        frequency: snapshot.frequency,
        microWeek: snapshot.microWeek,
        workoutIndexInMicroWeek: snapshot.workoutIndexInMicroWeek,
      })
    : null;

  const prescription = useMemo(() => {
    if (!snapshot || !lift || !settings) return null;
    const tm = settings.trainingMaxes[lift] ?? 0;
    const template = effectiveTemplate(snapshot);
    return buildWorkoutPrescription({
      lift,
      template,
      phase: snapshot.phase,
      microWeek: snapshot.microWeek,
      tm,
      roundingIncrement: settings.roundingIncrement,
    });
  }, [snapshot, lift, settings]);

  if (!program || !settings || !snapshot) {
    return (
      <p className="text-sm text-zinc-400" aria-live="polite">
        Loading…
      </p>
    );
  }

  if (snapshot.pendingTmBump) {
    return (
      <div className="space-y-4 rounded-xl border border-amber-700/50 bg-amber-950/40 p-6">
        <h1 className="text-xl font-semibold text-amber-50">
          TM bump pending
        </h1>
        <p className="text-sm text-amber-100/80">
          Finish updating training maxes from your Anchor block, then reset on the
          Dashboard before logging another primary workout.
        </p>
      </div>
    );
  }

  if (!lift || !prescription) {
    return (
      <p className="text-sm text-red-400">
        Unable to resolve today&apos;s lift — reset Program frequency or progress.
      </p>
    );
  }

  const sessionKey = `${lift}-${snapshot.phase}-${snapshot.microWeek}-${snapshot.workoutIndexInMicroWeek}`;

  return (
    <TodayLogger
      key={sessionKey}
      program={program}
      setProgram={setProgram}
      settings={settings}
      snapshot={snapshot}
      lift={lift}
      prescription={prescription}
    />
  );
}

function TodayLogger({
  program,
  setProgram,
  settings,
  snapshot,
  lift,
  prescription,
}: {
  program: ProgramRow;
  setProgram: (p: ProgramRow) => void;
  settings: SettingsRow;
  snapshot: ActiveProgramSnapshot;
  lift: LiftId;
  prescription: WorkoutPrescription;
}) {
  const [mainChecks, setMainChecks] = useState(
    () => prescription.mainSets.map(() => false),
  );
  const [suppChecks, setSuppChecks] = useState(() =>
    prescription.supplemental.map((s) =>
      Array.from({ length: s.sets }, () => false),
    ),
  );
  const [assistance, setAssistance] = useState("");
  const [busy, setBusy] = useState(false);

  const tm = settings.trainingMaxes[lift] ?? 0;
  const increment = settings.roundingIncrement;

  async function handleComplete() {
    if (snapshot.pendingTmBump) {
      window.alert(
        "Resolve the pending TM bump on the Dashboard before advancing workouts.",
      );
      return;
    }
    if (tm <= 0) {
      window.alert("Enter a training max for this lift in Setup.");
      return;
    }

    const mainDone =
      mainChecks.length === prescription.mainSets.length
        ? mainChecks
        : prescription.mainSets.map(() => false);

    const allMainDone = mainDone.length > 0 && mainDone.every(Boolean);
    const supplementalFlatDone =
      prescription.supplemental.length === 0 ||
      suppChecks.every((sets) => sets.length > 0 && sets.every(Boolean));

    const confirmed = window.confirm(
      allMainDone && supplementalFlatDone
        ? "Save this workout and advance your program calendar?"
        : "Some work is unchecked — still save and advance?",
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      const mainLogs: SetLogRow[] = prescription.mainSets.map((set, idx) => ({
        label: set.label,
        prescribedWeight: workingWeightForSet(tm, set.percentTm, increment),
        repsTarget: set.repsTarget,
        completed: Boolean(mainDone[idx]),
      }));

      const supplementalLogs: SupplementalLogRow[] =
        prescription.supplemental.map((supp, supIdx) => ({
          label: supp.label,
          sets: supp.sets,
          reps: supp.reps,
          prescribedWeight: supp.prescribedWeight,
          completedSets:
            suppChecks[supIdx] ??
            Array.from({ length: supp.sets }, () => false),
        }));

      await addSession({
        createdAt: Date.now(),
        lift,
        phase: snapshot.phase,
        microWeek: snapshot.microWeek,
        workoutIndexInMicroWeek: snapshot.workoutIndexInMicroWeek,
        leaderTemplateId: snapshot.leaderTemplateId,
        anchorTemplateId: snapshot.anchorTemplateId,
        mainSets: mainLogs,
        supplemental: supplementalLogs,
        assistanceNotes: assistance,
      });

      const { next, milestones } = advanceAfterCompletedWorkout(snapshot);
      await saveProgram({
        ...program,
        ...next,
      });

      setProgram({ ...program, ...next });
      if (milestones.length) {
        window.alert(milestones.join("\n"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-emerald-400">
          {prescription.phaseLabel}
        </p>
        <h1 className="text-3xl font-semibold text-white">
          {LIFT_LABEL[lift]}
        </h1>
        <p className="text-sm text-zinc-400">
          TM ·{" "}
          <span className="font-medium text-zinc-100">
            {tm ? `${tm} ${settings.units}` : `set TM in Setup`}
          </span>
        </p>
        <p className="text-xs text-zinc-500">
          Session slot {snapshot.workoutIndexInMicroWeek + 1} /{" "}
          {snapshot.frequency} this micro-wave week · Phase{" "}
          {snapshot.phase === "leader"
            ? "Leader"
            : snapshot.phase === "anchor"
              ? "Anchor"
              : "Deload"}
        </p>
      </header>

      <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="font-medium text-white">Main work</h2>
        <div className="space-y-2">
          {prescription.mainSets.map((set, idx) => {
            const weight = workingWeightForSet(tm, set.percentTm, increment);
            const checked = mainChecks[idx] ?? false;
            return (
              <label
                key={`${set.label}-${idx}`}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-3"
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-emerald-500"
                  checked={checked}
                  onChange={(e) =>
                    setMainChecks((prev) => {
                      const next = [...prev];
                      next[idx] = e.target.checked;
                      return next;
                    })
                  }
                />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-white">{set.label}</span>
                    <span className="text-sm text-emerald-300">
                      {tm ? `${weight} ${settings.units}` : "—"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {set.repsTarget === "amrap"
                      ? "Leave reps in the tank unless it's test week."
                      : typeof set.repsTarget === "number"
                        ? `Target ${set.repsTarget} crisp reps`
                        : ""}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </section>

      {prescription.supplemental.length ? (
        <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="font-medium text-white">Supplemental</h2>
          {prescription.supplemental.map((block, blockIdx) => (
            <div key={block.label} className="space-y-2">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="text-zinc-300">{block.label}</span>
                <span className="text-emerald-300">
                  {tm ? `${block.prescribedWeight} ${settings.units}` : "—"} ×{" "}
                  {block.reps} × {block.sets} sets
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-5">
                {Array.from({ length: block.sets }).map((_, setIdx) => (
                  <label
                    key={`${block.label}-${setIdx}`}
                    className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-2 text-xs text-zinc-300"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-emerald-500"
                      checked={suppChecks[blockIdx]?.[setIdx] ?? false}
                      onChange={(e) =>
                        setSuppChecks((prev) => {
                          const next = prev.map((arr) => [...arr]);
                          if (!next[blockIdx]) {
                            next[blockIdx] = Array.from(
                              { length: block.sets },
                              () => false,
                            );
                          }
                          next[blockIdx][setIdx] = e.target.checked;
                          return next;
                        })
                      }
                    />
                    Set {setIdx + 1}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="font-medium text-white">Assistance</h2>
        <p className="text-sm text-zinc-400">{prescription.assistanceHint}</p>
        <textarea
          className="min-h-[96px] w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
          placeholder="Push / Pull / Single-leg·Core notes…"
          value={assistance}
          onChange={(e) => setAssistance(e.target.value)}
        />
      </section>

      <button
        type="button"
        disabled={busy}
        className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-black hover:bg-emerald-500 disabled:opacity-50"
        onClick={() => void handleComplete()}
      >
        Complete workout
      </button>
    </div>
  );
}
