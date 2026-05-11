/** Min / max supplemental load expressed as fraction of supplemental TM */
export const SUPPLEMENTAL_TM_FRACTION_MIN = 0.05;
export const SUPPLEMENTAL_TM_FRACTION_MAX = 1;

export function clampSupplementalTmFraction(raw: number): number {
  return Math.min(
    SUPPLEMENTAL_TM_FRACTION_MAX,
    Math.max(SUPPLEMENTAL_TM_FRACTION_MIN, raw),
  );
}

/** Interprets stored settings: `null`/missing = use template or wave-derived %. */
export function parseSupplementalPercentOverride(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n > 1 && n <= 100) return clampSupplementalTmFraction(n / 100);
  if (n < SUPPLEMENTAL_TM_FRACTION_MIN || n > SUPPLEMENTAL_TM_FRACTION_MAX)
    return null;
  return clampSupplementalTmFraction(n);
}
