import type { StandardSize } from "../db/enums";
import { STANDARD_SIZES } from "../db/enums";
import { inchesToHundredths } from "./units";

export const AKS_STANDARD_V1_INCHES: Record<
  StandardSize,
  { bust: number; waist: number; hip: number; shoulder: number; height: number }
> = {
  XS: { bust: 32.5, waist: 24.5, hip: 34.5, shoulder: 14, height: 62 },
  S: { bust: 34.5, waist: 26.5, hip: 36.5, shoulder: 14.5, height: 63 },
  M: { bust: 36.5, waist: 28.5, hip: 38.5, shoulder: 15, height: 64 },
  L: { bust: 38.5, waist: 30.5, hip: 40.5, shoulder: 15.5, height: 65 },
  XL: { bust: 40.5, waist: 32.5, hip: 42.5, shoulder: 16, height: 65 },
  XXL: { bust: 42.5, waist: 34.5, hip: 44.5, shoulder: 16.5, height: 66 },
};

export const AKS_STANDARD_V1_NAME = "AKS Standard v1";

export function aksStandardV1RowsHundredths() {
  return STANDARD_SIZES.map((size) => {
    const row = AKS_STANDARD_V1_INCHES[size];
    return {
      size,
      bust: inchesToHundredths(row.bust),
      waist: inchesToHundredths(row.waist),
      hip: inchesToHundredths(row.hip),
      shoulder: inchesToHundredths(row.shoulder),
      height: inchesToHundredths(row.height),
    };
  });
}
