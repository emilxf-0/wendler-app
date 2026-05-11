"use client";

import Link from "next/link";
import { startTransition, useCallback, useEffect, useState } from "react";
import {
  clearTmBumpHold,
  defaultSettings,
  finishTmBumpReset,
  rowToSnapshot,
} from "@/lib/domain/programFlow";
import { applyTmBumps, safeTmBumpKg, standardBumpDeltas } from "@/lib/domain/tm";
import {
  loadProgram,
  loadSettings,
  persistSettingsAndProgram,
  saveProgram,
} from "@/lib/db";

export default function HomePage() {
  const [pendingBump, setPendingBump] = useState(false);
  const [tmRestartToLeader, setTmRestartToLeader] = useState(false);
  const [phaseLabel, setPhaseLabel] = useState("");
  const [microWeek, setMicroWeek] = useState(1);

  const reloadDashboard = useCallback(async () => {
    const program = await loadProgram();
    setPendingBump(Boolean(program.pendingTmBump));
    setTmRestartToLeader(program.pendingTmRestartToLeader ?? false);
    setMicroWeek(program.microWeek);
    const phase =
      program.phase === "leader"
        ? "Leader"
        : program.phase === "anchor"
          ? "Anchor"
          : "7th week · Deload";
    setPhaseLabel(phase);
  }, []);

  useEffect(() => {
    startTransition(() => {
      void reloadDashboard();
    });
  }, [reloadDashboard]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Dashboard
        </h1>
        <p className="mt-3 text-base leading-relaxed text-zinc-400 sm:text-lg">
          Current phase:{" "}
          <span className="font-medium text-zinc-200">{phaseLabel}</span>
          <span className="text-zinc-500">
            {" "}
            · Micro-wave week {microWeek}
          </span>
        </p>
      </div>

      {pendingBump ? (
        <TmBumpCard
          reloadDashboard={reloadDashboard}
          restartLeaderAfterReview={tmRestartToLeader}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/workout/today"
          className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-5 py-6 transition hover:border-emerald-700/60 hover:bg-zinc-900 sm:min-h-[8.5rem]"
        >
          <div className="text-xl font-semibold text-white">Log today</div>
          <p className="mt-2 text-base leading-relaxed text-zinc-400">
            Prescribed mains, supplemental work, and assistance notes.
          </p>
        </Link>
        <Link
          href="/program"
          className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-5 py-6 transition hover:border-emerald-700/60 hover:bg-zinc-900 sm:min-h-[8.5rem]"
        >
          <div className="text-xl font-semibold text-white">Program</div>
          <p className="mt-2 text-base leading-relaxed text-zinc-400">
            Leader template, Anchor template, and weekly frequency.
          </p>
        </Link>
        <Link
          href="/setup"
          className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-5 py-6 transition hover:border-emerald-700/60 hover:bg-zinc-900 sm:min-h-[8.5rem]"
        >
          <div className="text-xl font-semibold text-white">Training maxes</div>
          <p className="mt-2 text-base leading-relaxed text-zinc-400">
            Kilogram TMs, rounding, TM bumps, and suggested TM from reps.
          </p>
        </Link>
        <Link
          href="/history"
          className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-5 py-6 transition hover:border-emerald-700/60 hover:bg-zinc-900 sm:min-h-[8.5rem]"
        >
          <div className="text-xl font-semibold text-white">History</div>
          <p className="mt-2 text-base leading-relaxed text-zinc-400">
            Recent sessions saved on this device.
          </p>
        </Link>
      </div>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
        <h2 className="text-lg font-medium text-white sm:text-xl">
          TM sanity check
        </h2>
        <p className="mt-3 text-base leading-relaxed text-zinc-400 sm:text-lg">
          Forever programming expects conservative training maxes so bar speed
          stays honest — typically around 85–90% of an estimated 1RM. Increase
          TM only by small steps between blocks unless testing dictates
          otherwise.
        </p>
      </section>
    </div>
  );
}

function TmBumpCard({
  reloadDashboard,
  restartLeaderAfterReview,
}: {
  reloadDashboard: () => Promise<void>;
  restartLeaderAfterReview: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [bumpNotice, setBumpNotice] = useState<string>("");

  useEffect(() => {
    void loadSettings().then((s) => {
      const defs = defaultSettings();
      const upper = safeTmBumpKg(s.tmBumpUpper, defs.tmBumpUpper);
      const lower = safeTmBumpKg(s.tmBumpLower, defs.tmBumpLower);
      setBumpNotice(
        `From Setup · upper-body TM +${upper} kg (bench / press) · lower-body TM +${lower} kg (squat / deadlift).`,
      );
    });
  }, []);

  async function applyAutomaticBump() {
    const ok = restartLeaderAfterReview
      ? window.confirm(
          "Apply standard TM bumps from Setup (upper / lower, kg) and restart in Leader week 1?",
        )
      : window.confirm(
          "Apply standard TM bumps from Setup (upper / lower, kg) and continue your program?",
        );
    if (!ok) return;
    setBusy(true);
    try {
      const defs = defaultSettings();
      const latestSettings = await loadSettings();
      const row = await loadProgram();

      const upper = safeTmBumpKg(latestSettings.tmBumpUpper, defs.tmBumpUpper);
      const lower = safeTmBumpKg(latestSettings.tmBumpLower, defs.tmBumpLower);
      const deltas = standardBumpDeltas({
        tmBumpUpper: upper,
        tmBumpLower: lower,
      });
      const nextTms = applyTmBumps(latestSettings.trainingMaxes, deltas);
      const nextSettings = {
        ...latestSettings,
        tmBumpUpper: upper,
        tmBumpLower: lower,
        trainingMaxes: nextTms,
      };
      const snap = rowToSnapshot(row);
      const nextProgramRow = {
        ...row,
        ...(restartLeaderAfterReview
          ? finishTmBumpReset(snap)
          : clearTmBumpHold(snap)),
      };
      const wrote = await persistSettingsAndProgram(nextSettings, nextProgramRow);
      if (!wrote) {
        window.alert(
          "Could not save to this browser’s storage — often Safari private mode blocks IndexedDB. Try a normal window or another browser.",
        );
        return;
      }
      await reloadDashboard();
    } catch (e) {
      console.error(e);
      window.alert(
        e instanceof Error
          ? e.message
          : "Something went wrong while applying TM bumps.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function skipAutomaticBump() {
    const ok = restartLeaderAfterReview
      ? window.confirm(
          "Skip automatic bumps and restart in Leader week 1? Adjust TMs manually in Setup if needed.",
        )
      : window.confirm(
          "Dismiss without applying automatic bumps and continue where you left off?",
        );
    if (!ok) return;
    setBusy(true);
    try {
      const row = await loadProgram();
      const snap = rowToSnapshot(row);
      const wrote = await saveProgram({
        ...row,
        ...(restartLeaderAfterReview
          ? finishTmBumpReset(snap)
          : clearTmBumpHold(snap)),
      });
      if (!wrote) {
        window.alert(
          "Could not save program progress to this browser’s storage (IndexedDB). Check private mode settings.",
        );
        return;
      }
      await reloadDashboard();
    } catch (e) {
      console.error(e);
      window.alert(
        e instanceof Error
          ? e.message
          : "Something went wrong while clearing the TM hold.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-amber-700/50 bg-amber-950/40 p-5 sm:p-6">
      <h2 className="text-xl font-semibold text-amber-50 sm:text-2xl">
        Training max review
      </h2>
      <p className="mt-3 text-base leading-relaxed text-amber-200/85 sm:text-lg">
        {restartLeaderAfterReview
          ? "Anchor block finished. Review or bump TMs — after you continue below, programming restarts in Leader week 1."
          : "You finished a 3-week wave. Review or bump TMs before the next workout (optional auto bump uses values from Setup)."}
      </p>
      {bumpNotice ? (
        <p className="mt-4 text-base text-amber-100/80">{bumpNotice}</p>
      ) : null}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled={busy}
          className="min-h-12 rounded-xl bg-amber-600 px-5 py-3 text-base font-semibold text-black hover:bg-amber-500 disabled:opacity-50 active:bg-amber-600 sm:min-w-[12rem]"
          onClick={() => void applyAutomaticBump()}
        >
          Apply bumps & continue
        </button>
        <button
          type="button"
          disabled={busy}
          className="min-h-12 rounded-xl border border-zinc-600 px-5 py-3 text-base font-medium text-zinc-100 hover:bg-zinc-900 disabled:opacity-50 sm:min-w-[12rem]"
          onClick={() => void skipAutomaticBump()}
        >
          Skip bumps (manual TM)
        </button>
      </div>
    </div>
  );
}
