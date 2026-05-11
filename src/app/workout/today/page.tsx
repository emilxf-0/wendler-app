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
import { completedSessionLogsFromPrescription } from "@/lib/domain/sessionLogFromPrescription";
import {
  liftForSession,
  mainLiftIsUpperBody,
  pairedBarbellLift,
} from "@/lib/domain/schedule";
import type { ActiveProgramSnapshot, LiftId } from "@/lib/domain/types";
import { LIFT_LABEL } from "@/lib/domain/types";
import {
  addSession,
  loadProgram,
  loadSettings,
  saveProgram,
} from "@/lib/db";
import type { AssistancePresetsByCategory } from "@/lib/domain/assistanceCatalog";
import type {
  ProgramRow,
  SetLogRow,
  SettingsRow,
  SupplementalLogRow,
} from "@/lib/db/schema";
import {
  AssistanceSection,
  stripAssistanceLines,
  type AssistanceLine,
} from "@/components/AssistanceSection";

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
    ? liftForSession(snapshot.workoutIndexInMicroWeek)
    : null;

  const supplementalLift = useMemo(() => {
    if (!lift || !settings) return null;
    return settings.supplementalLiftMode === "paired"
      ? pairedBarbellLift(lift)
      : lift;
  }, [lift, settings]);

  const supplementalTm =
    supplementalLift != null && settings
      ? (settings.trainingMaxes[supplementalLift] ?? 0)
      : 0;

  const prescription = useMemo(() => {
    if (!snapshot || !lift || !settings || !supplementalLift) return null;
    const tm = settings.trainingMaxes[lift] ?? 0;
    const template = effectiveTemplate(snapshot);
    return buildWorkoutPrescription({
      lift,
      template,
      phase: snapshot.phase,
      microWeek: snapshot.microWeek,
      tm,
      supplementalLift,
      supplementalTm: settings.trainingMaxes[supplementalLift] ?? 0,
      roundingIncrement: settings.roundingIncrement,
      supplementalBbbPercentOverride: settings.supplementalBbbPercentOverride,
      bbbLeaderMainTopSet: snapshot.bbbLeaderMainTopSet,
    });
  }, [snapshot, lift, settings, supplementalLift]);

  const assistancePresetsByCategory: AssistancePresetsByCategory =
    useMemo(() => {
      if (!lift || !settings) return {};
      return mainLiftIsUpperBody(lift)
        ? settings.assistancePresetUpper
        : settings.assistancePresetLower;
    }, [lift, settings]);

  if (!program || !settings || !snapshot) {
    return (
      <p className="text-base text-zinc-400" aria-live="polite">
        Loading…
      </p>
    );
  }

  if (snapshot.pendingTmBump) {
    return (
      <div className="space-y-4 rounded-2xl border border-amber-700/50 bg-amber-950/40 p-6 sm:p-8">
        <h1 className="text-2xl font-semibold text-amber-50 sm:text-3xl">
          Training max review pending
        </h1>
        <p className="text-base leading-relaxed text-amber-100/85 sm:text-lg">
          You finished a 3-week wave. Use the Dashboard to apply or skip bumps
          (and adjust TMs in Setup); then logging can continue.
        </p>
      </div>
    );
  }

  if (!lift || !prescription) {
    return (
      <p className="text-base text-red-400">
        Unable to resolve today&apos;s lift — reset Program progress in Program → Catch up / backfill.
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
      supplementalTm={supplementalTm}
      assistancePresetsByCategory={assistancePresetsByCategory}
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
  supplementalTm,
  assistancePresetsByCategory,
}: {
  program: ProgramRow;
  setProgram: (p: ProgramRow) => void;
  settings: SettingsRow;
  snapshot: ActiveProgramSnapshot;
  lift: LiftId;
  prescription: WorkoutPrescription;
  supplementalTm: number;
  assistancePresetsByCategory: AssistancePresetsByCategory;
}) {
  const [mainChecks, setMainChecks] = useState(
    () => prescription.mainSets.map(() => false),
  );
  const [suppChecks, setSuppChecks] = useState(() =>
    prescription.supplemental.map((s) =>
      Array.from({ length: s.sets }, () => false),
    ),
  );
  const [assistanceNotes, setAssistanceNotes] = useState("");
  const [assistanceLines, setAssistanceLines] = useState<AssistanceLine[]>([]);
  const [busy, setBusy] = useState(false);

  const tm = settings.trainingMaxes[lift] ?? 0;
  const increment = settings.roundingIncrement;

  async function handleComplete() {
    if (snapshot.pendingTmBump) {
      window.alert(
        "Clear the TM review card on the Dashboard before advancing workouts.",
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
      const { mainSets: allDoneMain, supplemental: allDoneSupp } =
        completedSessionLogsFromPrescription({
          prescription,
          tm,
          roundingIncrement: increment,
        });

      const mainLogs: SetLogRow[] = allDoneMain.map((row, idx) => ({
        ...row,
        completed: Boolean(mainDone[idx]),
      }));

      const supplementalLogs: SupplementalLogRow[] = allDoneSupp.map(
        (row, supIdx) => {
          const chosen =
            suppChecks[supIdx] ??
            Array.from({ length: row.sets }, () => false);
          return {
            ...row,
            completedSets: chosen,
          };
        },
      );

      const assistanceEntries = stripAssistanceLines(assistanceLines);

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
        assistanceNotes: assistanceNotes.trim(),
        ...(assistanceEntries.length > 0
          ? { assistanceEntries }
          : {}),
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
    <div className="space-y-7">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-400 sm:text-base">
          {prescription.phaseLabel}
        </p>
        <h1 className="text-4xl font-semibold text-white sm:text-5xl">
          {LIFT_LABEL[lift]}
        </h1>
        <p className="text-base text-zinc-400 sm:text-lg">
          TM ·{" "}
          <span className="font-medium text-zinc-100">
            {tm ? `${tm} kg` : `set TM in Setup`}
          </span>
        </p>
        <p className="text-sm leading-relaxed text-zinc-500 sm:text-base">
          Session {snapshot.workoutIndexInMicroWeek + 1} of {snapshot.frequency} this micro-wave week · Phase{" "}
          {snapshot.phase === "leader"
            ? "Leader"
            : snapshot.phase === "anchor"
              ? "Anchor"
              : "Deload"}
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
        <h2 className="text-lg font-medium text-white sm:text-xl">Main work</h2>
        <div className="space-y-3">
          {prescription.mainSets.map((set, idx) => {
            const weight = workingWeightForSet(tm, set.percentTm, increment);
            const checked = mainChecks[idx] ?? false;
            return (
              <label
                key={`${set.label}-${idx}`}
                className="flex cursor-pointer items-start gap-4 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-4"
              >
                <input
                  type="checkbox"
                  className="touch-checkbox mt-1 accent-emerald-500"
                  checked={checked}
                  onChange={(e) =>
                    setMainChecks((prev) => {
                      const next = [...prev];
                      next[idx] = e.target.checked;
                      return next;
                    })
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-lg font-medium text-white">
                      {set.label}
                    </span>
                    <span className="text-base font-medium text-emerald-300 sm:text-lg">
                      {tm ? `${weight} kg` : "—"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500 sm:text-base">
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
        <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-lg font-medium text-white sm:text-xl">
              Supplemental
            </h2>
            <button
              type="button"
              className="min-h-11 shrink-0 rounded-xl border border-zinc-600 bg-zinc-800 px-4 py-2 text-base font-medium text-zinc-100 hover:border-zinc-500 hover:bg-zinc-700 active:bg-zinc-800"
              onClick={() =>
                setSuppChecks(
                  prescription.supplemental.map((block) =>
                    Array.from({ length: block.sets }, () => true),
                  ),
                )
              }
            >
              Mark all sets done
            </button>
          </div>
          {prescription.supplemental.map((block, blockIdx) => (
            <div key={block.label} className="space-y-3">
              <div className="flex flex-wrap justify-between gap-3 text-base sm:text-lg">
                <span className="font-medium text-zinc-300">{block.label}</span>
                <span className="font-medium text-emerald-300">
                  {supplementalTm
                    ? `${block.prescribedWeight} kg · ${Math.round(block.fractionTm * 100)}% TM`
                    : "—"}{" "}
                  × {block.reps} × {block.sets} sets
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-4 md:grid-cols-5">
                {Array.from({ length: block.sets }).map((_, setIdx) => (
                  <label
                    key={`${block.label}-${setIdx}`}
                    className="flex min-h-11 items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 text-base text-zinc-300 sm:justify-center sm:gap-2"
                  >
                    <input
                      type="checkbox"
                      className="touch-checkbox accent-emerald-500"
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

      <AssistanceSection
        hint={prescription.assistanceHint}
        notes={assistanceNotes}
        onNotesChange={setAssistanceNotes}
        lines={assistanceLines}
        onLinesChange={setAssistanceLines}
        presetsByCategory={assistancePresetsByCategory}
      />

      <button
        type="button"
        disabled={busy}
        className="min-h-14 w-full rounded-2xl bg-emerald-600 py-4 text-lg font-semibold text-black hover:bg-emerald-500 disabled:opacity-50 active:bg-emerald-600"
        onClick={() => void handleComplete()}
      >
        Complete workout
      </button>
    </div>
  );
}
