import type {
  BodyDimension, FitIntent, FitWeightDimension, GarmentType, LengthBand,
  PomKey, PomKind, StandardSize, StyleCategory,
} from "../db/enums";

/** All measurement values are integer hundredths of an inch. */
export type BodyMeasurements = {
  bust: number;
  waist: number;
  hip: number;
  shoulder: number;
  height: number;
};

export type BodyGrid = Record<StandardSize, BodyMeasurements>;
export type StylePomSpec = {
  key: PomKey;
  kind: PomKind;
  derivedFrom: BodyDimension | null;
  ease: number | null;
  baseValue: number | null;
  gradeIncrement: number;
};
export type ComposeStyle = { baseSize: StandardSize; poms: StylePomSpec[] };
export type GeneratedRow = {
  size: StandardSize;
  pomKey: PomKey;
  valueHundredths: number;
};
export type FitWeight = { dimension: FitWeightDimension; weight: number };
export type InstantiatedStyle = {
  name: string;
  templateKey: GarmentType;
  category: StyleCategory;
  baseSize: StandardSize;
  lengthBand: LengthBand;
  fitIntent: FitIntent;
  poms: StylePomSpec[];
  fitWeights: FitWeight[];
};
export type ShopperBody = {
  bust: number;
  waist: number;
  hip: number;
  height?: number;
};
