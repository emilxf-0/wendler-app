/**
 * Round working weight to nearest increment (barbell-friendly).
 */
export function roundWorkingWeight(
  raw: number,
  increment: number,
): number {
  if (increment <= 0) return raw;
  return Math.round(raw / increment) * increment;
}
