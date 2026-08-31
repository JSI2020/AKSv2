import type { SilhouetteMode } from "@/modules/dress-sizing/core/silhouette";

import { pomKeyToMeasurementKey } from "./measurement-pom-map";
import type { GarmentChartRow } from "./types";

/** Vertical extent of the garment within the ghost frame (not the full canvas). */
export type GarmentFrame = {
  shoulderY: number;
  neckY: number;
  chestY: number;
  waistY: number;
  hipY: number;
  hemY: number;
  ppi: number;
};

export type OverlayLineKind = "girth" | "width" | "vertical" | "diagonal";

/**
 * How far a hanging sleeve falls away from vertical. Set-in sleeves on these
 * cuts sit close to the body, so the line leans out only slightly — enough to
 * follow the sleeve instead of cutting across the skirt.
 */
const SLEEVE_ANGLE_RAD = (11 * Math.PI) / 180;

export type GarmentOverlayLine = {
  pomKey: string;
  measurementKey: string;
  label: string;
  displayLabel: string;
  kind: OverlayLineKind;
  anchorYPx: number;
  yPx: number;
  x1: number;
  x2: number;
};

const TOP_INSET_FRACTION = 0.09;
const BOTTOM_INSET_FRACTION = 0.05;
const SHOULDER_BELOW_TOP_FRACTION = 0.035;

function valueAt(rows: GarmentChartRow[], pomKey: string, size: string) {
  return rows.find((r) => r.pomKey === pomKey)?.values[size];
}

function girthsEqual(rows: GarmentChartRow[], size: string, tolerance = 25) {
  const chest = valueAt(rows, "chest", size);
  const waist = valueAt(rows, "waist", size);
  if (chest == null || waist == null) return false;
  return Math.abs(chest - waist) <= tolerance;
}

/** Length-calibrated Y anchors — hem and length share one hemline. */
export function computeGarmentFrame(
  imageHeightPx: number,
  garmentLengthHundredths: number,
): GarmentFrame {
  const h = imageHeightPx;
  const topInset = Math.round(h * TOP_INSET_FRACTION);
  const bottomInset = Math.round(h * BOTTOM_INSET_FRACTION);
  const shoulderY = topInset + Math.round(h * SHOULDER_BELOW_TOP_FRACTION);
  const drawable = h - topInset - bottomInset;
  const lengthIn = garmentLengthHundredths / 100;
  const ppi = lengthIn > 0 ? drawable / lengthIn : drawable / 50;
  const hemY = Math.min(
    shoulderY + Math.round(lengthIn * ppi),
    h - bottomInset,
  );
  const bodice = Math.max(hemY - shoulderY, 1);

  return {
    shoulderY,
    neckY: Math.max(topInset, shoulderY - Math.round(h * 0.012)),
    chestY: shoulderY + Math.round(bodice * 0.16),
    waistY: shoulderY + Math.round(bodice * 0.4),
    hipY: shoulderY + Math.round(bodice * 0.5),
    hemY,
    ppi,
  };
}

function horizontalSpan(
  imageWidthPx: number,
  kind: OverlayLineKind,
  measureHundredths: number,
  refGirthHundredths: number,
): { x1: number; x2: number } {
  const cx = imageWidthPx * 0.5;
  if (kind === "width" && refGirthHundredths > 0) {
    const ratio = Math.min(
      1,
      Math.max(0.25, measureHundredths / refGirthHundredths),
    );
    const half = (imageWidthPx * 0.64 * ratio) / 2;
    return { x1: cx - half, x2: cx + half };
  }
  const half = (imageWidthPx * 0.62) / 2;
  return { x1: cx - half, x2: cx + half };
}

