"use client";

import { useEffect, useMemo, useState } from "react";
import { defaultActiveProgram } from "@/lib/domain/programFlow";
import { templatesForRole } from "@/lib/domain/templates";
import { loadProgram, saveProgram } from "@/lib/db";
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
      <p className="text-sm text-zinc-400" aria-live="polite">
        Loading program…
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-white">Program</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Pick a Leader template for volume phases and an Anchor template for
          sharper intensity work. Deload weeks bridge the two automatically.
        </p>
        {savedFlash ? (
          <p className="mt-2 text-sm text-emerald-400" role="status">
            Saved locally on this device.
          </p>
        ) : null}
      </header>

      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="font-medium text-white">Weekly frequency</h2>
        <div className="flex flex-wrap gap-3">
          {[3, 4].map((f) => (
            <button
              key={f}
              type="button"
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                row.frequency === f
                  ? "bg-emerald-600 text-black"
                  : "border border-zinc-700 text-zinc-200 hover:bg-zinc-900"
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

      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="font-medium text-white">Cycle targets</h2>
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Leader cycles before deload</span>
            <input
              type="number"
              min={1}
              max={6}
              className="w-28 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              value={row.leaderCyclesTarget}
              onChange={(e) =>
                void persist({
                  ...row,
                  leaderCyclesTarget: Number(e.target.value),
                })
              }
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Anchor cycles before TM review</span>
            <input
              type="number"
              min={1}
              max={6}
              className="w-28 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
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

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="font-medium text-white">Danger zone</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Reset programming progress but keep training maxes intact.
        </p>
        <button
          type="button"
          className="mt-3 rounded-lg border border-red-800 px-3 py-2 text-sm text-red-200 hover:bg-red-950/60"
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

      <details className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-400">
        <summary className="cursor-pointer text-white">Debug snapshot</summary>
        <pre className="mt-3 overflow-x-auto text-xs text-zinc-500">
          {JSON.stringify(row, null, 2)}
        </pre>
      </details>
    </div>
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
    <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="font-medium text-white">{title}</h2>
      <div className="grid gap-3">
        {templates.map((t) => {
          const active = t.id === selectedId;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                active
                  ? "border-emerald-600 bg-emerald-950/40"
                  : "border-zinc-800 hover:border-zinc-600"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-white">{t.name}</span>
                {active ? (
                  <span className="text-xs uppercase tracking-wide text-emerald-400">
                    Selected
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-zinc-400">{t.shortDescription}</p>
              <p className="mt-2 text-xs text-zinc-500">{t.recommendedTmNote}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
