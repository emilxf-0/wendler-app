"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { finishTmBumpReset, rowToSnapshot } from "@/lib/domain/programFlow";
import { applyTmBumps, standardBumpDeltas } from "@/lib/domain/tm";
import {
  loadProgram,
  loadSettings,
  saveProgram,
  saveSettings,
} from "@/lib/db";

export default function HomePage() {
  const [pendingBump, setPendingBump] = useState(false);
  const [phaseLabel, setPhaseLabel] = useState("");
  const [microWeek, setMicroWeek] = useState(1);

  useEffect(() => {
    void (async () => {
      const program = await loadProgram();
      setPendingBump(program.pendingTmBump);
      setMicroWeek(program.microWeek);
      const phase =
        program.phase === "leader"
          ? "Leader"
          : program.phase === "anchor"
            ? "Anchor"
            : "7th week · Deload";
      setPhaseLabel(phase);
    })();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Dashboard
        </h1>
        <p className="mt-2 text-zinc-400">
          Current phase:{" "}
          <span className="font-medium text-zinc-200">{phaseLabel}</span>
          <span className="text-zinc-500">
            {" "}
            · Micro-wave week {microWeek}
          </span>
        </p>
      </div>

      {pendingBump ? (
        <TmBumpCard onApplied={() => setPendingBump(false)} />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/workout/today"
          className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-5 transition hover:border-emerald-700/60 hover:bg-zinc-900"
        >
          <div className="text-lg font-medium text-white">Log today</div>
          <p className="mt-1 text-sm text-zinc-400">
            Prescribed mains, supplemental work, and assistance notes.
          </p>
        </Link>
        <Link
          href="/program"
          className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-5 transition hover:border-emerald-700/60 hover:bg-zinc-900"
        >
          <div className="text-lg font-medium text-white">Program</div>
          <p className="mt-1 text-sm text-zinc-400">
            Leader template, Anchor template, and weekly frequency.
          </p>
        </Link>
        <Link
          href="/setup"
          className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-5 transition hover:border-emerald-700/60 hover:bg-zinc-900"
        >
          <div className="text-lg font-medium text-white">Training maxes</div>
          <p className="mt-1 text-sm text-zinc-400">
            Units, rounding, TM bumps, and suggested TM from reps.
          </p>
        </Link>
        <Link
          href="/history"
          className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-5 transition hover:border-emerald-700/60 hover:bg-zinc-900"
        >
          <div className="text-lg font-medium text-white">History</div>
          <p className="mt-1 text-sm text-zinc-400">
            Recent sessions saved on this device.
          </p>
        </Link>
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="font-medium text-white">TM sanity check</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          Forever programming expects conservative training maxes so bar speed
          stays honest — typically around 85–90% of an estimated 1RM. Increase TM
          only by small steps between blocks unless testing dictates otherwise.
        </p>
      </section>
    </div>
  );
}

function TmBumpCard({ onApplied }: { onApplied: () => void }) {
  const [busy, setBusy] = useState(false);

  async function applyAutomaticBump() {
    const ok = window.confirm(
      "Apply standard TM bumps from Setup (upper / lower) and start the next Leader block?",
    );
    if (!ok) return;
    setBusy(true);
    try {
      const settings = await loadSettings();
      const row = await loadProgram();
      const deltas = standardBumpDeltas({
        tmBumpUpper: settings.tmBumpUpper,
        tmBumpLower: settings.tmBumpLower,
      });
      const nextTms = applyTmBumps(settings.trainingMaxes, deltas);
      await saveSettings({ ...settings, trainingMaxes: nextTms });
      await saveProgram({
        ...row,
        ...finishTmBumpReset(rowToSnapshot(row)),
      });
      onApplied();
    } finally {
      setBusy(false);
    }
  }

  async function skipAutomaticBump() {
    const ok = window.confirm(
      "Skip automatic bumps and only reset programming to Leader week 1? Edit TM manually in Setup.",
    );
    if (!ok) return;
    setBusy(true);
    try {
      const row = await loadProgram();
      await saveProgram({
        ...row,
        ...finishTmBumpReset(rowToSnapshot(row)),
      });
      onApplied();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-700/50 bg-amber-950/40 p-4">
      <h2 className="font-semibold text-amber-100">
        Training max bump pending
      </h2>
      <p className="mt-2 text-sm text-amber-200/80">
        Anchor block finished. Apply your usual small jumps (defaults: upper-body +
        bump size / lower-body + bump size), review them on the Setup page, then
        roll into the next Leader phase.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-black hover:bg-amber-500 disabled:opacity-50"
          onClick={() => void applyAutomaticBump()}
        >
          Apply bumps & continue
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
          onClick={() => void skipAutomaticBump()}
        >
          Skip bumps (manual TM)
        </button>
      </div>
    </div>
  );
}
