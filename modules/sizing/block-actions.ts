"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  db,
  garmentCategories,
  insertAuditLog,
  sizeBlockCells,
  sizeBlockRows,
  sizeBlocks,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";
import { requirePermission } from "@/modules/auth";

import { resolveEditableBlockId } from "./fork-actions";
import type { BlockMutationResult } from "./types";

export type SizeBlockListItem = {
  id: string;
  name: string;
  isDefault: boolean;
  active: boolean;
  baseSizeLabel: string;
  sizeLabels: string[];
  notes: string | null;
  categoryKey: string;
  categoryName: string;
};

export type SizeBlockDetail = {
  id: string;
  name: string;
  isDefault: boolean;
  active: boolean;
  baseSizeLabel: string;
  sizeLabels: string[];
  notes: string | null;
  categoryId: string;
  categoryKey: string;
  categoryName: string;
  ownerDesignId: string | null;
  rows: {
    id: string;
    measurementKey: string;
    baseValue: number;
    gradeIncrement: number;
    gradeOverrides: Record<string, number>;
    sortOrder: number;
  }[];
  pinnedCells: {
    measurementKey: string;
    sizeLabel: string;
    value: number;
  }[];
};

export async function listSizeBlocks(): Promise<SizeBlockListItem[]> {
  await requirePermission("settings.view");
  const rows = await db
    .select({
      id: sizeBlocks.id,
      name: sizeBlocks.name,
      isDefault: sizeBlocks.isDefault,
      active: sizeBlocks.active,
      baseSizeLabel: sizeBlocks.baseSizeLabel,
      sizeLabels: sizeBlocks.sizeLabels,
      notes: sizeBlocks.notes,
      categoryKey: garmentCategories.key,
      categoryName: garmentCategories.name,
      sortOrder: garmentCategories.sortOrder,
    })
    .from(sizeBlocks)
    .innerJoin(
      garmentCategories,
      eq(sizeBlocks.categoryId, garmentCategories.id),
    )
    .orderBy(asc(garmentCategories.sortOrder), asc(sizeBlocks.name));

  return rows.map(({ sortOrder: _s, ...rest }) => rest);
}

export async function getSizeBlock(
  id: string,
): Promise<SizeBlockDetail | null> {
  await requirePermission("settings.view");
  const blocks = await db
    .select({
      id: sizeBlocks.id,
      name: sizeBlocks.name,
      isDefault: sizeBlocks.isDefault,
      active: sizeBlocks.active,
      baseSizeLabel: sizeBlocks.baseSizeLabel,
      sizeLabels: sizeBlocks.sizeLabels,
      notes: sizeBlocks.notes,
      categoryId: sizeBlocks.categoryId,
      ownerDesignId: sizeBlocks.ownerDesignId,
      categoryKey: garmentCategories.key,
      categoryName: garmentCategories.name,
    })
    .from(sizeBlocks)
    .innerJoin(
      garmentCategories,
      eq(sizeBlocks.categoryId, garmentCategories.id),
    )
    .where(eq(sizeBlocks.id, id))
    .limit(1);

  const block = blocks[0];
  if (!block) return null;

  const rows = await db
    .select({
      id: sizeBlockRows.id,
      measurementKey: sizeBlockRows.measurementKey,
      baseValue: sizeBlockRows.baseValue,
      gradeIncrement: sizeBlockRows.gradeIncrement,
      gradeOverrides: sizeBlockRows.gradeOverrides,
      sortOrder: sizeBlockRows.sortOrder,
    })
    .from(sizeBlockRows)
    .where(eq(sizeBlockRows.blockId, id))
    .orderBy(asc(sizeBlockRows.sortOrder));

  const pinned = await db
    .select({
      measurementKey: sizeBlockCells.measurementKey,
      sizeLabel: sizeBlockCells.sizeLabel,
      value: sizeBlockCells.value,
    })
    .from(sizeBlockCells)
    .where(
      and(
        eq(sizeBlockCells.blockId, id),
        eq(sizeBlockCells.isPinned, true),
      ),
    );

  return {
    ...block,
    rows: rows.map((r) => ({
      ...r,
      gradeOverrides: r.gradeOverrides ?? {},
    })),
    pinnedCells: pinned,
  };
}

export async function saveSizeBlockRow(input: {
  blockId: string;
  rowId: string;
  baseValue: number;
  gradeIncrement: number;
  designId?: string | null;
}): Promise<BlockMutationResult> {
  try {
    const session = await requirePermission("settings.edit");
    const { rowId, baseValue, gradeIncrement } = input;

    if (
      !input.blockId ||
      !rowId ||
      !Number.isInteger(baseValue) ||
      !Number.isInteger(gradeIncrement)
    ) {
      return { ok: false, error: "Invalid input" };
    }

    const resolved = await resolveEditableBlockId(
      input.blockId,
      input.designId,
    );
    const blockId = resolved.blockId;

    const original = await db
      .select()
      .from(sizeBlockRows)
      .where(eq(sizeBlockRows.id, rowId))
      .limit(1);
    const sourceRow = original[0];
    if (!sourceRow) return { ok: false, error: "Row not found" };

    let targetRow = sourceRow;
    if (sourceRow.blockId !== blockId) {
      const onBlock = await db
        .select()
        .from(sizeBlockRows)
        .where(
          and(
            eq(sizeBlockRows.blockId, blockId),
            eq(sizeBlockRows.measurementKey, sourceRow.measurementKey),
          ),
        )
        .limit(1);
      const found = onBlock[0];
      if (!found) return { ok: false, error: "Row not found on editable block" };
      targetRow = found;
    }

    const before = targetRow;

    await db
      .update(sizeBlockRows)
      .set({
        baseValue,
        gradeIncrement,
        updatedAt: new Date(),
      })
      .where(eq(sizeBlockRows.id, before.id));

    await db
      .update(sizeBlocks)
      .set({ updatedAt: new Date() })
      .where(eq(sizeBlocks.id, blockId));

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "sizing.block_row.update",
      entityType: "size_block_row",
      entityId: before.id,
      before: {
        baseValue: before.baseValue,
        gradeIncrement: before.gradeIncrement,
      },
      after: { baseValue, gradeIncrement },
    });

    revalidatePath(`/admin/settings/sizing/blocks/${blockId}`);
    revalidatePath("/admin/settings/sizing/blocks");
    return { ok: true, blockId, forked: resolved.forked };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed",
    };
  }
}
