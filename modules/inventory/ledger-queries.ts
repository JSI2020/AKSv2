"use server";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import {
  colourways,
  db,
  designRenders,
  designTags,
  designs,
  fabricColourways,
  fabricLots,
  fabrics,
  packingMaterials,
  packingMovements,
  rtwMovements,
  rtwStock,
  stockAdjustments,
  trimColourways,
  trimMovements,
  trimStock,
  trims,
} from "@aks/db";
import { STANDARD_SIZE_LABELS, uuidv7 } from "@aks/shared";
import { HOUSE_COLLECTIONS } from "@/modules/catalog/house-collections";
import { requirePermission } from "@/modules/auth";
import { lotAvailableMeters } from "@/modules/inventory/lot-status";

import type { LedgerMovementRow, StockLedgerDetail } from "./ledger-types";
import { colourGradient, swatchHex } from "./ledger-types";
import { ensureRtwStockRow, ensureTrimStockRow } from "./record-movement-action";

export type InventoryHubStats = {
  designs: { count: number; low: number };
  fabric: { count: number; low: number };
  packing: { count: number; low: number };
  trims: { count: number; low: number };
};

export async function getInventoryHubStats(): Promise<InventoryHubStats> {
  await requirePermission("inventory.view");

  const designRows = await db
    .select({
      id: designs.id,
    })
    .from(designs)
    .where(eq(designs.status, "PUBLISHED"));

  const lowRtw = await db
    .select({ id: rtwStock.id })
    .from(rtwStock)
    .where(sql`${rtwStock.quantityOnHand} <= ${rtwStock.reorderPoint}`);

  const fabricRows = await db
    .select({ id: fabrics.id })
    .from(fabrics)
    .where(eq(fabrics.active, true));

  const packingRows = await db.select().from(packingMaterials).where(eq(packingMaterials.active, true));
  const packingLow = packingRows.filter(
    (p) => p.quantityOnHand <= p.reorderPoint,
  ).length;

  const trimRows = await db.select().from(trims).where(eq(trims.active, true));
  const trimStockRows = await db.select().from(trimStock);
  const trimLow = trimStockRows.filter(
    (t) => t.quantityOnHand <= t.reorderPoint,
  ).length;

  // Fabric low: any colour with available < 10m (1000 hundredths) heuristic
  const colourLots = await db
    .select({
      colourwayId: fabricLots.colourwayId,
      metersOnHand: fabricLots.metersOnHand,
      metersReserved: fabricLots.metersReserved,
      status: fabricLots.status,
    })
    .from(fabricLots)
    .where(inArray(fabricLots.status, ["AVAILABLE", "LOW"]));

  const byCw = new Map<string, number>();
  for (const lot of colourLots) {
    if (!lot.colourwayId) continue;
    byCw.set(
      lot.colourwayId,
      (byCw.get(lot.colourwayId) ?? 0) + lotAvailableMeters(lot),
    );
  }
  const fabricLow = [...byCw.values()].filter((m) => m < 1000).length;

  return {
    designs: { count: designRows.length, low: lowRtw.length },
    fabric: { count: fabricRows.length, low: fabricLow },
    packing: { count: packingRows.length, low: packingLow },
    trims: { count: trimRows.length, low: trimLow },
  };
}

export type RtwDesignCard = {
  id: string;
  name: string;
  status: string;
  itemNumber: string | null;
  /** House door FREE tag, e.g. ESSENTIALS — null if unset. */
  houseDoor: string | null;
  colourwayCount: number;
  totalUnits: number;
  lowSize: boolean;
  hexes: string[];
  thumbnailUrl: string | null;
  gradient: string;
};

