import type {
  LiftId,
  MicroWeek,
  Phase,
  TemplateDefinition,
  MainSetPrescription,
} from "./types";
import { LIFT_LABEL } from "./types";
import {
  buildDeloadMainSets,
  buildMainSets,
  mainWorkingPercentAtStep,
} from "./mainWork";
import { roundWorkingWeight } from "./rounding";
import { clampSupplementalTmFraction } from "./supplementalPercent";

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
  supplementalLift: LiftId;
  supplementalTm: number;
  roundingIncrement: number;
  template: TemplateDefinition;
  microWeek: MicroWeek;
  supplementalBbbPercentOverride: number | null;
}): SupplementalRow[] {
  const {
    supplementalLift,
    supplementalTm,
    roundingIncrement,
    template,
    microWeek,
    supplementalBbbPercentOverride,
  } = params;
  const tmLabel = LIFT_LABEL[supplementalLift];
  const spec = template.supplemental;
  if (spec.kind === "none") return [];

  if (spec.kind === "bbb") {
    let fractionTm = spec.percentTm;
    if (
      supplementalBbbPercentOverride !== null &&
      Number.isFinite(supplementalBbbPercentOverride)
    ) {
      fractionTm = clampSupplementalTmFraction(supplementalBbbPercentOverride);
    }
    const prescribedWeight = roundWorkingWeight(
      supplementalTm * fractionTm,
      roundingIncrement,
    );
    const pct = Math.round(fractionTm * 100);
    return [
      {
        label: `BBB supplemental · ${tmLabel} TM · ${pct}%`,
        sets: spec.sets,
        reps: spec.reps,
        fractionTm,
        prescribedWeight,
      },
    ];
  }

  const fractionTm =
    spec.kind === "wave_step_volume"
      ? mainWorkingPercentAtStep(
          template.mainWave,
          microWeek,
          spec.waveStep,
        )
      : mainWorkingPercentAtStep(
          template.mainWave,
          microWeek,
          spec.percentTmFromMainIndex,
        );
  const prescribedWeight = roundWorkingWeight(
    supplementalTm * fractionTm,
    roundingIncrement,
  );
  const pct = Math.round(fractionTm * 100);
  return [
    {
      label: `FSL supplemental · ${tmLabel} TM · ${pct}%`,
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
  /** Training max for supplemental work (may differ from main when using paired-lift mode). */
  supplementalLift: LiftId;
  supplementalTm: number;
  roundingIncrement: number;
  supplementalBbbPercentOverride: number | null;
}): WorkoutPrescription {
  const {
    lift,
    template,
    phase,
    microWeek,
    supplementalLift,
    supplementalTm,
    roundingIncrement,
    supplementalBbbPercentOverride,
  } = params;

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
      : supplementalRows({
          supplementalLift,
          supplementalTm,
          roundingIncrement,
          template,
          microWeek,
          supplementalBbbPercentOverride,
        });

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
