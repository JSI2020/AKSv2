"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  db,
  designGenerations,
  designTags,
  designs,
  insertAuditLog,
} from "@aks/db";
import { isValidDesignTag, uuidv7 } from "@aks/shared";
import type { DesignStatus } from "@aks/shared";
import { requirePermission } from "@/modules/auth";
import {
  getMonthlySpendCapUsdMicros,
  getMonthlySpendUsdMicros,
} from "@/modules/ai/generation/spend-cap";
import { transition } from "@/modules/platform/transition";
import { getDesignPipelineStatus } from "@/modules/designs/studio-pipeline";
import { DESIGN_TRANSITION_ALLOW } from "@/modules/designs/transitions";

import { buildPublishChecklist, type PublishChecklist } from "./publish-checklist";

export type PublishPageData = {
  designId: string;
  designName: string;
  slug: string;
  status: DesignStatus;
  checklist: PublishChecklist;
  designSpendUsdMicros: number;
  attemptCount: number;
  monthlySpendUsdMicros: number;
  monthlyCapUsdMicros: number | null;
  externalReferencesFlagged: boolean;
};

type ActionResult<T = void> =
  | ({ ok: true } & (T extends void ? object : { data: T }))
  | { ok: false; error: string };

const PUBLISH_ALLOWED: DesignStatus[] = ["READY_TO_PUBLISH", "PUBLISHED"];

function revalidatePublish(designId: string) {
  revalidatePath(`/admin/studio/${designId}/publish`);
  revalidatePath(`/admin/studio/${designId}/colourways`);
  revalidatePath(`/admin/studio/${designId}`);
  revalidatePath(`/admin/designs/${designId}`);
  revalidatePath("/admin/designs");
}

export async function getPublishPageData(
  designId: string,
): Promise<PublishPageData | null> {
  await requirePermission("designs.create");

  const [design] = await db
    .select({
      id: designs.id,
      name: designs.name,
      slug: designs.slug,
      status: designs.status,
      externalReferencesFlagged: designs.externalReferencesFlagged,
    })
    .from(designs)
    .where(eq(designs.id, designId))
    .limit(1);
  if (!design) return null;

  const status = design.status as DesignStatus;
  if (!PUBLISH_ALLOWED.includes(status) && status !== "COLOURWAYS_REVIEW") {
    return null;
  }

  const checklist = await buildPublishChecklist(designId);

  const [spendRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${designGenerations.costUsdMicros}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(designGenerations)
    .where(eq(designGenerations.designId, designId));

  return {
    designId,
    designName: design.name,
    slug: design.slug,
    status,
    checklist,
    designSpendUsdMicros: spendRow?.total ?? 0,
    attemptCount: spendRow?.count ?? 0,
    monthlySpendUsdMicros: await getMonthlySpendUsdMicros(),
    monthlyCapUsdMicros: await getMonthlySpendCapUsdMicros(),
    externalReferencesFlagged: design.externalReferencesFlagged,
  };
}

export async function publishStudioDesign(
  designId: string,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("designs.publish");
    const status = await getDesignPipelineStatus(designId);
    if (status !== "READY_TO_PUBLISH") {
      return {
        ok: false,
        error: `Design must be READY_TO_PUBLISH to publish (current: ${status ?? "unknown"}).`,
      };
    }

    const checklist = await buildPublishChecklist(designId);
    if (!checklist.allPassed) {
      const failing = checklist.items.filter((i) => !i.passed).map((i) => i.label);
      return {
        ok: false,
        error: `Publish checklist incomplete: ${failing.join("; ")}`,
      };
    }

    await db.transaction(async (tx) => {
      await transition({
        entity: "design",
        id: designId,
        from: "READY_TO_PUBLISH",
        to: "PUBLISHED",
        actor: { id: session.user.id, role: session.user.role },
        allowList: DESIGN_TRANSITION_ALLOW,
        tx: tx as never,
      });
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.publish",
      entityType: "design",
      entityId: designId,
      before: { status: "READY_TO_PUBLISH" },
      after: { status: "PUBLISHED" },
    });

    revalidatePublish(designId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Publish failed",
    };
  }
}

export async function updatePublishMetadata(payload: {
  designId: string;
  basePriceMinor: number;
  fabricConsumptionMeters: number;
  leadTimeDaysOverride: number | null;
  occasionTag: string;
  seasonTag: string;
  workTag: string;
}): Promise<ActionResult> {
  try {
    const session = await requirePermission("designs.edit");

    for (const [kind, value] of [
      ["OCCASION", payload.occasionTag],
      ["SEASON", payload.seasonTag],
      ["WORK", payload.workTag],
    ] as const) {
      if (!isValidDesignTag(kind, value)) {
        return { ok: false, error: `Invalid ${kind} tag` };
      }
    }

    await db
      .update(designs)
      .set({
        basePriceMinor: payload.basePriceMinor,
        fabricConsumptionMeters: payload.fabricConsumptionMeters,
        leadTimeDaysOverride: payload.leadTimeDaysOverride,
        updatedAt: new Date(),
      })
      .where(eq(designs.id, payload.designId));

    await db.delete(designTags).where(eq(designTags.designId, payload.designId));

    for (const [kind, value] of [
      ["OCCASION", payload.occasionTag],
      ["SEASON", payload.seasonTag],
      ["WORK", payload.workTag],
    ] as const) {
      await db.insert(designTags).values({
        designId: payload.designId,
        kind,
        value,
      });
    }

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.publish_metadata",
      entityType: "design",
      entityId: payload.designId,
      before: null,
      after: {
        basePriceMinor: payload.basePriceMinor,
        fabricConsumptionMeters: payload.fabricConsumptionMeters,
      },
    });

    revalidatePublish(payload.designId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Update failed",
    };
  }
}
