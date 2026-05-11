/** Parses a controlled input value — empty input is undefined, never coerced to 0. */
export function optionalFiniteNumberFromInput(raw: string): number | undefined {
  const s = String(raw).trim();
  if (s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}
