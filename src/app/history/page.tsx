"use client";

import { useEffect, useRef, startTransition, useState } from "react";
import {
  ASSISTANCE_CATEGORY_ORDER,
  CATEGORY_LABEL,
  assistanceCategoryOf,
  assistanceDisplayName,
  type AssistanceCategory,
  type CustomAssistanceExercise,
} from "@/lib/domain/assistanceCatalog";
import { LIFT_LABEL } from "@/lib/domain/types";
import {
  clearAllSessions,
  deleteSession,
  listAllSessions,
  loadSettings,
  recordBackupExportSuccess,
  replaceFromFullBackup,
  serializeFullBackupForDownload,
} from "@/lib/db";
import type { SettingsRow } from "@/lib/db/schema";
import {
  formatAssistanceEntry,
  type AssistanceEntryStored,
  type SessionRow,
} from "@/lib/db/schema";

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState<number | null>(null);
  const [clearAllBusy, setClearAllBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const [s, rows] = await Promise.all([loadSettings(), listAllSessions()]);
    startTransition(() => {
      setSettings(s);
      setSessions(rows);
    });
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function downloadOrShareJson(filename: string, json: string) {
    const blob = new Blob([json], { type: "application/json" });
    const file = new File([blob], filename, { type: "application/json" });

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "Wendler backup",
        });
        return true;
      } catch (e) {
        const name =
          typeof e === "object" &&
          e !== null &&
          "name" in e &&
          typeof (e as Error).name === "string"
            ? (e as Error).name
            : "";
        if (name === "AbortError") return false;
      }
    }

    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function handleBackupExport() {
    setBackupBusy(true);
    try {
      const json = await serializeFullBackupForDownload();
      if (!json) {
        window.alert("Could not build a backup.");
        return;
      }
      const day = new Date().toISOString().slice(0, 10);
      const ok = await downloadOrShareJson(`wendler-backup-${day}.json`, json);
      if (!ok) return;
      const wrote = await recordBackupExportSuccess();
      if (wrote) {
        const next = await loadSettings();
        setSettings(next);
      }
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleImportPick(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setImportBusy(true);
    try {
      const okReplace = window.confirm(
        "Import replaces ALL workout history plus your current setup and program on this device. Continue?",
      );
      if (!okReplace) return;
      let text = "";
      try {
        text = await file.text();
      } catch {
        window.alert("Could not read this file.");
        return;
      }
      const result = await replaceFromFullBackup(text);
      if (!result.ok) {
        window.alert(result.error);
        return;
      }
      await refresh();
      window.alert(`Import complete (${result.sessionCount} sessions restored).`);
    } finally {
      setImportBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteSession(session: SessionRow) {
    if (session.id == null) return;
    const when = new Date(session.createdAt).toLocaleString();
    const ok = window.confirm(
      `Remove this logged workout (${LIFT_LABEL[session.lift]} · ${when})? This does not move your program back a step — only the history entry is deleted.`,
    );
    if (!ok) return;
    setDeleteBusyId(session.id);
    try {
      const did = await deleteSession(session.id);
      if (!did) {
        window.alert("Could not delete this workout.");
        return;
      }
      await refresh();
    } finally {
      setDeleteBusyId(null);
    }
  }

  async function handleClearAllSessions() {
    if (sessions.length === 0) return;
    const ok = window.confirm(
      `Delete all ${sessions.length} logged workouts on this device? Your setup and current program stay the same.`,
    );
    if (!ok) return;
    setClearAllBusy(true);
    try {
      const did = await clearAllSessions();
      if (!did) {
        window.alert("Could not clear workout history.");
        return;
      }
      await refresh();
    } finally {
      setClearAllBusy(false);
    }
  }

  const backupLabel =
    settings?.lastBackupAt != null ? (
      <span>
        Last backup:{" "}
        <time
          dateTime={new Date(settings.lastBackupAt).toISOString()}
          className="font-medium text-zinc-300"
        >
          {new Date(settings.lastBackupAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </time>
      </span>
    ) : (
      <span className="text-zinc-500">You have not finished a backup on this device yet.</span>
    );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">History</h1>
        <p className="mt-3 text-base leading-relaxed text-zinc-400 sm:text-lg">
          Sessions stored locally in your browser (IndexedDB). Weight is in kg. Keeps full
          history for many years — use backup before clearing site data or switching devices.
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5 sm:p-6">
        <h2 className="text-lg font-medium text-white sm:text-xl">
          Backup &amp; import
        </h2>
        <p className="mt-3 text-base leading-relaxed text-zinc-400 sm:text-lg">
          Download a JSON file with your workouts, setup, and program. Use Files or share to save
          a copy on iCloud. Importing restores a file exported from this app and overwrites local
          data.
        </p>
        <p className="mt-3 text-sm text-zinc-500 sm:text-base">{backupLabel}</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            disabled={backupBusy || importBusy}
            onClick={() => void handleBackupExport()}
            className="min-h-11 rounded-xl border border-emerald-700/70 bg-emerald-950/40 px-5 py-2.5 text-base font-medium text-white transition enabled:hover:bg-emerald-950/65 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {backupBusy ? "Saving…" : "Download backup"}
          </button>
          <button
            type="button"
            disabled={backupBusy || importBusy}
            onClick={() => fileInputRef.current?.click()}
            className="min-h-11 rounded-xl border border-zinc-700 bg-zinc-900/60 px-5 py-2.5 text-base font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importBusy ? "Importing…" : "Import backup…"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            aria-hidden
            onChange={(e) => void handleImportPick(e.target.files)}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5 sm:p-6">
        <h2 className="text-lg font-medium text-white sm:text-xl">Delete workout logs</h2>
        <p className="mt-3 text-base leading-relaxed text-zinc-400 sm:text-lg">
          Drop individual sessions below, or wipe every logged workout — useful after a bad import or synthetic
          backfill test. Downloads and progress charts reflect what remains in history.
        </p>
        <div className="mt-5">
          <button
            type="button"
            disabled={
              backupBusy ||
              importBusy ||
              clearAllBusy ||
              deleteBusyId != null ||
              sessions.length === 0
            }
            onClick={() => void handleClearAllSessions()}
            className="min-h-11 rounded-xl border border-rose-800/80 bg-rose-950/30 px-5 py-2.5 text-base font-medium text-rose-100 transition hover:border-rose-600 hover:bg-rose-950/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {clearAllBusy ? "Clearing…" : "Clear all workout history"}
          </button>
        </div>
      </section>

      {sessions.length === 0 ? (
        <p className="text-base text-zinc-500 sm:text-lg">
          No workouts logged yet.
        </p>
      ) : (
        <ul className="space-y-4">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-2xl font-semibold text-white">
                    {LIFT_LABEL[session.lift]}
                  </div>
                  <div className="mt-1 text-sm font-medium uppercase tracking-wide text-zinc-500 sm:text-base">
                    {session.phase} · Week {session.microWeek}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-start justify-end gap-2">
                  <time
                    className="text-sm text-zinc-400 sm:text-base"
                    dateTime={new Date(session.createdAt).toISOString()}
                  >
                    {new Date(session.createdAt).toLocaleString()}
                  </time>
                  {session.id != null ? (
                    <button
                      type="button"
                      disabled={
                        backupBusy ||
                        importBusy ||
                        clearAllBusy ||
                        deleteBusyId != null
                      }
                      onClick={() => void handleDeleteSession(session)}
                      className="min-h-9 rounded-lg border border-rose-800/70 bg-transparent px-3 py-1.5 text-sm font-medium text-rose-200/95 transition hover:border-rose-500 hover:bg-rose-950/40 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deleteBusyId === session.id ? "Removing…" : "Delete"}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 space-y-2 text-base text-zinc-400 sm:text-lg">
                {session.warmupSets?.length ? (
                  <>
                    <div className="font-semibold text-zinc-200">Warmup</div>
                    <ul className="space-y-2">
                      {session.warmupSets.map((set) => (
                        <li
                          key={`warmup-${set.label}`}
                          className="flex flex-wrap justify-between gap-2 leading-snug"
                        >
                          <span>{set.label}</span>
                          <span className="shrink-0">
                            {set.prescribedWeight} kg ·{" "}
                            {set.completed ? (
                              <span className="text-emerald-400">done</span>
                            ) : (
                              <span className="text-amber-400">skipped</span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                <div className="font-semibold text-zinc-200">Main work</div>
                <ul className="space-y-2">
                  {session.mainSets.map((set) => (
                    <li
                      key={set.label}
                      className="flex flex-wrap justify-between gap-2 leading-snug"
                    >
                      <span>{set.label}</span>
                      <span className="shrink-0">
                        {set.prescribedWeight} kg ·{" "}
                        {set.completed ? (
                          <span className="text-emerald-400">done</span>
                        ) : (
                          <span className="text-amber-400">skipped</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              {session.supplemental.length ? (
                <div className="mt-4 text-base text-zinc-400 sm:text-lg">
                  <div className="font-semibold text-zinc-200">Supplemental</div>
                  {session.supplemental.map((supp) => (
                    <div key={supp.label} className="mt-2 leading-snug">
                      {supp.label}:{" "}
                      {supp.completedSets.filter(Boolean).length}/{supp.sets}{" "}
                      sets logged ({supp.prescribedWeight} kg)
                    </div>
                  ))}
                </div>
              ) : null}
              {session.assistanceEntries?.length ||
              session.assistanceNotes?.trim() ? (
                <SessionAssistanceBlock
                  session={session}
                  customExercises={settings?.customAssistanceExercises ?? []}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function clusterByExercise(entries: AssistanceEntryStored[]) {
  const order: string[] = [];
  const map = new Map<string, AssistanceEntryStored[]>();
  for (const e of entries) {
    const id = e.exerciseId;
    if (!map.has(id)) {
      order.push(id);
      map.set(id, []);
    }
    map.get(id)!.push(e);
  }
  return order.map((exerciseId) => ({
    exerciseId,
    items: map.get(exerciseId)!,
  }));
}

function SessionAssistanceBlock({
  session,
  customExercises,
}: {
  session: SessionRow;
  customExercises: CustomAssistanceExercise[];
}) {
  const entries = session.assistanceEntries ?? [];
  const notes = session.assistanceNotes?.trim() ?? "";

  const unknown: AssistanceEntryStored[] = [];
  const byCat = new Map<AssistanceCategory, AssistanceEntryStored[]>();
  for (const c of ASSISTANCE_CATEGORY_ORDER) {
    byCat.set(c, []);
  }

  for (const e of entries) {
    const cat = assistanceCategoryOf(e.exerciseId, customExercises);
    if (cat) byCat.get(cat)!.push(e);
    else unknown.push(e);
  }

  const hasStructured = entries.length > 0;

  return (
    <div className="mt-4 space-y-4 rounded-xl bg-zinc-950/50 p-4">
      <div className="font-semibold text-zinc-200">Assistance</div>
      {hasStructured ? (
        <div className="space-y-5 text-base leading-snug text-zinc-300 sm:text-lg">
          {ASSISTANCE_CATEGORY_ORDER.map((cat) => {
            const list = byCat.get(cat) ?? [];
            if (!list.length) return null;
            const clusters = clusterByExercise(list);
            return (
              <div key={cat}>
                <div className="text-sm font-semibold uppercase tracking-wide text-emerald-400/90 sm:text-base">
                  {CATEGORY_LABEL[cat]}
                </div>
                <div className="mt-2 space-y-3">
                  {clusters.map(({ exerciseId, items }) => (
                    <div key={exerciseId}>
                      <div className="font-medium text-zinc-100">
                        {assistanceDisplayName(exerciseId, customExercises)}
                      </div>
                      <ul className="mt-1 list-inside list-disc space-y-1 text-zinc-400">
                        {items.map((item, i) => (
                          <li key={`${exerciseId}-${i}`}>
                            {formatAssistanceEntry(item)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {unknown.length ? (
            <div>
              <div className="text-sm font-semibold uppercase tracking-wide text-zinc-400 sm:text-base">
                Other
              </div>
              <div className="mt-2 space-y-3">
                {clusterByExercise(unknown).map(({ exerciseId, items }) => (
                  <div key={exerciseId}>
                    <div className="font-medium text-zinc-100">
                      {assistanceDisplayName(exerciseId, customExercises)}
                    </div>
                    <ul className="mt-1 list-inside list-disc space-y-1 text-zinc-400">
                      {items.map((item, i) => (
                        <li key={`${exerciseId}-o-${i}`}>
                          {formatAssistanceEntry(item)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {notes ? (
        <p className="text-base leading-relaxed text-zinc-400 sm:text-lg">{notes}</p>
      ) : null}
    </div>
  );
}
