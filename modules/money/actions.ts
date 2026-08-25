"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  db,
  designCosts,
  designs,
  fabrics,
  insertAuditLog,
  rates,
  recurringCosts,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { requirePermission } from "@/modules/auth";

import { computeDesignCost, type RateRow } from "./compute";
import { aiCostMinorForDesign } from "./queries-internal";

export type MoneyActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

async function loadRatesById(): Promise<Map<string, RateRow>> {
  const rows = await db.select().from(rates).where(eq(rates.active, true));
  const map = new Map<string, RateRow>();
  for (const row of rows) {
    map.set(row.id, {
      id: row.id,
      kind: row.kind,
      name: row.name,
      amountMinor: row.amountMinor,
      unit: row.unit,
    });
  }
  return map;
}

function parseOptionalInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

export async function saveDesignCosting(
  formData: FormData,
): Promise<MoneyActionResult> {
  try {
    const session = await requirePermission("money.edit_costs");
    const designId = String(formData.get("designId") ?? "");
    let fabricId = String(formData.get("fabricId") ?? "");
    const fabricMeters = Number.parseInt(
      String(formData.get("fabricMeters") ?? ""),
      10,
    );
    const embroideryRateId =
      String(formData.get("embroideryRateId") ?? "").trim() || null;
    const embroideryFlatMinor = parseOptionalInt(
      String(formData.get("embroideryFlatMinor") ?? ""),
    );
    const stitchingRateId =
      String(formData.get("stitchingRateId") ?? "").trim() || null;
    const stitchingFlatMinor = parseOptionalInt(
      String(formData.get("stitchingFlatMinor") ?? ""),
    );
    const packagingMinor = Number.parseInt(
      String(formData.get("packagingMinor") ?? "0"),
      10,
    );
    const shippingMinor = Number.parseInt(
      String(formData.get("shippingMinor") ?? "0"),
      10,
    );
    const overheadMinor = Number.parseInt(
      String(formData.get("overheadMinor") ?? "0"),
      10,
    );
    const costingMode =
      String(formData.get("costingMode") ?? "DETAILED_PER_PIECE").trim() ||
      "DETAILED_PER_PIECE";
    const pieceCostsRaw = String(formData.get("pieceCostsJson") ?? "[]");
    const totalLumpsumRaw = String(formData.get("totalLumpsumMinor") ?? "").trim();
    const totalLumpsumMinor = totalLumpsumRaw
      ? Number.parseInt(totalLumpsumRaw, 10)
      : null;

    // Selling price for margin comes from design retail (Price tab), not a draft here.
    const [designPrice] = await db
      .select({ basePriceMinor: designs.basePriceMinor })
      .from(designs)
      .where(eq(designs.id, designId))
      .limit(1);
    const sellingPriceMinor = designPrice?.basePriceMinor ?? 0;

    let pieceCosts: Array<{
      componentKey: string;
      mode: "DETAILED" | "LUMPSUM";
      fabricId?: string | null;
      fabricMeters?: number;
      stitchingRateId?: string | null;
      stitchingFlatMinor?: number | null;
      embroideryRateId?: string | null;
      embroideryFlatMinor?: number | null;
      lumpsumMinor?: number | null;
    }> = [];
    try {
      pieceCosts = JSON.parse(pieceCostsRaw) as typeof pieceCosts;
    } catch {
      return { ok: false, error: "Invalid piece costs" };
    }

    if (
      !designId ||
      !Number.isInteger(packagingMinor) ||
      packagingMinor < 0 ||
      !Number.isInteger(shippingMinor) ||
      shippingMinor < 0 ||
      !Number.isInteger(overheadMinor) ||
      overheadMinor < 0
    ) {
      return { ok: false, error: "Invalid costing input" };
    }

    if (!fabricId) {
      const [anyFabric] = await db
        .select({ id: fabrics.id })
        .from(fabrics)
        .where(eq(fabrics.active, true))
        .limit(1);
      if (!anyFabric) return { ok: false, error: "Add a fabric first" };
      fabricId = anyFabric.id;
    }

    if (!Number.isInteger(fabricMeters) || fabricMeters < 0) {
      return { ok: false, error: "Invalid fabric metres" };
    }

    let fabricMetersFinal = fabricMeters;
    let embroideryRateIdFinal = embroideryRateId;
    let embroideryFlatFinal = embroideryFlatMinor;
    let stitchingRateIdFinal = stitchingRateId;
    let stitchingFlatFinal = stitchingFlatMinor;

    if (costingMode === "TOTAL_LUMPSUM" && totalLumpsumMinor != null) {
      fabricMetersFinal = 0;
      embroideryRateIdFinal = null;
      embroideryFlatFinal = totalLumpsumMinor;
      stitchingRateIdFinal = null;
      stitchingFlatFinal = 0;
    } else if (pieceCosts.length > 0) {
      let metres = 0;
      let stitchFlat = 0;
      let embFlat = 0;
      let firstFabric = fabricId;
      for (const piece of pieceCosts) {
        if (piece.mode === "LUMPSUM") {
          embFlat += Math.max(0, piece.lumpsumMinor ?? 0);
        } else {
          metres += Math.max(0, piece.fabricMeters ?? 0);
          stitchFlat += Math.max(0, piece.stitchingFlatMinor ?? 0);
          embFlat += Math.max(0, piece.embroideryFlatMinor ?? 0);
          if (piece.fabricId) firstFabric = piece.fabricId;
        }
      }
      fabricMetersFinal = metres;
      stitchingFlatFinal = stitchFlat;
      embroideryFlatFinal = embFlat;
      stitchingRateIdFinal = null;
      embroideryRateIdFinal = null;
      fabricId = firstFabric;
    }

    const [fabricFinal] = await db
      .select({ costPerMeterMinor: fabrics.costPerMeterMinor })
      .from(fabrics)
      .where(eq(fabrics.id, fabricId))
      .limit(1);
    if (!fabricFinal) return { ok: false, error: "Fabric not found" };

    const ratesById = await loadRatesById();
    const aiCostMinor = await aiCostMinorForDesign(designId);

    const breakdown = computeDesignCost({
      fabricCostPerMeterMinor: fabricFinal.costPerMeterMinor,
      fabricMeters: fabricMetersFinal,
      embroideryRateId: embroideryRateIdFinal,
      embroideryFlatMinor: embroideryFlatFinal,
      stitchingRateId: stitchingRateIdFinal,
      stitchingFlatMinor: stitchingFlatFinal,
      packagingMinor,
      shippingMinor,
      overheadMinor,
      aiCostMinor,
      sellingPriceMinor,
      ratesById,
    });

    const before = await db
      .select()
      .from(designCosts)
      .where(eq(designCosts.designId, designId))
      .limit(1);

    await db
      .insert(designCosts)
      .values({
        designId,
        fabricId,
        fabricMeters: fabricMetersFinal,
        embroideryRateId: embroideryRateIdFinal,
        embroideryFlatMinor: embroideryFlatFinal,
        stitchingRateId: stitchingRateIdFinal,
        stitchingFlatMinor: stitchingFlatFinal,
        packagingMinor,
        shippingMinor,
        overheadMinor,
        costingMode,
        pieceCosts,
        totalLumpsumMinor:
          costingMode === "TOTAL_LUMPSUM" ? totalLumpsumMinor : null,
        aiCostMinor,
        totalCostMinor: breakdown.totalCostMinor,
        sellingPriceMinor,
        marginPercent: breakdown.marginPercent,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: designCosts.designId,
        set: {
          fabricId,
          fabricMeters: fabricMetersFinal,
          embroideryRateId: embroideryRateIdFinal,
          embroideryFlatMinor: embroideryFlatFinal,
          stitchingRateId: stitchingRateIdFinal,
          stitchingFlatMinor: stitchingFlatFinal,
          packagingMinor,
          shippingMinor,
          overheadMinor,
          costingMode,
          pieceCosts,
          totalLumpsumMinor:
            costingMode === "TOTAL_LUMPSUM" ? totalLumpsumMinor : null,
          aiCostMinor,
          totalCostMinor: breakdown.totalCostMinor,
          sellingPriceMinor,
          marginPercent: breakdown.marginPercent,
          updatedAt: new Date(),
        },
      });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "money.design_cost.save",
      entityType: "design_cost",
      entityId: designId,
      before: before[0] ?? null,
      after: breakdown,
    });

    revalidatePath(`/admin/designs/${designId}`);
    revalidatePath("/admin/money");
    return { ok: true, id: designId };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed",
    };
  }
}

