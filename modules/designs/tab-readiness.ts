import {
  evaluatePublishChecklist,
  type PublishChecklistColourway,
} from "./publish-checklist";

export type DesignEditorTab =
  | "Details"
  | "Photos"
  | "Sizing"
  | "Costing"
  | "Price"
  | "Preview";

/** Which editor tab owns each checklist gap. */
export function tabReadiness(input: {
  design: {
    name: string;
    basePriceMinor: number;
    fabricConsumptionMeters: number;
    sizeBlockId: string | null;
    fitProfileIds: Record<string, string> | null;
    components?: string[];
  };
  colourways: PublishChecklistColourway[];
  renders: { colourwayId: string; angle: string; altText: string }[];
  tags: { kind: string; value: string }[];
}): {
  missing: string[];
  tabOk: Record<DesignEditorTab, boolean>;
  ready: boolean;
} {
  const missing = evaluatePublishChecklist(input);
  const joined = missing.join(" · ").toLowerCase();

  const photosOk =
    !joined.includes("colourway") &&
    !joined.includes("render") &&
    !joined.includes("alt text");
  const sizingOk =
    !joined.includes("size block") && !joined.includes("fit profile");
  const priceOk =
    !joined.includes("base price") && !joined.includes("fabric consumption");
  const detailsOk =
    Boolean(input.design.name.trim()) &&
    (input.design.components?.length ?? 0) >= 1 &&
    !joined.includes("occasion tag");

  const tabOk: Record<DesignEditorTab, boolean> = {
    Details: detailsOk,
    Photos: photosOk,
    Sizing: sizingOk,
    Costing: priceOk,
    Price: priceOk,
    Preview: missing.length === 0,
  };

  return { missing, tabOk, ready: missing.length === 0 };
}
