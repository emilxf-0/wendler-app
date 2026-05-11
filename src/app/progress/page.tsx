"use client";

import { useCallback, useEffect, startTransition, useState } from "react";
import { usePathname } from "next/navigation";
import { LiftProgressSection } from "@/components/LiftProgressSection";
import { listAllSessions } from "@/lib/db";
import type { SessionRow } from "@/lib/db/schema";

export default function ProgressPage() {
  const pathname = usePathname();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reloadFromHistory = useCallback(async () => {
    setLoadError(null);
    try {
      const rows = await listAllSessions();
      startTransition(() => setSessions(rows));
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "Could not read workout history from this device.";
      setLoadError(msg);
    }
  }, []);

  useEffect(() => {
    if (pathname !== "/progress") return;
    void reloadFromHistory();
  }, [pathname, reloadFromHistory]);

  useEffect(() => {
    function onPageShow(ev: PageTransitionEvent) {
      if (ev.persisted) void reloadFromHistory();
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [reloadFromHistory]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">
          Progress
        </h1>
        <p className="mt-3 text-base leading-relaxed text-zinc-400 sm:text-lg">
          Charts use your full workout history from IndexedDB (same source as the
          History tab): every stored session, oldest to newest. Weight is in kg —
          each point is the heaviest main set you marked complete that session.
        </p>
        {sessions.length > 0 ? (
          <p className="mt-2 text-sm text-zinc-500 sm:text-base">
            Loaded {sessions.length} session{sessions.length === 1 ? "" : "s"} from
            history.
          </p>
        ) : null}
        {loadError ? (
          <p className="mt-2 text-base text-red-400" role="alert">
            {loadError}
          </p>
        ) : null}
      </header>

      <LiftProgressSection sessions={sessions} />
    </div>
  );
}
