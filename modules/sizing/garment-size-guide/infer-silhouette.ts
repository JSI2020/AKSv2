import {
  SILHOUETTE_LABELS,
  type SilhouetteMode,
} from "@/modules/dress-sizing/core/silhouette";
import { inchesToHundredths } from "@/modules/dress-sizing/core/units";

import type { GarmentChartRow } from "./types";

const GIRTH_TOLERANCE = 25;
const FLARE_ABOVE_GIRTH = inchesToHundredths(4);

export function inferSilhouetteFromChartRows(
  rows: GarmentChartRow[],
  baseSize = "M",
): { mode: SilhouetteMode; label: string } {
  const chest = rows.find((r) => r.pomKey === "chest")?.values[baseSize];
  const waist = rows.find((r) => r.pomKey === "waist")?.values[baseSize];
  const hem = rows.find((r) => r.pomKey === "hemWidth")?.values[baseSize];

  let mode: SilhouetteMode = "waisted";

  if (
    chest != null &&
    waist != null &&
    Math.abs(chest - waist) <= GIRTH_TOLERANCE
  ) {
    if (hem != null && hem > chest + FLARE_ABOVE_GIRTH) {
      mode = "a_line";
    } else {
      mode = "column";
    }
  }

  return { mode, label: SILHOUETTE_LABELS[mode] };
}
