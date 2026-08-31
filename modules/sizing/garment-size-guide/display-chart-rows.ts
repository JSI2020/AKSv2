import type { SilhouetteMode } from "@/modules/dress-sizing/core/silhouette";

import type { GarmentChartRow } from "./types";

function isSleevelessRow(row: GarmentChartRow): boolean {
  if (row.pomKey !== "sleeveLength") return false;
  return !Object.values(row.values).some((v) => v != null && v > 0);
}

/** Collapse duplicate girth rows for column / A-line cuts (table + overlay labels). */
export function displayGarmentChartRows(
  rows: GarmentChartRow[],
  silhouette: SilhouetteMode,
  baseSize = "M",
): GarmentChartRow[] {
  const chestM = rows.find((r) => r.pomKey === "chest")?.values[baseSize];
  const waistM = rows.find((r) => r.pomKey === "waist")?.values[baseSize];
  const columnLike =
    silhouette === "column" ||
    silhouette === "a_line" ||
    (chestM != null &&
      waistM != null &&
      Math.abs(chestM - waistM) <= 25);

  if (!columnLike) return rows.filter((r) => !isSleevelessRow(r));

  const hipM = rows.find((r) => r.pomKey === "hip")?.values[baseSize];

  return rows
    .filter((r) => {
      if (r.pomKey === "waist") return false;
      if (
        r.pomKey === "hip" &&
        chestM != null &&
        hipM != null &&
        Math.abs(chestM - hipM) <= 25
      ) {
        return false;
      }
      return !isSleevelessRow(r);
    })
    .map((r) =>
      r.pomKey === "chest"
        ? { ...r, label: "Body block (chest / waist / hip)" }
        : r,
    );
}