export async function listRtwDesignCards(): Promise<RtwDesignCard[]> {
  await requirePermission("inventory.view");
  const rows = await db
    .select({
      id: designs.id,
      name: designs.name,
      status: designs.status,
      itemNumber: designs.itemNumber,
      availableSizeLabels: designs.availableSizeLabels,
    })
    .from(designs)
    .where(inArray(designs.status, ["PUBLISHED", "READY_TO_PUBLISH", "DRAFT"]))
    .orderBy(desc(designs.updatedAt));

  const houseTags = await db
    .select({
      designId: designTags.designId,
      value: designTags.value,
    })
    .from(designTags)
    .where(
      and(
        eq(designTags.kind, "FREE"),
        inArray(
          designTags.value,
          HOUSE_COLLECTIONS.map((c) => c.tag),
        ),
      ),
    );
  const houseByDesign = new Map(
    houseTags.map((t) => [t.designId, t.value] as const),
  );

  const cards: RtwDesignCard[] = [];
  for (const d of rows) {
    const cws = await db
      .select()
      .from(colourways)
      .where(and(eq(colourways.designId, d.id), eq(colourways.active, true)))
      .orderBy(asc(colourways.sortOrder));
    if (cws.length === 0) continue;

    const stock = await db
      .select()
      .from(rtwStock)
      .where(eq(rtwStock.designId, d.id));
    const totalUnits = stock.reduce((s, r) => s + r.quantityOnHand, 0);
    const lowSize = stock.some((r) => r.quantityOnHand <= r.reorderPoint);

    const render = await db
      .select({ assetId: designRenders.assetId })
      .from(designRenders)
      .where(eq(designRenders.designId, d.id))
      .orderBy(asc(designRenders.sortOrder))
      .limit(1);

    const thumbnailUrl: string | null = null;
    void render;

    cards.push({
      id: d.id,
      name: d.name,
      status: d.status,
      itemNumber: d.itemNumber,
      houseDoor: houseByDesign.get(d.id) ?? null,
      colourwayCount: cws.length,
      totalUnits,
      lowSize,
      hexes: cws
        .map((c) => c.hexApproximation)
        .filter((h): h is string => Boolean(h))
        .slice(0, 5),
      thumbnailUrl,
      gradient: colourGradient(
        cws[0]!.name,
        cws[0]!.hexApproximation,
      ),
    });
  }
  return cards;
}

export type RtwDesignDetail = {
  id: string;
  name: string;
  colourways: {
    id: string;
    name: string;
    hex: string | null;
    sizes: { label: string; onHand: number; reserved: number; stockId: string }[];
  }[];
};

export async function getRtwDesignDetail(
  designId: string,
): Promise<RtwDesignDetail | null> {
  await requirePermission("inventory.view");
  const [d] = await db
    .select()
    .from(designs)
    .where(eq(designs.id, designId))
    .limit(1);
  if (!d) return null;

  const sizes =
    d.availableSizeLabels?.length > 0
      ? d.availableSizeLabels
      : [...STANDARD_SIZE_LABELS];

  const cws = await db
    .select()
    .from(colourways)
    .where(and(eq(colourways.designId, designId), eq(colourways.active, true)))
    .orderBy(asc(colourways.sortOrder));

  const colourwayList = [];
  for (const cw of cws) {
    const sizeRows = [];
    for (const label of sizes) {
      const stockId = await ensureRtwStockRow(designId, cw.id, label);
      const [row] = await db
        .select()
        .from(rtwStock)
        .where(eq(rtwStock.id, stockId))
        .limit(1);
      sizeRows.push({
        label,
        onHand: row?.quantityOnHand ?? 0,
        reserved: row?.quantityReserved ?? 0,
        stockId,
      });
    }
    colourwayList.push({
      id: cw.id,
      name: cw.name,
      hex: cw.hexApproximation,
      sizes: sizeRows,
    });
  }

  return { id: d.id, name: d.name, colourways: colourwayList };
}

export async function getRtwLedger(
  designId: string,
  colourwayId: string,
  sizeLabel: string,
): Promise<StockLedgerDetail | null> {
  await requirePermission("inventory.view");
  const stockId = await ensureRtwStockRow(designId, colourwayId, sizeLabel);
  const [row] = await db
    .select()
    .from(rtwStock)
    .where(eq(rtwStock.id, stockId))
    .limit(1);
  if (!row) return null;

  const [d] = await db
    .select({ name: designs.name })
    .from(designs)
    .where(eq(designs.id, designId))
    .limit(1);
  const [cw] = await db
    .select()
    .from(colourways)
    .where(eq(colourways.id, colourwayId))
    .limit(1);

  const movs = await db
    .select()
    .from(rtwMovements)
    .where(eq(rtwMovements.rtwStockId, stockId))
    .orderBy(desc(rtwMovements.createdAt))
    .limit(50);

  return {
    title: `${d?.name ?? "Design"} · ${cw?.name ?? "Colour"}`,
    subtitle: `Size ${sizeLabel}`,
    photoUrl: null,
    photoGradient: colourGradient(cw?.name ?? "", cw?.hexApproximation),
    figures: {
      onHand: row.quantityOnHand,
      reserved: row.quantityReserved,
      available: Math.max(0, row.quantityOnHand - row.quantityReserved),
      unit: "pcs",
    },
    movements: movs.map(mapMov),
    stockKind: "rtw",
    stockId,
  };
}

