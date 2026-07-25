export function buildIdempotencyKey(input: {
  designId: string;
  stage: "HERO" | "ANGLE" | "COLOURWAY";
  angle?: string | null;
  colourwayId?: string | null;
  attemptN: number;
}): string {
  const angle = input.angle?.trim() || "_";
  const colourway = input.colourwayId ?? "_";
  return `${input.designId}:${input.stage}:${angle}:${colourway}:${input.attemptN}`;
}

export function parseIdempotencyKey(key: string): {
  designId: string;
  stage: string;
  angle: string;
  colourwayId: string;
  attemptN: number;
} | null {
  const parts = key.split(":");
  if (parts.length !== 5) return null;
  const attemptN = Number.parseInt(parts[4] ?? "", 10);
  if (!Number.isInteger(attemptN) || attemptN < 1) return null;
  return {
    designId: parts[0] ?? "",
    stage: parts[1] ?? "",
    angle: parts[2] ?? "_",
    colourwayId: parts[3] ?? "_",
    attemptN,
  };
}
