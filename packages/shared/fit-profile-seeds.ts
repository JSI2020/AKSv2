import { inches } from "./size-block-seeds";

export type FitProfileSeed = {
  name: string;
  categoryKey: string;
  /** Hundredths of an inch. BOTTOM_OPENING is absolute finished opening. */
  easeByMeasurement: Record<string, number>;
  /** 0–100; display as factor/100. */
  clingFactorBps: number;
  isDefault?: boolean;
  notes?: string;
  sortOrder: number;
};

export const FIT_PROFILE_SEEDS: readonly FitProfileSeed[] = [
  {
    name: "Palazzo",
    categoryKey: "TROUSER",
    easeByMeasurement: {
      WAIST: inches(1),
      HIP: inches(8),
      BOTTOM_OPENING: inches(24),
    },
    clingFactorBps: 30,
    isDefault: true,
    notes: "REPLACEABLE placeholder silhouette ease.",
    sortOrder: 10,
  },
  {
    name: "Loose shalwar",
    categoryKey: "TROUSER",
    easeByMeasurement: {
      WAIST: inches(2),
      HIP: inches(10),
      BOTTOM_OPENING: inches(16),
    },
    clingFactorBps: 25,
    notes: "REPLACEABLE placeholder silhouette ease.",
    sortOrder: 20,
  },
  {
    name: "Cigarette pant",
    categoryKey: "TROUSER",
    easeByMeasurement: {
      WAIST: inches(0.5),
      HIP: inches(2),
      BOTTOM_OPENING: inches(12),
    },
    clingFactorBps: 85,
    notes: "REPLACEABLE placeholder silhouette ease.",
    sortOrder: 30,
  },
  {
    name: "Straight kameez",
    categoryKey: "KAMEEZ",
    easeByMeasurement: {
      WAIST: inches(4),
      HIP: inches(4),
    },
    clingFactorBps: 40,
    isDefault: true,
    notes: "REPLACEABLE placeholder silhouette ease.",
    sortOrder: 10,
  },
  {
    name: "Fitted gown",
    categoryKey: "GOWN",
    easeByMeasurement: {
      WAIST: inches(1.5),
      HIP: inches(2),
    },
    clingFactorBps: 90,
    isDefault: true,
    notes: "REPLACEABLE placeholder silhouette ease.",
    sortOrder: 10,
  },
];

/**
 * Apply ease to body measurements.
 * BOTTOM_OPENING in a fit profile is an absolute finished opening (silhouette).
 */
export function applyFitEase(
  body: Readonly<Record<string, number>>,
  easeByMeasurement: Readonly<Record<string, number>>,
): Record<string, number> {
  const finished: Record<string, number> = { ...body };
  for (const [key, ease] of Object.entries(easeByMeasurement)) {
    if (key === "BOTTOM_OPENING") {
      finished[key] = ease;
    } else {
      finished[key] = (body[key] ?? 0) + ease;
    }
  }
  return finished;
}
