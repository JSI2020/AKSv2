/** Finished-garment chart row for overlay + size table (values in hundredths of an inch). */
export type GarmentChartRow = {
  pomKey: string;
  /** House size-block measurement key (BUST, WAIST, …). */
  measurementKey: string;
  label: string;
  values: Record<string, number>;
};
