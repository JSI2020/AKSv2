import type { DesignInputRole } from "./input-roles";

export type PromptProfileOrigin = "SKETCH_LED" | "REFERENCE_LED" | "FABRIC_LED";

const SKETCH_ROLES = new Set<DesignInputRole>([
  "SKETCH_FRONT",
  "SKETCH_BACK",
  "SKETCH_SIDE",
  "SKETCH_DETAIL",
  "TECHNICAL_FLAT",
]);

const REFERENCE_ROLES = new Set<DesignInputRole>([
  "REFERENCE_OWN",
  "REFERENCE_EXTERNAL",
]);

/** Infer studio mode from uploaded input roles. */
export function inferPromptProfileOrigin(
  roles: readonly DesignInputRole[],
): PromptProfileOrigin {
  if (roles.some((r) => r === "SKETCH_FRONT" || SKETCH_ROLES.has(r))) {
    return "SKETCH_LED";
  }
  if (roles.some((r) => REFERENCE_ROLES.has(r))) {
    return "REFERENCE_LED";
  }
  if (roles.includes("FABRIC_SWATCH")) {
    return "FABRIC_LED";
  }
  return "SKETCH_LED";
}

export const ORIGIN_LABELS: Record<PromptProfileOrigin, string> = {
  SKETCH_LED: "Sketch-led",
  REFERENCE_LED: "Reference-led",
  FABRIC_LED: "Fabric-led",
};

export const ORIGIN_HINTS: Record<PromptProfileOrigin, string> = {
  SKETCH_LED: "Sketches anchor structure and angle consistency.",
  REFERENCE_LED: "No sketch lock — expect more hero iterations.",
  FABRIC_LED: "Exploratory from fabric alone — still passes the hero loop.",
};
