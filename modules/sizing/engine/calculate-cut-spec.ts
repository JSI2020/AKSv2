export type CutSpecFabric = {
  /** Integer 0–100. Reduces ease proportionally when > 0. */
  stretchPercent: number;
  /** Hundredths of an inch — added so the finished garment is correct after wash. */
  shrinkageAllowance: number;
};

export type CutSpecFitProfile = {
  easeByMeasurement: Readonly<Record<string, number>>;
};

export type CalculateCutSpecInput = {
  /** Resolved chart size OR customer's own measurements — same code path. */
  body: Readonly<Record<string, number>>;
  fitProfile: CutSpecFitProfile;
  fabric: CutSpecFabric;
  /** Design length overrides — replace computed value, still plus shrinkage. */
  designLengths?: Readonly<Record<string, number>>;
};

export type CutSpec = Record<string, number>;

/** Round to nearest 0.25″ (25 hundredths). */
export function roundToQuarterInch(value: number): number {
  return Math.round(value / 25) * 25;
}

/**
 * One calculator for standard size and made-to-measure.
 * body + ease (reduced by stretch) + shrinkage; designLengths replace then +shrinkage.
 *
 * BOTTOM_OPENING ease values from fit profiles are absolute finished openings
 * (silhouette targets), not additive ease — matching applyFitEase.
 */
export function calculateCutSpec(input: CalculateCutSpecInput): CutSpec {
  const keys = new Set<string>([
    ...Object.keys(input.body),
    ...Object.keys(input.fitProfile.easeByMeasurement),
    ...Object.keys(input.designLengths ?? {}),
  ]);

  const spec: CutSpec = {};
  const stretch = Math.max(0, Math.min(100, input.fabric.stretchPercent));
  const shrinkage = input.fabric.shrinkageAllowance;

  for (const key of keys) {
    const designLen = input.designLengths?.[key];
    if (designLen !== undefined) {
      spec[key] = roundToQuarterInch(designLen + shrinkage);
      continue;
    }

    const profileEase = input.fitProfile.easeByMeasurement[key];
    const body = input.body[key];

    if (key === "BOTTOM_OPENING" && profileEase !== undefined) {
      spec[key] = roundToQuarterInch(profileEase + shrinkage);
      continue;
    }

    if (body === undefined) continue;

    let ease = profileEase ?? 0;
    if (stretch > 0) {
      ease = Math.round((ease * (100 - stretch)) / 100);
    }
    spec[key] = roundToQuarterInch(body + ease + shrinkage);
  }

  return spec;
}
