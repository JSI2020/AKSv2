import type { FitIntent, GarmentType, LengthBand } from "../db/enums";
import { FIT_LABELS, GARMENT_LABELS, LENGTH_LABELS } from "../ui/labels";
export function HowChartWasBuilt({ fitIntent, lengthBand, templateKey }: {
  fitIntent: FitIntent; lengthBand: LengthBand; templateKey: GarmentType;
}) {
  return <p className="text-[12px] text-chalk">Built from the {GARMENT_LABELS[templateKey]} template with {LENGTH_LABELS[lengthBand].toLowerCase()} length and {FIT_LABELS[fitIntent].toLowerCase()} ease. Photo recognition never estimates measurements.</p>;
}