function mapMov(m: {
  id: string;
  createdAt: Date;
  reason: string;
  delta: number;
  note: string | null;
  orderId?: string | null;
}): LedgerMovementRow {
  return {
    id: m.id,
    createdAt: m.createdAt,
    reason: m.reason as LedgerMovementRow["reason"],
    delta: m.delta,
    note: m.note,
    reference: m.orderId ? `Order ${m.orderId.slice(0, 8)}` : m.note,
  };
}

/** Ensure fabric colourways exist from lot colourNotes. */
export async function ensureFabricColourways(
  fabricId: string,
): Promise<void> {
  const lots = await db
    .select()
    .from(fabricLots)
    .where(eq(fabricLots.fabricId, fabricId));
  const existing = await db
    .select()
    .from(fabricColourways)
    .where(eq(fabricColourways.fabricId, fabricId));
  const byName = new Map(existing.map((c) => [c.colourName.toLowerCase(), c]));

  for (const lot of lots) {
    const name = (lot.colourNotes ?? "Default").trim() || "Default";
    let cw = byName.get(name.toLowerCase());
    if (!cw) {
      const id = uuidv7();
      await db.insert(fabricColourways).values({
        id,
        fabricId,
        colourName: name,
        hexApproximation: swatchHex(name),
        active: true,
      });
      cw = {
        id,
        fabricId,
        colourName: name,
        hexApproximation: swatchHex(name),
        swatchAssetId: null,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      byName.set(name.toLowerCase(), cw);
    }
    if (!lot.colourwayId) {
      await db
        .update(fabricLots)
        .set({ colourwayId: cw.id, updatedAt: new Date() })
        .where(eq(fabricLots.id, lot.id));
    }
  }

  if (byName.size === 0) {
    const id = uuidv7();
    await db.insert(fabricColourways).values({
      id,
      fabricId,
      colourName: "Default",
      active: true,
    });
  }
}

export type FabricInvCard = {
  id: string;
  name: string;
  rateMinor: number;
  colourCount: number;
  totalMeters: number;
  low: boolean;
  hexes: string[];
  gradient: string;
};

export async function listFabricInventoryCards(): Promise<FabricInvCard[]> {
  await requirePermission("inventory.view");
  const rows = await db
    .select()
    .from(fabrics)
    .where(eq(fabrics.active, true))
    .orderBy(asc(fabrics.name));

  const cards: FabricInvCard[] = [];
  for (const f of rows) {
    await ensureFabricColourways(f.id);
    const cws = await db
      .select()
      .from(fabricColourways)
      .where(
        and(
          eq(fabricColourways.fabricId, f.id),
          eq(fabricColourways.active, true),
        ),
      );
    const lots = await db
      .select()
      .from(fabricLots)
      .where(
        and(
          eq(fabricLots.fabricId, f.id),
          inArray(fabricLots.status, ["AVAILABLE", "LOW"]),
        ),
      );
    const totalMeters = lots.reduce((s, l) => s + lotAvailableMeters(l), 0);
    const byCw = new Map<string, number>();
    for (const l of lots) {
      if (!l.colourwayId) continue;
      byCw.set(
        l.colourwayId,
        (byCw.get(l.colourwayId) ?? 0) + lotAvailableMeters(l),
      );
    }
    const low = [...byCw.values()].some((m) => m < 1000);
    cards.push({
      id: f.id,
      name: f.name,
      rateMinor: f.costPerMeterMinor ?? 0,
      colourCount: cws.length,
      totalMeters,
      low,
      hexes: cws
        .map((c) => c.hexApproximation)
        .filter((h): h is string => Boolean(h))
        .slice(0, 5),
      gradient: colourGradient(
        cws[0]?.colourName ?? "Ivory",
        cws[0]?.hexApproximation,
      ),
    });
  }
  return cards;
}

export type FabricColourCard = {
  id: string;
  colourName: string;
  hex: string | null;
  onHand: number;
  reserved: number;
  low: boolean;
  gradient: string;
};

export async function listFabricColourCards(
  fabricId: string,
): Promise<{ fabricName: string; rateMinor: number; colours: FabricColourCard[] } | null> {
  await requirePermission("inventory.view");
  const [f] = await db
    .select()
    .from(fabrics)
    .where(eq(fabrics.id, fabricId))
    .limit(1);
  if (!f) return null;
  await ensureFabricColourways(fabricId);
  const cws = await db
    .select()
    .from(fabricColourways)
    .where(
      and(
        eq(fabricColourways.fabricId, fabricId),
        eq(fabricColourways.active, true),
      ),
    )
    .orderBy(asc(fabricColourways.colourName));

  const colours: FabricColourCard[] = [];
  for (const cw of cws) {
    const lots = await db
      .select()
      .from(fabricLots)
      .where(
        and(
          eq(fabricLots.colourwayId, cw.id),
          inArray(fabricLots.status, ["AVAILABLE", "LOW"]),
        ),
      );
    const onHand = lots.reduce((s, l) => s + l.metersOnHand, 0);
    const reserved = lots.reduce((s, l) => s + l.metersReserved, 0);
    const available = lots.reduce((s, l) => s + lotAvailableMeters(l), 0);
    colours.push({
      id: cw.id,
      colourName: cw.colourName,
      hex: cw.hexApproximation,
      onHand,
      reserved,
      low: available < 1000,
      gradient: colourGradient(cw.colourName, cw.hexApproximation),
    });
  }
  return {
    fabricName: f.name,
    rateMinor: f.costPerMeterMinor ?? 0,
    colours,
  };
}

export async function getFabricColourLedger(
  fabricId: string,
  colourwayId: string,
): Promise<StockLedgerDetail | null> {
  await requirePermission("inventory.view");
  const [f] = await db
    .select()
    .from(fabrics)
    .where(eq(fabrics.id, fabricId))
    .limit(1);
  const [cw] = await db
    .select()
    .from(fabricColourways)
    .where(eq(fabricColourways.id, colourwayId))
    .limit(1);
  if (!f || !cw || cw.fabricId !== fabricId) return null;

  const lots = await db
    .select()
    .from(fabricLots)
    .where(eq(fabricLots.colourwayId, colourwayId));
  const onHand = lots.reduce((s, l) => s + l.metersOnHand, 0);
  const reserved = lots.reduce((s, l) => s + l.metersReserved, 0);
  const lotIds = lots.map((l) => l.id);

  const movs =
    lotIds.length === 0
      ? []
      : await db
          .select()
          .from(stockAdjustments)
          .where(inArray(stockAdjustments.fabricLotId, lotIds))
          .orderBy(desc(stockAdjustments.createdAt))
          .limit(50);

  return {
    title: `${f.name} · ${cw.colourName}`,
    subtitle: `PKR ${Math.round((f.costPerMeterMinor ?? 0) / 100).toLocaleString()} / metre`,
    photoUrl: null,
    photoGradient: colourGradient(cw.colourName, cw.hexApproximation),
    figures: {
      onHand,
      reserved,
      available: Math.max(0, onHand - reserved),
      unit: "m",
    },
    movements: movs.map((m) => ({
      id: m.id,
      createdAt: m.createdAt,
      reason: (m.reason === "DAMAGE"
        ? "DAMAGE"
        : m.reason === "COUNT_CORRECTION"
          ? "COUNT_CORRECTION"
          : m.deltaMeters > 0
            ? "RECEIVED"
            : "SOLD_OFFLINE") as LedgerMovementRow["reason"],
      delta: m.deltaMeters,
      note: m.note,
      reference: m.note,
    })),
    stockKind: "fabric",
    stockId: colourwayId,
  };
}

export type PackingCard = {
  id: string;
  name: string;
  onHand: number;
  reorderPoint: number;
  low: boolean;
};

export async function listPackingCards(): Promise<PackingCard[]> {
  await requirePermission("inventory.view");
  const rows = await db
    .select()
    .from(packingMaterials)
    .where(eq(packingMaterials.active, true))
    .orderBy(asc(packingMaterials.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    onHand: r.quantityOnHand,
    reorderPoint: r.reorderPoint,
    low: r.quantityOnHand <= r.reorderPoint,
  }));
}

