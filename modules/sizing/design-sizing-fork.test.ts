import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  db,
  designs,
  garmentCategories,
  sizeBlockCells,
  sizeBlockRows,
  sizeBlocks,
  sql,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { forkSizeBlockInTx } from "./fork";
import { editBaseCell, resolveChart } from "./engine";

/**
 * Exit criterion: editing a design's forked chart must leave the category
 * shared source block byte-identical.
 */
describe("design sizing fork does not mutate shared default", () => {
  let categoryId: string;
  let sharedBlockId: string;
  let designId: string;
  let forkId: string;

  beforeEach(async () => {
    const cats = await db
      .select({ id: garmentCategories.id })
      .from(garmentCategories)
      .where(eq(garmentCategories.key, "KAMEEZ"))
      .limit(1);
    categoryId = cats[0]?.id ?? "";
    if (!categoryId) throw new Error("KAMEEZ category missing — run db:seed");

    sharedBlockId = uuidv7();
    await db.insert(sizeBlocks).values({
      id: sharedBlockId,
      name: `shared-source-${sharedBlockId.slice(0, 8)}`,
      categoryId,
      isDefault: false,
      ownerDesignId: null,
      sizeLabels: ["S", "M", "L", "XL"],
      baseSizeLabel: "M",
      notes: "design-sizing isolation",
      active: true,
    });

    await db.insert(sizeBlockRows).values({
      id: uuidv7(),
      blockId: sharedBlockId,
      measurementKey: "LENGTH",
      baseValue: 3000,
      gradeIncrement: 100,
      gradeOverrides: {},
      sortOrder: 1,
    });

    designId = uuidv7();
    await db.insert(designs).values({
      id: designId,
      slug: `fork-guard-${designId.slice(0, 8)}`,
      name: "Fork guard design",
      garmentTypeId: categoryId,
      components: ["KAMEEZ", "TROUSER"],
      sizeBlockId: sharedBlockId,
      pieceSizeBlocks: {},
      availableSizeLabels: ["S", "M", "L", "XL"],
      fitProfileIds: {},
      status: "DRAFT",
    });

    await db.transaction(async (tx) => {
      forkId = await forkSizeBlockInTx(
        tx as never,
        sharedBlockId,
        designId,
        uuidv7(),
      );
    });

    await db
      .update(designs)
      .set({
        pieceSizeBlocks: { KAMEEZ: forkId },
        sizeBlockId: forkId,
        updatedAt: new Date(),
      })
      .where(eq(designs.id, designId));
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("shared source rows/cells stay byte-identical after design fork edit", async () => {
    const beforeRows = await db
      .select({
        measurementKey: sizeBlockRows.measurementKey,
        baseValue: sizeBlockRows.baseValue,
        gradeIncrement: sizeBlockRows.gradeIncrement,
        gradeOverrides: sizeBlockRows.gradeOverrides,
        sortOrder: sizeBlockRows.sortOrder,
      })
      .from(sizeBlockRows)
      .where(eq(sizeBlockRows.blockId, sharedBlockId));

    const beforeCells = await db
      .select({
        measurementKey: sizeBlockCells.measurementKey,
        sizeLabel: sizeBlockCells.sizeLabel,
        value: sizeBlockCells.value,
        isPinned: sizeBlockCells.isPinned,
      })
      .from(sizeBlockCells)
      .where(eq(sizeBlockCells.blockId, sharedBlockId));

    const beforeBlock = await db
      .select({
        sizeLabels: sizeBlocks.sizeLabels,
        baseSizeLabel: sizeBlocks.baseSizeLabel,
        isDefault: sizeBlocks.isDefault,
        ownerDesignId: sizeBlocks.ownerDesignId,
      })
      .from(sizeBlocks)
      .where(eq(sizeBlocks.id, sharedBlockId))
      .limit(1);

    const forkRows = await db
      .select()
      .from(sizeBlockRows)
      .where(eq(sizeBlockRows.blockId, forkId));
    const length = forkRows.find((r) => r.measurementKey === "LENGTH");
    if (!length) throw new Error("LENGTH row missing on fork");

    const edited = editBaseCell(
      {
        measurementKey: length.measurementKey,
        baseValue: length.baseValue,
        gradeIncrement: length.gradeIncrement,
        gradeOverrides: length.gradeOverrides ?? {},
      },
      2700,
    );

    await db
      .update(sizeBlockRows)
      .set({ baseValue: edited.baseValue })
      .where(eq(sizeBlockRows.id, length.id));

    await db.insert(sizeBlockCells).values({
      blockId: forkId,
      measurementKey: "LENGTH",
      sizeLabel: "XL",
      value: 2900,
      isPinned: true,
    });

    const afterPinEdit = editBaseCell(
      {
        measurementKey: length.measurementKey,
        baseValue: edited.baseValue,
        gradeIncrement: length.gradeIncrement,
        gradeOverrides: length.gradeOverrides ?? {},
      },
      2600,
    );

    const grid = resolveChart(
      {
        sizeLabels: ["S", "M", "L", "XL"],
        baseSizeLabel: "M",
      },
      [afterPinEdit],
      [{ measurementKey: "LENGTH", sizeLabel: "XL", value: 2900 }],
    );

    expect(grid.LENGTH?.M?.value).toBe(2600);
    expect(grid.LENGTH?.XL).toEqual({ value: 2900, pinned: true });
    expect(grid.LENGTH?.S?.value).toBe(2500);
    expect(grid.LENGTH?.L?.value).toBe(2700);

    const afterRows = await db
      .select({
        measurementKey: sizeBlockRows.measurementKey,
        baseValue: sizeBlockRows.baseValue,
        gradeIncrement: sizeBlockRows.gradeIncrement,
        gradeOverrides: sizeBlockRows.gradeOverrides,
        sortOrder: sizeBlockRows.sortOrder,
      })
      .from(sizeBlockRows)
      .where(eq(sizeBlockRows.blockId, sharedBlockId));

    const afterCells = await db
      .select({
        measurementKey: sizeBlockCells.measurementKey,
        sizeLabel: sizeBlockCells.sizeLabel,
        value: sizeBlockCells.value,
        isPinned: sizeBlockCells.isPinned,
      })
      .from(sizeBlockCells)
      .where(eq(sizeBlockCells.blockId, sharedBlockId));

    const afterBlock = await db
      .select({
        sizeLabels: sizeBlocks.sizeLabels,
        baseSizeLabel: sizeBlocks.baseSizeLabel,
        isDefault: sizeBlocks.isDefault,
        ownerDesignId: sizeBlocks.ownerDesignId,
      })
      .from(sizeBlocks)
      .where(eq(sizeBlocks.id, sharedBlockId))
      .limit(1);

    expect(afterRows).toEqual(beforeRows);
    expect(afterCells).toEqual(beforeCells);
    expect(afterBlock).toEqual(beforeBlock);
    expect(beforeRows[0]?.baseValue).toBe(3000);
  });
});
