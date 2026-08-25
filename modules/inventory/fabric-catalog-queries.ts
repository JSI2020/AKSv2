import { and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";

import { assets, db, fabricLots, fabrics } from "@aks/db";

import { requirePermission } from "@/modules/auth";
import { createPresignedReadUrl } from "@/modules/platform/assets";

import { lotAvailableMeters } from "./lot-status";
import {
  countFabricsBelowReorderPoint,
  listFabricsBelowReorderPoint,
} from "./stock-queries";

export type FabricCatalogFilters = {
  q?: string;
  drapeClass?: "LIGHT" | "MEDIUM" | "HEAVY";
  lowStockOnly?: boolean;
};

export type FabricCatalogItem = {
  id: string;
  name: string;
  composition: string;
  drapeClass: "LIGHT" | "MEDIUM" | "HEAVY";
  costPerMeterMinor: number;
  drapeNotes: string | null;
  active: boolean;
  metersOnHand: number;
  metersReserved: number;
  metersAvailable: number;
  reorderPointMeters: number;
  isLowStock: boolean;
  swatchUrl: string | null;
};

export type FabricCatalogResult = {
  items: FabricCatalogItem[];
  lowStockCount: number;
};

async function resolveSwatchUrl(
  assetId: string | null,
): Promise<string | null> {
  if (!assetId) return null;
  const [row] = await db
    .select({ r2Key: assets.r2Key })
    .from(assets)
    .where(eq(assets.id, assetId))
    .limit(1);
  if (!row?.r2Key) return null;
  try {
    return await createPresignedReadUrl(row.r2Key, 3600);
  } catch {
    return null;
  }
}

export async function listFabricsCatalog(
  filters: FabricCatalogFilters = {},
): Promise<FabricCatalogResult> {
  await requirePermission("fabric.view");

  const conditions = [];
  if (filters.q?.trim()) {
    const term = `%${filters.q.trim()}%`;
    conditions.push(
      or(ilike(fabrics.name, term), ilike(fabrics.composition, term)),
    );
  }
  if (filters.drapeClass) {
    conditions.push(eq(fabrics.drapeClass, filters.drapeClass));
  }

  const whereClause = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(fabrics)
    .where(
      whereClause
        ? and(whereClause, eq(fabrics.active, true))
        : eq(fabrics.active, true),
    )
    .orderBy(asc(fabrics.name));

  const lowRows = await listFabricsBelowReorderPoint();
  const lowIds = new Set(lowRows.map((r) => r.id));
  const lowStockCount = await countFabricsBelowReorderPoint();

  const items: FabricCatalogItem[] = [];
  for (const row of rows) {
    if (filters.lowStockOnly && !lowIds.has(row.id)) continue;

    const lots = await db
      .select({
        metersOnHand: fabricLots.metersOnHand,
        metersReserved: fabricLots.metersReserved,
        status: fabricLots.status,
      })
      .from(fabricLots)
      .where(
        and(
          eq(fabricLots.fabricId, row.id),
          inArray(fabricLots.status, ["AVAILABLE", "LOW"]),
        ),
      );

    const metersOnHand = lots.reduce((s, l) => s + l.metersOnHand, 0);
    const metersReserved = lots.reduce((s, l) => s + l.metersReserved, 0);
    const metersAvailable = lots.reduce((s, l) => s + lotAvailableMeters(l), 0);

    items.push({
      id: row.id,
      name: row.name,
      composition: row.composition,
      drapeClass: row.drapeClass,
      costPerMeterMinor: row.costPerMeterMinor,
      drapeNotes: row.drapeNotes,
      active: row.active,
      metersOnHand,
      metersReserved,
      metersAvailable,
      reorderPointMeters: row.reorderPointMeters,
      isLowStock: lowIds.has(row.id),
      swatchUrl: await resolveSwatchUrl(row.swatchAssetId),
    });
  }

  return { items, lowStockCount };
}

export type FabricLotRow = {
  id: string;
  lotCode: string;
  colourNotes: string | null;
  dyeLotRef: string | null;
  receivedAt: Date;
  metersOnHand: number;
  metersReserved: number;
  metersAvailable: number;
  status: string;
};

export type FabricStockDetail = {
  metersOnHand: number;
  metersReserved: number;
  metersAvailable: number;
  reorderPointMeters: number;
  isLowStock: boolean;
  lots: FabricLotRow[];
  swatchUrl: string | null;
};

export async function getFabricStockDetail(
  fabricId: string,
): Promise<FabricStockDetail | null> {
  await requirePermission("fabric.view");

  const [fabric] = await db
    .select({
      id: fabrics.id,
      reorderPointMeters: fabrics.reorderPointMeters,
      swatchAssetId: fabrics.swatchAssetId,
    })
    .from(fabrics)
    .where(eq(fabrics.id, fabricId))
    .limit(1);

  if (!fabric) return null;

  const lotRows = await db
    .select()
    .from(fabricLots)
    .where(eq(fabricLots.fabricId, fabricId))
    .orderBy(desc(fabricLots.receivedAt));

  const activeLots = lotRows.filter(
    (l) => l.status === "AVAILABLE" || l.status === "LOW",
  );
  const metersOnHand = activeLots.reduce((s, l) => s + l.metersOnHand, 0);
  const metersReserved = activeLots.reduce((s, l) => s + l.metersReserved, 0);
  const metersAvailable = activeLots.reduce(
    (s, l) => s + lotAvailableMeters(l),
    0,
  );

  const low = await listFabricsBelowReorderPoint();
  const isLowStock = low.some((r) => r.id === fabricId);

  return {
    metersOnHand,
    metersReserved,
    metersAvailable,
    reorderPointMeters: fabric.reorderPointMeters,
    isLowStock,
    lots: lotRows.map((l) => ({
      id: l.id,
      lotCode: l.lotCode,
      colourNotes: l.colourNotes,
      dyeLotRef: l.dyeLotRef,
      receivedAt: l.receivedAt,
      metersOnHand: l.metersOnHand,
      metersReserved: l.metersReserved,
      metersAvailable: lotAvailableMeters(l),
      status: l.status,
    })),
    swatchUrl: await resolveSwatchUrl(fabric.swatchAssetId),
  };
}

/** @internal */
export const __fabricCatalogInternals = {
  resolveSwatchUrl,
};
