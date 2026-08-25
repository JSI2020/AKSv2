"use server";

import { and, eq } from "drizzle-orm";

import {
  db,
  designs,
  garmentCategories,
  insertAuditLog,
  sizeBlockCells,
  sizeBlockRows,
  sizeBlocks,
  type Database,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";
import { requireSizingEdit, requireSizingView } from "./require-sizing-permission";

import type { BlockMutationResult, BlockSaveResult } from "./types";
import { forkSizeBlockInTx } from "./fork";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * If `designId` is set and the block is a shared default, fork first.
 * Returns the block id that should receive the mutation.
 */
export async function resolveEditableBlockId(
  blockId: string,
  designId: string | null | undefined,
): Promise<{ blockId: string; forked: boolean }> {
  const session = await requireSizingEdit(designId);

  if (!designId) {
    return { blockId, forked: false };
  }

  const blocks = await db
    .select()
    .from(sizeBlocks)
    .where(eq(sizeBlocks.id, blockId))
    .limit(1);
  const block = blocks[0];
  if (!block) throw new Error("Block not found");

  if (block.ownerDesignId === designId) {
    return { blockId, forked: false };
  }

  if (!block.isDefault || block.ownerDesignId) {
    // Already a non-default / other fork — edit in place only if same design
    if (block.ownerDesignId && block.ownerDesignId !== designId) {
      throw new Error("Cannot edit another design's size block");
    }
    return { blockId, forked: false };
  }

  // Existing fork for this design?
  const existing = await db
    .select({ id: sizeBlocks.id })
    .from(sizeBlocks)
    .where(
      and(
        eq(sizeBlocks.categoryId, block.categoryId),
        eq(sizeBlocks.ownerDesignId, designId),
        eq(sizeBlocks.active, true),
      ),
    )
    .limit(1);
  if (existing[0]) {
    return { blockId: existing[0].id, forked: false };
  }

  let newId = "";
  await db.transaction(async (tx) => {
    newId = await forkSizeBlockInTx(
      tx as unknown as Tx,
      blockId,
      designId,
      session.user.id,
    );
    await insertAuditLog(tx as unknown as Database, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "sizing.block.fork",
      entityType: "size_block",
      entityId: newId,
      before: { sourceBlockId: blockId },
      after: { ownerDesignId: designId },
    });

    const cats = await tx
      .select({ key: garmentCategories.key })
      .from(garmentCategories)
      .where(eq(garmentCategories.id, block.categoryId))
      .limit(1);
    const categoryKey = cats[0]?.key;
    if (categoryKey) {
      const [design] = await tx
        .select({
          pieceSizeBlocks: designs.pieceSizeBlocks,
          sizeBlockId: designs.sizeBlockId,
          components: designs.components,
        })
        .from(designs)
        .where(eq(designs.id, designId))
        .limit(1);
      if (design) {
        const nextPieces = {
          ...(design.pieceSizeBlocks ?? {}),
          [categoryKey]: newId,
        };
        const primary = design.components?.[0];
        await tx
          .update(designs)
          .set({
            pieceSizeBlocks: nextPieces,
            sizeBlockId:
              primary === categoryKey || !design.sizeBlockId
                ? newId
                : design.sizeBlockId,
            updatedAt: new Date(),
          })
          .where(eq(designs.id, designId));
      }
    }
  });

  return { blockId: newId, forked: true };
}

/** Existing design fork for a category, if any. */
export async function findDesignForkBlockId(
  designId: string,
  categoryId: string,
): Promise<string | null> {
  await requireSizingView(designId);
  const existing = await db
    .select({ id: sizeBlocks.id })
    .from(sizeBlocks)
    .where(
      and(
        eq(sizeBlocks.categoryId, categoryId),
        eq(sizeBlocks.ownerDesignId, designId),
        eq(sizeBlocks.active, true),
      ),
    )
    .limit(1);
  return existing[0]?.id ?? null;
}

export async function pinSizeBlockCell(input: {
  blockId: string;
  measurementKey: string;
  sizeLabel: string;
  value: number;
  designId?: string | null;
}): Promise<BlockMutationResult> {
  try {
    const session = await requireSizingEdit(input.designId);
    if (!Number.isInteger(input.value)) {
      return { ok: false, error: "Value must be integer hundredths" };
    }

    const resolved = await resolveEditableBlockId(
      input.blockId,
      input.designId,
    );
    const blockId = resolved.blockId;

    const block = await db
      .select()
      .from(sizeBlocks)
      .where(eq(sizeBlocks.id, blockId))
      .limit(1);
    if (!block[0]) return { ok: false, error: "Block not found" };
    if (input.sizeLabel === block[0].baseSizeLabel) {
      return { ok: false, error: "Cannot pin the base-size cell" };
    }

    await db
      .insert(sizeBlockCells)
      .values({
        blockId,
        measurementKey: input.measurementKey,
        sizeLabel: input.sizeLabel,
        value: input.value,
        isPinned: true,
        editedById: session.user.id,
        editedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          sizeBlockCells.blockId,
          sizeBlockCells.measurementKey,
          sizeBlockCells.sizeLabel,
        ],
        set: {
          value: input.value,
          isPinned: true,
          editedById: session.user.id,
          editedAt: new Date(),
        },
      });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "sizing.block_cell.pin",
      entityType: "size_block_cell",
      entityId: `${blockId}:${input.measurementKey}:${input.sizeLabel}`,
      before: null,
      after: { value: input.value, isPinned: true },
    });

    return { ok: true, blockId, forked: resolved.forked };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Pin failed",
    };
  }
}

