import { eq } from "drizzle-orm";

import {
  sizeBlockCells,
  sizeBlockRows,
  sizeBlocks,
  type Database,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Deep-copy a size block (header + rows + pinned cells) for a design.
 * Source block rows/cells are not mutated.
 */
export async function forkSizeBlockInTx(
  tx: Tx,
  sourceBlockId: string,
  ownerDesignId: string,
  _actorId: string,
): Promise<string> {
  const sources = await tx
    .select()
    .from(sizeBlocks)
    .where(eq(sizeBlocks.id, sourceBlockId))
    .limit(1);
  const source = sources[0];
  if (!source) throw new Error("Source block not found");

  const newId = uuidv7();
  await tx.insert(sizeBlocks).values({
    id: newId,
    name: `${source.name} · design fork`,
    categoryId: source.categoryId,
    isDefault: false,
    ownerDesignId,
    sizeLabels: [...source.sizeLabels],
    baseSizeLabel: source.baseSizeLabel,
    notes: source.notes,
    active: true,
  });

  const rows = await tx
    .select()
    .from(sizeBlockRows)
    .where(eq(sizeBlockRows.blockId, sourceBlockId));

  for (const row of rows) {
    await tx.insert(sizeBlockRows).values({
      id: uuidv7(),
      blockId: newId,
      measurementKey: row.measurementKey,
      baseValue: row.baseValue,
      gradeIncrement: row.gradeIncrement,
      gradeOverrides: row.gradeOverrides ?? {},
      sortOrder: row.sortOrder,
    });
  }

  const cells = await tx
    .select()
    .from(sizeBlockCells)
    .where(eq(sizeBlockCells.blockId, sourceBlockId));

  for (const cell of cells) {
    await tx.insert(sizeBlockCells).values({
      blockId: newId,
      measurementKey: cell.measurementKey,
      sizeLabel: cell.sizeLabel,
      value: cell.value,
      isPinned: cell.isPinned,
      editedById: cell.editedById,
      editedAt: cell.editedAt,
    });
  }

  return newId;
}
