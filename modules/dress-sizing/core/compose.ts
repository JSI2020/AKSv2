import { SIZE_INDEX, STANDARD_SIZES } from "../db/enums";
import type { BodyDimension, StandardSize } from "../db/enums";
import type { BodyGrid, BodyMeasurements, ComposeStyle, GeneratedRow } from "./types";

export function bodyGridFromRows(
  rows: Array<{ size: StandardSize } & BodyMeasurements>,
): BodyGrid {
  const grid = {} as BodyGrid;
  for (const size of STANDARD_SIZES) {
    const row = rows.find((candidate) => candidate.size === size);
    if (!row) throw new Error(`Body grid is missing size ${size}`);
    grid[size] = {
      bust: row.bust, waist: row.waist, hip: row.hip,
      shoulder: row.shoulder, height: row.height,
    };
  }
  return grid;
}

export function composeChart(grid: BodyGrid, style: ComposeStyle): GeneratedRow[] {
  const baseIndex = SIZE_INDEX[style.baseSize];
  const rows: GeneratedRow[] = [];
  for (const size of STANDARD_SIZES) {
    const body = grid[size];
    for (const pom of style.poms) {
      let valueHundredths: number;
      if (pom.kind === "girth") {
        if (pom.derivedFrom === null) {
          throw new Error(`Girth POM ${pom.key} is missing derivedFrom`);
        }
        const dimension = pom.derivedFrom satisfies BodyDimension;
        valueHundredths = body[dimension] + (pom.ease ?? 0);
      } else {
        if (pom.baseValue === null) {
          throw new Error(`Design POM ${pom.key} is missing baseValue`);
        }
        valueHundredths =
          pom.baseValue + pom.gradeIncrement * (SIZE_INDEX[size] - baseIndex);
      }
      rows.push({ size, pomKey: pom.key, valueHundredths: Math.round(valueHundredths) });
    }
  }
  return rows;
}
