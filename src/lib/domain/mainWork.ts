import type {
  MainSetPrescription,
  MainWaveVariant,
  MicroWeek,
  TopSetKind,
} from "./types";

/** Percentages for each micro-week (1-indexed week in the 3-week wave). */
const W531_PERCENTS: Record<MicroWeek, [number, number, number]> = {
  1: [0.65, 0.75, 0.85],
  2: [0.7, 0.8, 0.9],
  3: [0.75, 0.85, 0.95],
};

/** Forever-style 3/5/1 waves for supplemental-heavy prescriptions (5's-style reps). */
const W351_PERCENTS: Record<MicroWeek, [number, number, number]> = {
  1: [0.7, 0.8, 0.9],
  2: [0.65, 0.75, 0.85],
  3: [0.75, 0.85, 0.95],
};

const REP_SCHEME_AMRAP: Record<MicroWeek, [number, number, number]> = {
  1: [5, 5, 5],
  2: [3, 3, 3],
  3: [5, 3, 1],
};

const REP_SCHEME_FIVES_PRO: Record<MicroWeek, [number, number, number]> = {
  1: [5, 5, 5],
  2: [5, 5, 5],
  3: [5, 5, 5],
};

function percentsForVariant(variant: MainWaveVariant, microWeek: MicroWeek) {
  return variant === "wendler_531"
    ? W531_PERCENTS[microWeek]
    : W351_PERCENTS[microWeek];
}

export function buildMainSets(params: {
  variant: MainWaveVariant;
  microWeek: MicroWeek;
  topSet: TopSetKind;
}): MainSetPrescription[] {
  const { variant, microWeek, topSet } = params;
  const p = percentsForVariant(variant, microWeek);
  const repsFixed =
    topSet === "fixed" || topSet === "pr_goal"
      ? REP_SCHEME_FIVES_PRO[microWeek]
      : REP_SCHEME_AMRAP[microWeek];

  const sets: MainSetPrescription[] = [];

  for (let i = 0; i < 3; i++) {
    const pct = p[i];
    const isTop = i === 2;
    let repsTarget: MainSetPrescription["repsTarget"];
    if (!isTop) {
      repsTarget = repsFixed[i];
    } else if (topSet === "fixed" || topSet === "pr_goal") {
      repsTarget = repsFixed[i];
    } else {
      repsTarget = "amrap";
    }

    const pctLabel = `${Math.round(pct * 100)}%`;
    sets.push({
      percentTm: pct,
      repsTarget,
      label:
        repsTarget === "amrap"
          ? `${pctLabel} × ${repsFixed[i]}+`
          : `${pctLabel} × ${repsTarget}`,
    });
  }

  return sets;
}

/** Deload / 7th-week-style lighter progression — simplified gym prescription per lift. */
export function buildDeloadMainSets(): MainSetPrescription[] {
  return [
    { percentTm: 0.7, repsTarget: 5, label: "70% × 5" },
    { percentTm: 0.8, repsTarget: 5, label: "80% × 3–5" },
    { percentTm: 0.9, repsTarget: 1, label: "90% × 1" },
    { percentTm: 1.0, repsTarget: 1, label: "TM × 1 (easy)" },
  ];
}

export function firstMainWorkingPercent(
  variant: MainWaveVariant,
  microWeek: MicroWeek,
): number {
  return percentsForVariant(variant, microWeek)[0];
}