export async function getPackingLedger(
  id: string,
): Promise<StockLedgerDetail | null> {
  await requirePermission("inventory.view");
  const [row] = await db
    .select()
    .from(packingMaterials)
    .where(eq(packingMaterials.id, id))
    .limit(1);
  if (!row) return null;
  const movs = await db
    .select()
    .from(packingMovements)
    .where(eq(packingMovements.packingMaterialId, id))
    .orderBy(desc(packingMovements.createdAt))
    .limit(50);
  return {
    title: row.name,
    subtitle: "Packing material",
    photoUrl: null,
    photoGradient: "linear-gradient(155deg,#EAE1CF,#CDC0A8)",
    figures: {
      onHand: row.quantityOnHand,
      reserved: row.quantityReserved,
      available: Math.max(0, row.quantityOnHand - row.quantityReserved),
      unit: "pcs",
    },
    movements: movs.map(mapMov),
    stockKind: "packing",
    stockId: id,
  };
}

export type TrimCard = {
  id: string;
  name: string;
  kind: string;
  hasColourVariants: boolean;
  colourCount: number;
  total: number;
  hexes: string[];
  gradient: string;
};

export async function listTrimCards(): Promise<TrimCard[]> {
  await requirePermission("inventory.view");
  const rows = await db
    .select()
    .from(trims)
    .where(eq(trims.active, true))
    .orderBy(asc(trims.name));
  const cards: TrimCard[] = [];
  for (const t of rows) {
    const cws = await db
      .select()
      .from(trimColourways)
      .where(and(eq(trimColourways.trimId, t.id), eq(trimColourways.active, true)));
    const stocks = await db
      .select()
      .from(trimStock)
      .where(eq(trimStock.trimId, t.id));
    const total =
      stocks.length > 0
        ? stocks.reduce((s, r) => s + r.quantityOnHand, 0)
        : t.quantityOnHand;
    cards.push({
      id: t.id,
      name: t.name,
      kind: t.kind,
      hasColourVariants: t.hasColourVariants,
      colourCount: cws.length,
      total,
      hexes: cws
        .map((c) => c.hexApproximation)
        .filter((h): h is string => Boolean(h))
        .slice(0, 5),
      gradient: colourGradient(
        cws[0]?.colourName ?? "Ivory",
        cws[0]?.hexApproximation,
      ),
    });
  }
  return cards;
}