export async function unpinSizeBlockCell(input: {
  blockId: string;
  measurementKey: string;
  sizeLabel: string;
  designId?: string | null;
}): Promise<BlockMutationResult> {
  try {
    const session = await requireSizingEdit(input.designId);
    const resolved = await resolveEditableBlockId(
      input.blockId,
      input.designId,
    );
    const blockId = resolved.blockId;

    await db
      .delete(sizeBlockCells)
      .where(
        and(
          eq(sizeBlockCells.blockId, blockId),
          eq(sizeBlockCells.measurementKey, input.measurementKey),
          eq(sizeBlockCells.sizeLabel, input.sizeLabel),
        ),
      );

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "sizing.block_cell.unpin",
      entityType: "size_block_cell",
      entityId: `${blockId}:${input.measurementKey}:${input.sizeLabel}`,
      before: { isPinned: true },
      after: null,
    });

    return { ok: true, blockId, forked: resolved.forked };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unpin failed",
    };
  }
}

export async function revertSizeBlockFork(
  forkBlockId: string,
  designId?: string | null,
): Promise<BlockSaveResult> {
  try {
    const session = await requireSizingEdit(designId);
    const blocks = await db
      .select()
      .from(sizeBlocks)
      .where(eq(sizeBlocks.id, forkBlockId))
      .limit(1);
    const block = blocks[0];
    if (!block) return { ok: false, error: "Block not found" };
    if (!block.ownerDesignId || block.isDefault) {
      return { ok: false, error: "Only design forks can be reverted" };
    }
    if (designId && block.ownerDesignId !== designId) {
      return { ok: false, error: "Fork does not belong to this design" };
    }

    const ownerId = designId ?? block.ownerDesignId;

    await db.transaction(async (tx) => {
      await tx.delete(sizeBlocks).where(eq(sizeBlocks.id, forkBlockId));

      const [design] = await tx
        .select({
          id: designs.id,
          sizeBlockId: designs.sizeBlockId,
          pieceSizeBlocks: designs.pieceSizeBlocks,
        })
        .from(designs)
        .where(eq(designs.id, ownerId))
        .limit(1);

      if (design) {
        const cats = await tx
          .select({ key: garmentCategories.key })
          .from(garmentCategories)
          .where(eq(garmentCategories.id, block.categoryId))
          .limit(1);
        const categoryKey = cats[0]?.key;
        const nextPieces = { ...(design.pieceSizeBlocks ?? {}) };
        if (categoryKey && nextPieces[categoryKey] === forkBlockId) {
          delete nextPieces[categoryKey];
        }
        // Also clear any key that pointed at this fork
        for (const [k, v] of Object.entries(nextPieces)) {
          if (v === forkBlockId) delete nextPieces[k];
        }

        const defaultBlock = await tx
          .select({ id: sizeBlocks.id })
          .from(sizeBlocks)
          .where(
            and(
              eq(sizeBlocks.categoryId, block.categoryId),
              eq(sizeBlocks.isDefault, true),
              eq(sizeBlocks.active, true),
            ),
          )
          .limit(1);

        await tx
          .update(designs)
          .set({
            pieceSizeBlocks: nextPieces,
            sizeBlockId:
              design.sizeBlockId === forkBlockId
                ? (defaultBlock[0]?.id ?? null)
                : design.sizeBlockId,
            updatedAt: new Date(),
          })
          .where(eq(designs.id, ownerId));
      }

      await insertAuditLog(tx as unknown as Database, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "sizing.block.revert",
        entityType: "size_block",
        entityId: forkBlockId,
        before: {
          ownerDesignId: block.ownerDesignId,
          categoryId: block.categoryId,
        },
        after: null,
      });
    });

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Revert failed",
    };
  }
}

/**
 * Design Sizing tab — one-shot Update: set each row's M (base) value,
 * clear pins so every size inherits the new base via grading, fork if needed.
 */
export async function updateDesignPieceBaseSizes(input: {
  blockId: string;
  designId: string;
  /** measurementKey → new base value (integer hundredths). */
  bases: Record<string, number>;
}): Promise<BlockMutationResult> {
  try {
    const session = await requireSizingEdit(input.designId);
    const entries = Object.entries(input.bases);
    if (!input.blockId || !input.designId || entries.length === 0) {
      return { ok: false, error: "Invalid input" };
    }
    for (const [, v] of entries) {
      if (!Number.isInteger(v) || v <= 0) {
        return { ok: false, error: "Each base must be a positive measure" };
      }
    }

    const resolved = await resolveEditableBlockId(
      input.blockId,
      input.designId,
    );
    const blockId = resolved.blockId;

    const rows = await db
      .select()
      .from(sizeBlockRows)
      .where(eq(sizeBlockRows.blockId, blockId));

    const before: Record<string, number> = {};
    const after: Record<string, number> = {};

    await db.transaction(async (tx) => {
      // Clear pins — Update means “all sizes follow M again”.
      await tx
        .delete(sizeBlockCells)
        .where(eq(sizeBlockCells.blockId, blockId));

      for (const [measurementKey, baseValue] of entries) {
        const row = rows.find((r) => r.measurementKey === measurementKey);
        if (!row) continue;
        before[measurementKey] = row.baseValue;
        after[measurementKey] = baseValue;
        if (row.baseValue === baseValue) continue;
        await tx
          .update(sizeBlockRows)
          .set({ baseValue, updatedAt: new Date() })
          .where(eq(sizeBlockRows.id, row.id));
      }

      await tx
        .update(sizeBlocks)
        .set({ updatedAt: new Date() })
        .where(eq(sizeBlocks.id, blockId));

      await insertAuditLog(tx as unknown as Database, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "sizing.design_piece.update_bases",
        entityType: "size_block",
        entityId: blockId,
        before,
        after,
      });
    });

    return { ok: true, blockId, forked: resolved.forked };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Update failed",
    };
  }
}
