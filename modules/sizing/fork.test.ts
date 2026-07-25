import { and, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  db,
  garmentCategories,
  sizeBlockCells,
  sizeBlockRows,
  sizeBlocks,
  sql,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { forkSizeBlockInTx } from "./fork";
import { editBaseCell, resolveChart } from "./engine";

describe("pinning + fork", () => {
  let categoryId: string;
  let blockId: string;
  let lengthRowId: string;

  beforeEach(async () => {
    await db.delete(sizeBlockCells);
    await db.delete(sizeBlockRows);
    // keep categories; wipe non-default test blocks later
    const cats = await db
      .select({ id: garmentCategories.id })
      .from(garmentCategories)
      .where(eq(garmentCategories.key, "KAMEEZ"))
      .limit(1);
    categoryId = cats[0]?.id ?? "";
    if (!categoryId) throw new Error("KAMEEZ category missing — run db:seed");

    // Remove previous test forks (ownerDesignId set)
    const forks = await db
      .select({ id: sizeBlocks.id })
      .from(sizeBlocks)
      .where(eq(sizeBlocks.categoryId, categoryId));
    for (const f of forks) {
      if (f.id) {
        // Keep seeded default; delete others in after? We'll create isolated blocks.
      }
    }

    blockId = uuidv7();
    await db.insert(sizeBlocks).values({
      id: blockId,
      name: "test kameez",
      categoryId,
      isDefault: false,
      ownerDesignId: null,
      sizeLabels: ["XS", "S", "M", "L", "XL", "XXL"],
      baseSizeLabel: "M",
      notes: "test",
      active: true,
    });

    lengthRowId = uuidv7();
    await db.insert(sizeBlockRows).values({
      id: lengthRowId,
      blockId,
      measurementKey: "LENGTH",
      baseValue: 3000,
      gradeIncrement: 100,
      gradeOverrides: {},
      sortOrder: 1,
    });
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("a pinned XXL value survives a base-cell edit", async () => {
    await db.insert(sizeBlockCells).values({
      blockId,
      measurementKey: "LENGTH",
      sizeLabel: "XXL",
      value: 3100,
      isPinned: true,
    });

    const rows = await db
      .select()
      .from(sizeBlockRows)
      .where(eq(sizeBlockRows.blockId, blockId));
    const pins = await db
      .select()
      .from(sizeBlockCells)
      .where(
        and(
          eq(sizeBlockCells.blockId, blockId),
          eq(sizeBlockCells.isPinned, true),
        ),
      );

    const row = rows[0]!;
    const edited = editBaseCell(
      {
        measurementKey: row.measurementKey,
        baseValue: row.baseValue,
        gradeIncrement: row.gradeIncrement,
        gradeOverrides: row.gradeOverrides ?? {},
      },
      2700,
    );

    const grid = resolveChart(
      {
        sizeLabels: ["XS", "S", "M", "L", "XL", "XXL"],
        baseSizeLabel: "M",
      },
      [edited],
      pins.map((p) => ({
        measurementKey: p.measurementKey,
        sizeLabel: p.sizeLabel,
        value: p.value,
      })),
    );

    expect(grid.LENGTH?.XXL).toEqual({ value: 3100, pinned: true });
    expect(grid.LENGTH?.M).toEqual({ value: 2700, pinned: false });
    expect(grid.LENGTH?.XS).toEqual({ value: 2500, pinned: false });
  });

  it("forking leaves the shared block byte-identical", async () => {
    await db.insert(sizeBlockCells).values({
      blockId,
      measurementKey: "LENGTH",
      sizeLabel: "XL",
      value: 3200,
      isPinned: true,
    });

    const beforeRows = await db
      .select({
        measurementKey: sizeBlockRows.measurementKey,
        baseValue: sizeBlockRows.baseValue,
        gradeIncrement: sizeBlockRows.gradeIncrement,
        gradeOverrides: sizeBlockRows.gradeOverrides,
        sortOrder: sizeBlockRows.sortOrder,
      })
      .from(sizeBlockRows)
      .where(eq(sizeBlockRows.blockId, blockId));

    const beforeCells = await db
      .select({
        measurementKey: sizeBlockCells.measurementKey,
        sizeLabel: sizeBlockCells.sizeLabel,
        value: sizeBlockCells.value,
        isPinned: sizeBlockCells.isPinned,
      })
      .from(sizeBlockCells)
      .where(eq(sizeBlockCells.blockId, blockId));

    const beforeBlock = await db
      .select({
        categoryId: sizeBlocks.categoryId,
        sizeLabels: sizeBlocks.sizeLabels,
        baseSizeLabel: sizeBlocks.baseSizeLabel,
        isDefault: sizeBlocks.isDefault,
      })
      .from(sizeBlocks)
      .where(eq(sizeBlocks.id, blockId))
      .limit(1);

    const designId = uuidv7();
    let forkId = "";
    await db.transaction(async (tx) => {
      forkId = await forkSizeBlockInTx(
        tx as never,
        blockId,
        designId,
        uuidv7(),
      );
    });

    // Mutate the fork
    await db
      .update(sizeBlockRows)
      .set({ baseValue: 2700 })
      .where(eq(sizeBlockRows.blockId, forkId));

    const afterRows = await db
      .select({
        measurementKey: sizeBlockRows.measurementKey,
        baseValue: sizeBlockRows.baseValue,
        gradeIncrement: sizeBlockRows.gradeIncrement,
        gradeOverrides: sizeBlockRows.gradeOverrides,
        sortOrder: sizeBlockRows.sortOrder,
      })
      .from(sizeBlockRows)
      .where(eq(sizeBlockRows.blockId, blockId));

    const afterCells = await db
      .select({
        measurementKey: sizeBlockCells.measurementKey,
        sizeLabel: sizeBlockCells.sizeLabel,
        value: sizeBlockCells.value,
        isPinned: sizeBlockCells.isPinned,
      })
      .from(sizeBlockCells)
      .where(eq(sizeBlockCells.blockId, blockId));

    const afterBlock = await db
      .select({
        categoryId: sizeBlocks.categoryId,
        sizeLabels: sizeBlocks.sizeLabels,
        baseSizeLabel: sizeBlocks.baseSizeLabel,
        isDefault: sizeBlocks.isDefault,
      })
      .from(sizeBlocks)
      .where(eq(sizeBlocks.id, blockId))
      .limit(1);

    expect(afterRows).toEqual(beforeRows);
    expect(afterCells).toEqual(beforeCells);
    expect(afterBlock).toEqual(beforeBlock);

    const forkRows = await db
      .select({ baseValue: sizeBlockRows.baseValue })
      .from(sizeBlockRows)
      .where(eq(sizeBlockRows.blockId, forkId));
    expect(forkRows[0]?.baseValue).toBe(2700);
  });
});
