import type { TemplateDefinition, TemplateRole } from "./types";

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: "bbb",
    name: "Boring But Big",
    role: "leader",
    shortDescription:
      "Classic 5/3/1 mains plus 5×10 supplemental volume on the same lift — accumulation-focused.",
    recommendedTmNote: "Often run around 85% TM; beginners may start lighter.",
    mainWave: "wendler_531",
    primaryMainSequence: "standard_wave",
    topSet: "amrap",
    supplemental: { kind: "bbb", sets: 5, reps: 10, percentTm: 0.5 },
  },
  {
    id: "fsl_leader",
    name: "First Set Last (Leader)",
    role: "leader",
    shortDescription:
      "5/3/1 mains with conservative extra volume — 5×5 using your first main-work percentage.",
    recommendedTmNote: "Typically 85–90% TM.",
    mainWave: "wendler_531",
    primaryMainSequence: "standard_wave",
    topSet: "amrap",
    supplemental: { kind: "fsl", sets: 5, reps: 5, percentTmFromMainIndex: 0 },
  },
  {
    id: "bbb_351",
    name: "BBB · 3/5/1 waves",
    role: "leader",
    shortDescription:
      "BBB-style volume using Forever 3/5/1 percentage waves instead of classic ordering.",
    recommendedTmNote: "Use an honest TM — supplemental volume adds up quickly.",
    mainWave: "wendler_351",
    primaryMainSequence: "standard_wave",
    topSet: "amrap",
    supplemental: { kind: "bbb", sets: 5, reps: 10, percentTm: 0.6 },
  },
  {
    id: "original_anchor",
    name: "Original 5/3/1",
    role: "anchor",
    shortDescription:
      "Straight 5/3/1 mains with AMRAP tops — minimal prescribed supplemental work.",
    recommendedTmNote: "85–90% TM is the usual sweet spot.",
    mainWave: "wendler_531",
    primaryMainSequence: "standard_wave",
    topSet: "amrap",
    supplemental: { kind: "none" },
  },
  {
    id: "pr_fsl_anchor",
    name: "PR Set + FSL",
    role: "anchor",
    shortDescription:
      "Treat the top set as a strong PR or goal set, then back off with 5×5 FSL.",
    recommendedTmNote: "Keep TM conservative so bar speed stays honest.",
    mainWave: "wendler_531",
    primaryMainSequence: "standard_wave",
    topSet: "pr_goal",
    supplemental: { kind: "fsl", sets: 5, reps: 5, percentTmFromMainIndex: 0 },
  },
  {
    id: "fives_pro_fsl_anchor",
    name: "5's PRO + FSL",
    role: "anchor",
    shortDescription:
      "All prescribed main sets at 5 reps (no AMRAP), then FSL volume — steady and repeatable.",
    recommendedTmNote: "Works well around 85–90% TM.",
    mainWave: "wendler_531",
    primaryMainSequence: "standard_wave",
    topSet: "fixed",
    supplemental: { kind: "fsl", sets: 5, reps: 5, percentTmFromMainIndex: 0 },
  },
];

const byId = Object.fromEntries(TEMPLATES.map((t) => [t.id, t])) as Record<
  string,
  TemplateDefinition
>;

export function getTemplate(id: string): TemplateDefinition | undefined {
  return byId[id];
}

/** BBB volume as fraction of TM for a Leader template (50% fallback if not BBB). */
export function defaultBbbFractionForLeaderTemplate(
  leaderTemplateId: string,
): number {
  const t = getTemplate(leaderTemplateId);
  return t?.supplemental.kind === "bbb" ? t.supplemental.percentTm : 0.5;
}

export function templatesForRole(role: Exclude<TemplateRole, "either">) {
  return TEMPLATES.filter(
    (t) => t.role === role || t.role === "either",
  );
}
