import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import type { GalleryAngle, SizeMode } from "./types";

export const GALLERY_ANGLES = [
  "FRONT",
  "THREE_QUARTER",
  "BACK",
] as const satisfies readonly GalleryAngle[];

export const SIZE_MODES = [
  "STANDARD",
  "MADE_TO_MEASURE",
] as const satisfies readonly SizeMode[];

/** Colourway slug or id in the URL. */
export const designDetailParsers = {
  colourway: parseAsString,
  angle: parseAsStringLiteral(GALLERY_ANGLES).withDefault("FRONT"),
  sizeMode: parseAsStringLiteral(SIZE_MODES).withDefault("STANDARD"),
  sizeLabel: parseAsString,
  qty: parseAsInteger.withDefault(1),
};
