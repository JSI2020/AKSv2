import { and, eq } from "drizzle-orm";

import {
  colourways,
  db,
  designGenerations,
  designRenders,
  designs,
} from "@aks/db";
import { uuidv7, type RenderAngle } from "@aks/shared";

const ANGLE_LABEL: Record<RenderAngle, string> = {
  FRONT: "Front",
  THREE_QUARTER: "Three-quarter",
  BACK: "Back",
  DETAIL: "Detail",
};

/** Write a succeeded manual-studio generation into design_renders for the Photos tab / storefront. */
export async function promoteManualStudioGeneration(
  row: typeof designGenerations.$inferSelect,
): Promise<void> {
  if (
    row.stage !== "COLOURWAY" ||
    !row.colourwayId ||
    !row.outputAssetId ||
    !row.angle
  ) {
    return;
  }

  const promptPayload = row.promptJson as Record<string, unknown>;
  if (!promptPayload.manualStudio) return;

  const [design] = await db
    .select({ name: designs.name })
    .from(designs)
    .where(eq(designs.id, row.designId))
    .limit(1);
  const [cw] = await db
    .select({ name: colourways.name })
    .from(colourways)
    .where(eq(colourways.id, row.colourwayId))
    .limit(1);

  const angle = row.angle as RenderAngle;
  const designName = design?.name ?? "Design";
  const colourwayName = cw?.name ?? "Colour";

  await db
    .delete(designRenders)
    .where(
      and(
        eq(designRenders.designId, row.designId),
        eq(designRenders.colourwayId, row.colourwayId),
        eq(designRenders.angle, angle),
        eq(designRenders.isAiGenerated, true),
      ),
    );

  await db.insert(designRenders).values({
    id: uuidv7(),
    designId: row.designId,
    colourwayId: row.colourwayId,
    angle,
    assetId: row.outputAssetId,
    isAiGenerated: true,
    altText: `${designName} — ${colourwayName} — ${ANGLE_LABEL[angle]}`,
    sortOrder: 0,
  });
}
