import type { LiftId } from "@/lib/domain/types";
import type { SessionRow } from "@/lib/db/schema";

export interface LiftProgressPoint {
  at: number;
  kg: number;
}

/** Heaviest completed main-bar weight for a session (kg). */
export function peakCompletedMainKg(session: SessionRow): number | null {
  let peak: number | null = null;
  for (const s of session.mainSets) {
    if (!s.completed) continue;
    const w =
      s.actualWeight != null && Number.isFinite(s.actualWeight)
        ? s.actualWeight
        : s.prescribedWeight;
    if (!Number.isFinite(w) || w <= 0) continue;
    peak = peak == null ? w : Math.max(peak, w);
  }
  return peak;
}

/** Newest-first input is fine — points are returned oldest → newest. */
export function progressionSeriesForLift(
  sessions: SessionRow[],
  lift: LiftId,
): LiftProgressPoint[] {
  const rows = sessions
    .filter((s) => s.lift === lift)
    .map((s) => {
      const kg = peakCompletedMainKg(s);
      return kg == null ? null : { at: s.createdAt, kg };
    })
    .filter((p): p is LiftProgressPoint => p != null);

  rows.sort((a, b) => a.at - b.at);
  return rows;
}