export async function upsertRecurringCost(
  formData: FormData,
): Promise<MoneyActionResult> {
  try {
    const session = await requirePermission("money.edit_costs");
    const id = String(formData.get("id") ?? "").trim() || uuidv7();
    const name = String(formData.get("name") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const amountMinor = Number.parseInt(
      String(formData.get("amountMinor") ?? ""),
      10,
    );
    const cycle = String(formData.get("cycle") ?? "") as
      | "WEEKLY"
      | "MONTHLY"
      | "QUARTERLY"
      | "YEARLY";
    const startedAtRaw = String(formData.get("startedAt") ?? "").trim();
    const active = String(formData.get("active") ?? "true") === "true";

    if (
      !name ||
      !category ||
      !Number.isInteger(amountMinor) ||
      amountMinor < 0 ||
      !startedAtRaw
    ) {
      return { ok: false, error: "Invalid recurring cost" };
    }

    const startedAt = new Date(startedAtRaw);
    if (Number.isNaN(startedAt.getTime())) {
      return { ok: false, error: "Invalid start date" };
    }

    const existing = await db
      .select()
      .from(recurringCosts)
      .where(eq(recurringCosts.id, id))
      .limit(1);

    if (existing[0]) {
      await db
        .update(recurringCosts)
        .set({
          name,
          category,
          amountMinor,
          cycle,
          startedAt,
          active,
          updatedAt: new Date(),
        })
        .where(eq(recurringCosts.id, id));
    } else {
      await db.insert(recurringCosts).values({
        id,
        name,
        category,
        amountMinor,
        cycle,
        startedAt,
        active,
      });
    }

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: existing[0]
        ? "money.recurring_cost.update"
        : "money.recurring_cost.create",
      entityType: "recurring_cost",
      entityId: id,
      before: existing[0] ?? null,
      after: { name, category, amountMinor, cycle, active },
    });

    revalidatePath("/admin/money");
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed",
    };
  }
}

