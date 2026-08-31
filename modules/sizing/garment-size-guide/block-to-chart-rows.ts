import type { ChartGrid } from "@/modules/sizing/engine";

import { MEASUREMENT_TO_POM } from "./measurement-pom-map";
import type { GarmentChartRow } from "./types";

export function blockGridToGarmentChartRows(input: {
  grid: ChartGrid;
  measurementKeys: string[];
  sizeLabels: string[];
  labelFor: (measurementKey: string) => string;
}): GarmentChartRow[] {
  const { grid, measurementKeys, sizeLabels, labelFor } = input;
  const rows: GarmentChartRow[] = [];

  for (const measurementKey of measurementKeys) {
    const pomKey = MEASUREMENT_TO_POM[measurementKey];
    if (!pomKey) continue;

    const values: Record<string, number> = {};
    for (const size of sizeLabels) {
      const cell = grid[measurementKey]?.[size];
      if (cell?.value != null) values[size] = cell.value;
    }
    if (Object.keys(values).length === 0) continue;

    rows.push({
      pomKey,
      measurementKey,
      label: labelFor(measurementKey),
      values,
    });
  }

  return rows;
}
