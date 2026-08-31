/** Dress-sizing POM keys ↔ house size-block measurement keys. */
export const POM_TO_MEASUREMENT: Record<string, string> = {
  chest: "BUST",
  waist: "WAIST",
  hip: "HIP",
  shoulder: "SHOULDER",
  sleeveLength: "SLEEVE_LENGTH",
  garmentLength: "LENGTH",
  hemWidth: "SWEEP",
  neckDrop: "NECK_DEPTH_FRONT",
};

export const MEASUREMENT_TO_POM: Record<string, string> = Object.fromEntries(
  Object.entries(POM_TO_MEASUREMENT).map(([pom, mk]) => [mk, pom]),
);

export function pomKeyToMeasurementKey(pomKey: string): string | null {
  return POM_TO_MEASUREMENT[pomKey] ?? null;
}

export function measurementKeyToPomKey(measurementKey: string): string | null {
  return MEASUREMENT_TO_POM[measurementKey] ?? null;
}