export async function upsertRate(
  formData: FormData,
): Promise<MoneyActionResult> {
  try {
    const session = await requirePermission("money.edit_costs");
    const id = String(formData.get("id") ?? "").trim() || uuidv7();
    const kind = String(formData.get("kind") ?? "") as
      | "STITCHING"
      | "EMBROIDERY"
      | "PACKAGING";
    const name = String(formData.get("name") ?? "").trim();
    const amountMinor = Number.parseInt(
      String(formData.get("amountMinor") ?? ""),
      10,
    );
    const unit = String(formData.get("unit") ?? "") as
      | "FLAT"
      | "PER_HOUR"
      | "PER_METRE";
    const active = String(formData.get("active") ?? "true") === "true";

    if (
      !name ||
      !Number.isInteger(amountMinor) ||
      amountMinor < 0 ||
      !["STITCHING", "EMBROIDERY", "PACKAGING"].includes(kind) ||
      !["FLAT", "PER_HOUR", "PER_METRE"].includes(unit)
    ) {
      return { ok: false, error: "Invalid rate" };
    }

    const existing = await db
      .select()
      .from(rates)
      .where(eq(rates.id, id))
      .limit(1);

    if (existing[0]) {
      await db
        .update(rates)
        .set({
          kind,
          name,
          amountMinor,
          unit,
          active,
          updatedAt: new Date(),
        })
        .where(eq(rates.id, id));
    } else {
      await db.insert(rates).values({
        id,
        kind,
        name,
        amountMinor,
        unit,
        active,
      });
    }

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: existing[0] ? "money.rate.update" : "money.rate.create",
      entityType: "rate",
      entityId: id,
      before: existing[0] ?? null,
      after: { kind, name, amountMinor, unit, active },
    });

    revalidatePath("/admin/money");
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed",
    };
  }
}
