export const DESIGN_INPUT_ROLES = [
  "SKETCH_FRONT",
  "SKETCH_BACK",
  "SKETCH_SIDE",
  "SKETCH_DETAIL",
  "TECHNICAL_FLAT",
  "FABRIC_SWATCH",
  "REFERENCE_OWN",
  "REFERENCE_EXTERNAL",
] as const;

export type DesignInputRole = (typeof DESIGN_INPUT_ROLES)[number];

export const SKETCH_INPUT_ROLES = [
  "SKETCH_FRONT",
  "SKETCH_BACK",
  "SKETCH_SIDE",
  "SKETCH_DETAIL",
  "TECHNICAL_FLAT",
] as const satisfies readonly DesignInputRole[];

export type SketchInputRole = (typeof SKETCH_INPUT_ROLES)[number];

export const EXTERNAL_ATTESTATION_STATEMENT =
  "I have the right to use this reference, or it is being used for general mood only.";

/** Days until external reference assets are purged. */
export const EXTERNAL_REFERENCE_PURGE_DAYS = 90;

export const DESIGN_INPUT_ROLE_LABELS: Record<DesignInputRole, string> = {
  SKETCH_FRONT: "Front sketch",
  SKETCH_BACK: "Back sketch",
  SKETCH_SIDE: "Side sketch",
  SKETCH_DETAIL: "Detail",
  TECHNICAL_FLAT: "Technical flat",
  FABRIC_SWATCH: "Fabric swatch",
  REFERENCE_OWN: "Own reference",
  REFERENCE_EXTERNAL: "External reference",
};

export function isSketchRole(role: DesignInputRole): role is SketchInputRole {
  return (SKETCH_INPUT_ROLES as readonly string[]).includes(role);
}

/** Guess role from filename — always overridable in UI. */
export function inferRoleFromFilename(filename: string): DesignInputRole {
  const name = filename.toLowerCase();
  if (/\bfront\b|[_-]front|front[_-]/.test(name)) return "SKETCH_FRONT";
  if (/\bback\b|[_-]back|back[_-]|\brear\b/.test(name)) return "SKETCH_BACK";
  if (/\bside\b|\b3.?4\b|\bthree.?quarter\b/.test(name)) return "SKETCH_SIDE";
  if (/\bdetail\b|\bembroidery\b|\bcuff\b|\bneck/.test(name)) return "SKETCH_DETAIL";
  if (/\bflat\b|\btechnical\b|\btech_/.test(name)) return "TECHNICAL_FLAT";
  if (/\bfabric\b|\bswatch\b|\btextile\b/.test(name)) return "FABRIC_SWATCH";
  if (/\bown\b|\baks\b|\barchive\b|\bpast\b/.test(name)) return "REFERENCE_OWN";
  if (/\bref\b|\breference\b|\binspo\b|\bmood\b/.test(name)) return "REFERENCE_EXTERNAL";
  return "SKETCH_FRONT";
}
