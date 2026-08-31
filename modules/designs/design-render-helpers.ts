import type { DesignDetail } from "./actions";
import { isFabricSwatchRender } from "./fabric-swatch-render";

type DesignRender = DesignDetail["renders"][number];

export function photosForColourway(
  renders: DesignRender[],
  colourwayId: string,
): DesignRender[] {
  const photos = renders
    .filter((r) => r.colourwayId === colourwayId && !r.isAiGenerated)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.angle.localeCompare(b.angle));

  const fabricSwatches = photos.filter(isFabricSwatchRender);
  const garmentPhotos = photos.filter((r) => !isFabricSwatchRender(r));
  return [...garmentPhotos, ...fabricSwatches];
}
