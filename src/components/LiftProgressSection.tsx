"use client";

import { useMemo } from "react";
import { LiftProgressChart } from "@/components/LiftProgressChart";
import { progressionSeriesForLift } from "@/lib/domain/liftProgression";
import { LIFTS, LIFT_LABEL, type LiftId } from "@/lib/domain/types";
import type { SessionRow } from "@/lib/db/schema";

export function LiftProgressSection({ sessions }: { sessions: SessionRow[] }) {
  const byLift = useMemo(() => {
    return LIFTS.reduce(
      (acc, lift) => {
        acc[lift] = progressionSeriesForLift(sessions, lift);
        return acc;
      },
      {} as Record<LiftId, ReturnType<typeof progressionSeriesForLift>>,
    );
  }, [sessions]);

  const anyPoints = LIFTS.some((l) => byLift[l].length > 0);

  return (
    <section className="space-y-6" aria-label="Lift progression charts">
      {!anyPoints ? (
        <p className="text-base text-zinc-500 sm:text-lg">
          Complete at least one main set when you log a workout to see lines here.
        </p>
      ) : null}

      <div className="space-y-6">
        {LIFTS.map((lift) => (
          <LiftProgressChart
            key={lift}
            title={LIFT_LABEL[lift]}
            points={byLift[lift]}
          />
        ))}
      </div>
    </section>
  );
}
