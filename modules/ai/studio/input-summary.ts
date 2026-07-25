import type { DesignInputRole } from "./input-roles";

type SummaryInput = { role: DesignInputRole };

function countRole(inputs: readonly SummaryInput[], role: DesignInputRole): number {
  return inputs.filter((i) => i.role === role).length;
}

function plural(n: number, singular: string, pluralForm?: string): string {
  if (n === 1) return `1 ${singular}`;
  return `${n} ${pluralForm ?? `${singular}s`}`;
}

/** Live summary of what the pipeline will do with the current input set. */
export function buildInputSummary(inputs: readonly SummaryInput[]): string {
  if (inputs.length === 0) {
    return "Drop sketches, fabric swatches, or references to begin.";
  }

  const parts: string[] = [];
  const front = countRole(inputs, "SKETCH_FRONT");
  const back = countRole(inputs, "SKETCH_BACK");
  const side = countRole(inputs, "SKETCH_SIDE");
  const detail = countRole(inputs, "SKETCH_DETAIL");
  const flat = countRole(inputs, "TECHNICAL_FLAT");
  const fabric = countRole(inputs, "FABRIC_SWATCH");
  const ownRef = countRole(inputs, "REFERENCE_OWN");
  const extRef = countRole(inputs, "REFERENCE_EXTERNAL");

  if (front) parts.push(plural(front, "front sketch"));
  if (back) parts.push(plural(back, "back sketch"));
  if (side) parts.push(plural(side, "side sketch"));
  if (detail) parts.push(plural(detail, "detail"));
  if (flat) parts.push(plural(flat, "technical flat", "technical flats"));
  if (fabric) parts.push(plural(fabric, "fabric"));
  if (ownRef) parts.push(plural(ownRef, "own reference", "own references"));
  if (extRef) parts.push(plural(extRef, "external reference", "external references"));

  const angleNotes: string[] = [];
  if (back) angleNotes.push("the back angle will follow your back sketch");
  if (side) angleNotes.push("the three-quarter angle will follow your side sketch");
  if (detail && !back && !side) {
    angleNotes.push("details will raise embroidery fidelity on every stage");
  }

  let summary = parts.join(" · ");
  if (angleNotes.length > 0) {
    summary += ` — ${angleNotes.join("; ")}.`;
  }

  return summary;
}
