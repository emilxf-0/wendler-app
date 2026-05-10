"use client";

import { useEffect, useState } from "react";
import { LIFT_LABEL } from "@/lib/domain/types";
import { listSessions } from "@/lib/db";
import type { SessionRow } from "@/lib/db/schema";

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  useEffect(() => {
    void listSessions(40).then(setSessions);
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">History</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Sessions stored locally in your browser (IndexedDB).
        </p>
      </header>

      {sessions.length === 0 ? (
        <p className="text-sm text-zinc-500">No workouts logged yet.</p>
      ) : (
        <ul className="space-y-3">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-lg font-medium text-white">
                    {LIFT_LABEL[session.lift]}
                  </div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    {session.phase} · Week {session.microWeek}
                  </div>
                </div>
                <time
                  className="text-xs text-zinc-400"
                  dateTime={new Date(session.createdAt).toISOString()}
                >
                  {new Date(session.createdAt).toLocaleString()}
                </time>
              </div>
              <div className="mt-3 space-y-1 text-sm text-zinc-400">
                <div className="font-medium text-zinc-200">Main work</div>
                <ul className="space-y-1">
                  {session.mainSets.map((set) => (
                    <li key={set.label} className="flex justify-between gap-2">
                      <span>{set.label}</span>
                      <span>
                        {set.prescribedWeight}{" "}
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
                <div className="mt-3 text-sm text-zinc-400">
                  <div className="font-medium text-zinc-200">Supplemental</div>
                  {session.supplemental.map((supp) => (
                    <div key={supp.label} className="mt-1">
                      {supp.label}:{" "}
                      {supp.completedSets.filter(Boolean).length}/{supp.sets}{" "}
                      sets logged
                    </div>
                  ))}
                </div>
              ) : null}
              {session.assistanceNotes ? (
                <p className="mt-3 rounded-lg bg-zinc-950/60 p-3 text-sm text-zinc-300">
                  {session.assistanceNotes}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
