import type {
  LiftId,
  MicroWeek,
  Phase,
  TemplateDefinition,
  MainSetPrescription,
} from "./types";
import {
  buildDeloadMainSets,
  buildMainSets,
  firstMainWorkingPercent,
} from "./mainWork";
import { roundWorkingWeight } from "./rounding";

export interface SupplementalRow {
  label: string;
  sets: number;
  reps: number;
  /** Fraction of TM used for this supplemental work */
  fractionTm: number;
  prescribedWeight: number;
}

export interface WorkoutPrescription {
  lift: LiftId;
  phaseLabel: string;
  microWeek: number;
  mainSets: MainSetPrescription[];
  supplemental: SupplementalRow[];
  assistanceHint: string;
}

function supplementalRows(params: {
  tm: number;
  roundingIncrement: number;
  template: TemplateDefinition;
  microWeek: MicroWeek;
}): SupplementalRow[] {
  const { tm, roundingIncrement, template, microWeek } = params;
  const spec = template.supplemental;
  if (spec.kind === "none") return [];

  if (spec.kind === "bbb") {
    const fractionTm = spec.percentTm;
    const prescribedWeight = roundWorkingWeight(
      tm * fractionTm,
      roundingIncrement,
    );
    return [
      {
        label: "BBB supplemental (same lift)",
        sets: spec.sets,
        reps: spec.reps,
        fractionTm,
        prescribedWeight,
      },
    ];
  }

  const fractionTm = firstMainWorkingPercent(template.mainWave, microWeek);
  const prescribedWeight = roundWorkingWeight(
    tm * fractionTm,
    roundingIncrement,
  );
  return [
    {
      label: "FSL supplemental",
      sets: spec.sets,
      reps: spec.reps,
      fractionTm,
      prescribedWeight,
    },
  ];
}

export function assistanceHintFor(template: TemplateDefinition): string {
  if (template.supplemental.kind === "bbb") {
    return "Push / Pull / Single-leg·Core — aim roughly 25–50 reps per category; favor easier variants while volume is high.";
  }
  return "Push / Pull / Single-leg·Core — commonly 50–100 reps per category; adjust down if recovery slips.";
}

export function buildWorkoutPrescription(params: {
  lift: LiftId;
  template: TemplateDefinition;
  phase: Phase;
  microWeek: MicroWeek;
  tm: number;
  roundingIncrement: number;
}): WorkoutPrescription {
  const { lift, template, phase, microWeek, tm, roundingIncrement } = params;

  const phaseLabel =
    phase === "leader"
      ? `Leader · Week ${microWeek}`
      : phase === "anchor"
        ? `Anchor · Week ${microWeek}`
        : "7th week · Deload";

  const mainSets =
    phase === "deload"
      ? buildDeloadMainSets()
      : buildMainSets({
          variant: template.mainWave,
          microWeek,
          topSet: template.topSet,
        });

  const supplemental =
    phase === "deload"
      ? []
      : supplementalRows({ tm, roundingIncrement, template, microWeek });

  return {
    lift,
    phaseLabel,
    microWeek,
    mainSets,
    supplemental,
    assistanceHint: assistanceHintFor(template),
  };
}

export function workingWeightForSet(
  tm: number,
  percentTm: number,
  roundingIncrement: number,
): number {
  return roundWorkingWeight(tm * percentTm, roundingIncrement);
}