export function computeGarmentOverlayLines(input: {
  rows: GarmentChartRow[];
  sizeLabel: string;
  imageWidthPx: number;
  imageHeightPx: number;
  silhouette: SilhouetteMode;
  formatValue: (hundredths: number) => string;
}): GarmentOverlayLine[] {
  const { rows, sizeLabel: size, silhouette, formatValue } = input;
  const w = input.imageWidthPx;
  const h = input.imageHeightPx;

  const garmentLength = valueAt(rows, "garmentLength", size) ?? 5100;
  const frame = computeGarmentFrame(h, garmentLength);

  const columnCut =
    silhouette === "column" ||
    silhouette === "a_line" ||
    girthsEqual(rows, size);

  const chest = valueAt(rows, "chest", size);
  const waist = valueAt(rows, "waist", size);
  const hip = valueAt(rows, "hip", size);
  const shoulder = valueAt(rows, "shoulder", size);
  const sleeve = valueAt(rows, "sleeveLength", size);
  const hem = valueAt(rows, "hemWidth", size);
  const neck = valueAt(rows, "neckDrop", size);

  const refGirth = chest ?? hip ?? waist ?? 4500;
  const lines: GarmentOverlayLine[] = [];

  const push = (
    line: Omit<GarmentOverlayLine, "x1" | "x2" | "measurementKey"> & {
      kind: OverlayLineKind;
      measureHundredths: number;
    },
  ) => {
    const { measureHundredths, ...rest } = line;
    const span = horizontalSpan(w, line.kind, measureHundredths, refGirth);
    lines.push({
      ...rest,
      measurementKey: pomKeyToMeasurementKey(line.pomKey) ?? line.pomKey,
      ...span,
    });
  };

  if (shoulder != null) {
    push({
      pomKey: "shoulder",
      label: "Shoulder width",
      displayLabel: formatValue(shoulder),
      kind: "width",
      anchorYPx: frame.shoulderY,
      yPx: frame.shoulderY,
      measureHundredths: shoulder,
    });
  }

  if (chest != null) {
    push({
      pomKey: "chest",
      label: columnCut ? "Body block" : "Chest",
      displayLabel: formatValue(chest),
      kind: "girth",
      anchorYPx: frame.chestY,
      yPx: frame.chestY,
      measureHundredths: chest,
    });
  }

  if (waist != null && !columnCut) {
    push({
      pomKey: "waist",
      label: "Waist",
      displayLabel: formatValue(waist),
      kind: "girth",
      anchorYPx: frame.waistY,
      yPx: frame.waistY,
      measureHundredths: waist,
    });
  }

  if (
    hip != null &&
    !columnCut &&
    (chest == null || Math.abs(hip - chest) > 25)
  ) {
    push({
      pomKey: "hip",
      label: "Hip",
      displayLabel: formatValue(hip),
      kind: "girth",
      anchorYPx: frame.hipY,
      yPx: frame.hipY,
      measureHundredths: hip,
    });
  }

  if (sleeve != null && sleeve > 0) {
    // A sleeve is measured from the shoulder POINT along the sleeve to the
    // cuff, so the line starts at the outer end of the shoulder span and runs
    // down the arm — never straight down through the body.
    const shoulderSpan = horizontalSpan(w, "width", shoulder ?? refGirth, refGirth);
    const startX = shoulderSpan.x2;
    const lengthPx = (sleeve / 100) * frame.ppi;
    const endX = Math.min(
      w * 0.97,
      startX + Math.sin(SLEEVE_ANGLE_RAD) * lengthPx,
    );
    const endY = Math.min(
      frame.hemY,
      frame.shoulderY + Math.cos(SLEEVE_ANGLE_RAD) * lengthPx,
    );
    lines.push({
      pomKey: "sleeveLength",
      measurementKey:
        pomKeyToMeasurementKey("sleeveLength") ?? "sleeveLength",
      label: "Sleeve",
      displayLabel: formatValue(sleeve),
      kind: "diagonal",
      anchorYPx: frame.shoulderY,
      yPx: Math.round(endY),
      x1: Math.round(startX),
      x2: Math.round(endX),
    });
  }

  if (garmentLength != null) {
    const cx = w * 0.9;
    lines.push({
      pomKey: "garmentLength",
      measurementKey:
        pomKeyToMeasurementKey("garmentLength") ?? "garmentLength",
      label: "Length",
      displayLabel: formatValue(garmentLength),
      kind: "vertical",
      anchorYPx: frame.shoulderY,
      yPx: frame.hemY,
      x1: cx,
      x2: cx,
    });
  }

  if (neck != null && neck > 0) {
    const end = frame.neckY + Math.round((neck / 100) * frame.ppi);
    const cx = w * 0.5;
    lines.push({
      pomKey: "neckDrop",
      measurementKey: pomKeyToMeasurementKey("neckDrop") ?? "neckDrop",
      label: "Neck depth",
      displayLabel: formatValue(neck),
      kind: "vertical",
      anchorYPx: frame.neckY,
      yPx: end,
      x1: cx,
      x2: cx,
    });
  }

  if (hem != null) {
    push({
      pomKey: "hemWidth",
      label: "Hem sweep",
      displayLabel: formatValue(hem),
      kind: "girth",
      anchorYPx: frame.hemY,
      yPx: frame.hemY,
      measureHundredths: hem,
    });
  }

  return lines;
}

export { pomKeyToMeasurementKey } from "./measurement-pom-map";
