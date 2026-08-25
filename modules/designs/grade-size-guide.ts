"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db, designs, insertAuditLog } from "@aks/db";
import { uuidv7 } from "@aks/shared";
import { requirePermission } from "@/modules/auth";
import { getSizeBlock, saveSizeBlockRow } from "@/modules/sizing/block-actions";
import { editBaseCell, resolveCellValue } from "@/modules/sizing/engine";

/**
 * Edit one size column on the design's size guide; shift every size by the same
 * delta (fashion grade / Zalando-style chart edit: change one size → run updates).
 */
export async function gradeDesignSizeGuide(
  formData: FormData,
): Promise<{ ok: true; blockId?: string } | { ok: false; error: string }> {
  try {
    const session = await requirePermission("designs.edit");
    const designId = String(formData.get("designId") ?? "");
    const sizeLabel = String(formData.get("sizeLabel") ?? "").trim();
    const valuesRaw = String(formData.get("valuesJson") ?? "");

    if (!designId || !sizeLabel) {
      return { ok: false, error: "Design and size required" };
    }

    let values: Record<string, number>;
    try {
      values = JSON.parse(valuesRaw) as Record<string, number>;
    } catch {
      return { ok: false, error: "Invalid measurements" };
    }

    const [design] = await db
      .select({
        id: designs.id,
        sizeBlockId: designs.sizeBlockId,
      })
      .from(designs)
      .where(eq(designs.id, designId))
      .limit(1);
    if (!design?.sizeBlockId) {
      return { ok: false, error: "Select a size block first" };
    }

    const block = await getSizeBlock(design.sizeBlockId);
    if (!block) return { ok: false, error: "Size block not found" };
    if (!block.sizeLabels.includes(sizeLabel)) {
      return { ok: false, error: `Size ${sizeLabel} not on this chart` };
    }

    const blockInput = {
      sizeLabels: block.sizeLabels,
      baseSizeLabel: block.baseSizeLabel,
    };

    let lastBlockId = block.id;
    for (const row of block.rows) {
      const nextValue = values[row.measurementKey];
      if (nextValue == null || !Number.isInteger(nextValue)) continue;

      const current = resolveCellValue(
        blockInput,
        {
          measurementKey: row.measurementKey,
          baseValue: row.baseValue,
          gradeIncrement: row.gradeIncrement,
          gradeOverrides: row.gradeOverrides ?? {},
        },
        sizeLabel,
      );
      const delta = nextValue - current;
      if (delta === 0) continue;

      const edited = editBaseCell(
        {
          measurementKey: row.measurementKey,
          baseValue: row.baseValue,
          gradeIncrement: row.gradeIncrement,
          gradeOverrides: row.gradeOverrides ?? {},
        },
        row.baseValue + delta,
      );

      const res = await saveSizeBlockRow({
        blockId: block.id,
        rowId: row.id,
        baseValue: edited.baseValue,
        gradeIncrement: edited.gradeIncrement,
        designId,
      });
      if (!res.ok) return { ok: false, error: res.error };
      if (res.blockId) lastBlockId = res.blockId;
    }

    if (lastBlockId !== design.sizeBlockId) {
      await db
        .update(designs)
        .set({ sizeBlockId: lastBlockId, updatedAt: new Date() })
        .where(eq(designs.id, designId));
    }

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.size_guide.grade",
      entityType: "design",
      entityId: designId,
      before: null,
      after: { sizeLabel, values, blockId: lastBlockId },
    });

    revalidatePath(`/admin/designs/${designId}`);
    return { ok: true, blockId: lastBlockId };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Grade failed",
    };
  }
}