export async function getTrimDetail(trimId: string): Promise<{
  id: string;
  name: string;
  hasColourVariants: boolean;
  colours: {
    id: string;
    colourName: string;
    hex: string | null;
    onHand: number;
    stockId: string;
    gradient: string;
  }[];
  stockIdIfPlain: string | null;
} | null> {
  await requirePermission("inventory.view");
  const [t] = await db.select().from(trims).where(eq(trims.id, trimId)).limit(1);
  if (!t) return null;

  if (!t.hasColourVariants) {
    const stockId = await ensureTrimStockRow(trimId, null);
    return {
      id: t.id,
      name: t.name,
      hasColourVariants: false,
      colours: [],
      stockIdIfPlain: stockId,
    };
  }

  const cws = await db
    .select()
    .from(trimColourways)
    .where(and(eq(trimColourways.trimId, trimId), eq(trimColourways.active, true)))
    .orderBy(asc(trimColourways.colourName));

  const colours = [];
  for (const cw of cws) {
    const stockId = await ensureTrimStockRow(trimId, cw.id);
    const [row] = await db
      .select()
      .from(trimStock)
      .where(eq(trimStock.id, stockId))
      .limit(1);
    colours.push({
      id: cw.id,
      colourName: cw.colourName,
      hex: cw.hexApproximation,
      onHand: row?.quantityOnHand ?? 0,
      stockId,
      gradient: colourGradient(cw.colourName, cw.hexApproximation),
    });
  }
  return {
    id: t.id,
    name: t.name,
    hasColourVariants: true,
    colours,
    stockIdIfPlain: null,
  };
}

export async function getTrimLedger(
  trimStockId: string,
): Promise<StockLedgerDetail | null> {
  await requirePermission("inventory.view");
  const [row] = await db
    .select()
    .from(trimStock)
    .where(eq(trimStock.id, trimStockId))
    .limit(1);
  if (!row) return null;
  const [t] = await db
    .select()
    .from(trims)
    .where(eq(trims.id, row.trimId))
    .limit(1);
  let colourName: string | null = null;
  let hex: string | null = null;
  if (row.trimColourwayId) {
    const [cw] = await db
      .select()
      .from(trimColourways)
      .where(eq(trimColourways.id, row.trimColourwayId))
      .limit(1);
    colourName = cw?.colourName ?? null;
    hex = cw?.hexApproximation ?? null;
  }
  const movs = await db
    .select()
    .from(trimMovements)
    .where(eq(trimMovements.trimStockId, trimStockId))
    .orderBy(desc(trimMovements.createdAt))
    .limit(50);

  return {
    title: colourName ? `${t?.name ?? "Trim"} · ${colourName}` : (t?.name ?? "Trim"),
    subtitle: "Trim",
    photoUrl: null,
    photoGradient: colourGradient(colourName ?? "Ivory", hex),
    figures: {
      onHand: row.quantityOnHand,
      reserved: row.quantityReserved,
      available: Math.max(0, row.quantityOnHand - row.quantityReserved),
      unit: "pcs",
    },
    movements: movs.map(mapMov),
    stockKind: "trim",
    stockId: trimStockId,
  };
}
