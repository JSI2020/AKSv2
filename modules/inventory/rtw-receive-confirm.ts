import { formatMetres } from "@/modules/ui/metres/format";

/**
 * Copy shown before a finished-piece receive. Cloth deduction stays
 * metres-per-piece × quantity (integer hundredths). Zero costing is called
 * out so the refusal is not a surprise.
 */
export function rtwReceiveDeductionCopy(
  pieces: number,
  metresPerPieceHundredths: number,
): string {
  const noun = pieces === 1 ? "piece" : "pieces";
  if (
    !Number.isInteger(metresPerPieceHundredths) ||
    metresPerPieceHundredths <= 0
  ) {
    return `Receiving ${pieces} ${noun} deducts cloth from the fabric lot. Costing metres are not set, so this receive will be refused.`;
  }
  const total = pieces * metresPerPieceHundredths;
  return `Receiving ${pieces} ${noun} deducts ${formatMetres(total)} of cloth (${formatMetres(metresPerPieceHundredths)} each).`;
}
