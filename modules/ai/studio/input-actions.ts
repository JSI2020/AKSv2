"use server";

import { asc, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  assets,
  db,
  designInputAttestations,
  designInputs,
  designPromptProfiles,
  designs,
  insertAuditLog,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";
import { requirePermission } from "@/modules/auth";
import {
  completeUpload,
  createPresignedReadUrl,
  getObjectBytes,
  uploadBufferToR2,
} from "@/modules/platform/assets";

import {
  EXTERNAL_ATTESTATION_STATEMENT,
  EXTERNAL_REFERENCE_PURGE_DAYS,
  type DesignInputRole,
  isSketchRole,
} from "./input-roles";
import {
  inferPromptProfileOrigin,
  type PromptProfileOrigin,
} from "./infer-origin";
import { preprocessSketch } from "./sketch-preprocess";

export type DesignInputRow = {
  id: string;
  designId: string;
  assetId: string;
  role: DesignInputRole;
  weight: number;
  derivedAssetId: string | null;
  attestationId: string | null;
  purgeAt: string | null;
  assetMime: string;
  assetReadUrl: string;
  derivedReadUrl: string | null;
  filenameHint: string;
};

export type DesignInputsPageData = {
  designId: string;
  designName: string;
  origin: PromptProfileOrigin;
  originOverridden: boolean;
  externalReferencesFlagged: boolean;
  inputs: DesignInputRow[];
};

type ActionResult<T = void> =
  | ({ ok: true } & (T extends void ? object : { data: T }))
  | { ok: false; error: string };

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function requireDesign(designId: string) {
  const [row] = await db
    .select({ id: designs.id, name: designs.name })
    .from(designs)
    .where(eq(designs.id, designId))
    .limit(1);
  if (!row) throw new Error("Design not found");
  return row;
}

async function syncDesignFlags(designId: string) {
  const rows = await db
    .select({ role: designInputs.role })
    .from(designInputs)
    .where(eq(designInputs.designId, designId));

  const hasExternal = rows.some((r) => r.role === "REFERENCE_EXTERNAL");
  await db
    .update(designs)
    .set({
      externalReferencesFlagged: hasExternal,
      updatedAt: new Date(),
    })
    .where(eq(designs.id, designId));

  return rows.map((r) => r.role as DesignInputRole);
}

async function syncOrigin(designId: string, roles: DesignInputRole[]) {
  const origin = inferPromptProfileOrigin(roles);

  await db
    .update(designPromptProfiles)
    .set({
      origin,
      updatedAt: new Date(),
    })
    .where(eq(designPromptProfiles.designId, designId));

  return origin;
}

async function processSketchDerivative(assetId: string): Promise<string | null> {
  const [asset] = await db
    .select({ r2Key: assets.r2Key, mime: assets.mime })
    .from(assets)
    .where(eq(assets.id, assetId))
    .limit(1);
  if (!asset?.mime.startsWith("image/")) return null;

  const bytes = await getObjectBytes(asset.r2Key);
  const { lineart } = await preprocessSketch(bytes);

  const { key } = await uploadBufferToR2({
    body: lineart,
    mime: "image/png",
    keyPrefix: "sketches/lineart",
  });

  const derived = await completeUpload({
    key,
    mime: "image/png",
    kind: "IMAGE",
  });

  return derived.id;
}

export async function getDesignInputsPageData(
  designId: string,
): Promise<DesignInputsPageData | null> {
  await requirePermission("designs.create");

  const [design] = await db
    .select({
      id: designs.id,
      name: designs.name,
      externalReferencesFlagged: designs.externalReferencesFlagged,
    })
    .from(designs)
    .where(eq(designs.id, designId))
    .limit(1);
  if (!design) return null;

  const [profile] = await db
    .select({ origin: designPromptProfiles.origin })
    .from(designPromptProfiles)
    .where(eq(designPromptProfiles.designId, designId))
    .limit(1);
  if (!profile) return null;

  const rows = await db
    .select({
      input: designInputs,
      asset: assets,
    })
    .from(designInputs)
    .innerJoin(assets, eq(designInputs.assetId, assets.id))
    .where(eq(designInputs.designId, designId))
    .orderBy(asc(designInputs.createdAt));

  const inputs: DesignInputRow[] = [];
  for (const row of rows) {
    let derivedReadUrl: string | null = null;
    if (row.input.derivedAssetId) {
      const [derived] = await db
        .select({ r2Key: assets.r2Key })
        .from(assets)
        .where(eq(assets.id, row.input.derivedAssetId))
        .limit(1);
      if (derived) {
        derivedReadUrl = await createPresignedReadUrl(derived.r2Key, 3600);
      }
    }

    const filenameHint = row.asset.r2Key.split("/").pop() ?? row.asset.id;

    inputs.push({
      id: row.input.id,
      designId: row.input.designId,
      assetId: row.input.assetId,
      role: row.input.role as DesignInputRole,
      weight: row.input.weight,
      derivedAssetId: row.input.derivedAssetId,
      attestationId: row.input.attestationId,
      purgeAt: row.input.purgeAt?.toISOString() ?? null,
      assetMime: row.asset.mime,
      assetReadUrl: await createPresignedReadUrl(row.asset.r2Key, 3600),
      derivedReadUrl,
      filenameHint,
    });
  }

  const roles = inputs.map((i) => i.role);
  const inferred = inferPromptProfileOrigin(roles);

  return {
    designId: design.id,
    designName: design.name,
    origin: profile.origin as PromptProfileOrigin,
    originOverridden: profile.origin !== inferred && inputs.length > 0,
    externalReferencesFlagged: design.externalReferencesFlagged,
    inputs,
  };
}

export async function addDesignInput(payload: {
  designId: string;
  assetId: string;
  role: DesignInputRole;
  weight: number;
  externalAttestationConfirmed?: boolean;
}): Promise<ActionResult<{ inputId: string }>> {
  try {
    const session = await requirePermission("designs.create");
    await requireDesign(payload.designId);

    const weight = Math.max(0, Math.min(100, Math.round(payload.weight)));

    if (
      payload.role === "REFERENCE_EXTERNAL" &&
      !payload.externalAttestationConfirmed
    ) {
      return {
        ok: false,
        error: "External references require IP attestation before upload.",
      };
    }

    const inputId = uuidv7();
    let attestationId: string | null = null;
    let purgeAt: Date | null = null;

    if (payload.role === "REFERENCE_EXTERNAL") {
      const [maxRow] = await db
        .select({ v: max(designInputAttestations.version) })
        .from(designInputAttestations)
        .where(eq(designInputAttestations.designId, payload.designId));

      attestationId = uuidv7();
      const version = (maxRow?.v ?? 0) + 1;
      purgeAt = addDays(new Date(), EXTERNAL_REFERENCE_PURGE_DAYS);

      await db.insert(designInputAttestations).values({
        id: attestationId,
        designId: payload.designId,
        statement: EXTERNAL_ATTESTATION_STATEMENT,
        version,
        attestedById: session.user.id,
      });

      await db
        .update(assets)
        .set({ purgeAt, updatedAt: new Date() })
        .where(eq(assets.id, payload.assetId));
    }

    let derivedAssetId: string | null = null;
    if (isSketchRole(payload.role)) {
      derivedAssetId = await processSketchDerivative(payload.assetId);
    }

    await db.insert(designInputs).values({
      id: inputId,
      designId: payload.designId,
      assetId: payload.assetId,
      role: payload.role,
      weight,
      derivedAssetId,
      attestationId,
      purgeAt,
    });

    const roles = await syncDesignFlags(payload.designId);
    await syncOrigin(payload.designId, roles);

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.input.add",
      entityType: "design",
      entityId: payload.designId,
      before: null,
      after: {
        inputId,
        role: payload.role,
        assetId: payload.assetId,
        attestationId,
      },
    });

    revalidatePath(`/admin/studio/${payload.designId}/inputs`);
    return { ok: true, data: { inputId } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Add input failed",
    };
  }
}

export async function updateDesignInput(payload: {
  inputId: string;
  role?: DesignInputRole;
  weight?: number;
  externalAttestationConfirmed?: boolean;
}): Promise<ActionResult> {
  try {
    const session = await requirePermission("designs.create");

    const [existing] = await db
      .select()
      .from(designInputs)
      .where(eq(designInputs.id, payload.inputId))
      .limit(1);
    if (!existing) return { ok: false, error: "Input not found" };

    const nextRole = (payload.role ?? existing.role) as DesignInputRole;
    const nextWeight =
      payload.weight !== undefined
        ? Math.max(0, Math.min(100, Math.round(payload.weight)))
        : existing.weight;

    if (
      nextRole === "REFERENCE_EXTERNAL" &&
      !existing.attestationId &&
      !payload.externalAttestationConfirmed
    ) {
      return {
        ok: false,
        error: "External references require IP attestation.",
      };
    }

    let attestationId = existing.attestationId;
    let purgeAt = existing.purgeAt;

    if (
      nextRole === "REFERENCE_EXTERNAL" &&
      !existing.attestationId &&
      payload.externalAttestationConfirmed
    ) {
      const [maxRow] = await db
        .select({ v: max(designInputAttestations.version) })
        .from(designInputAttestations)
        .where(eq(designInputAttestations.designId, existing.designId));

      attestationId = uuidv7();
      const version = (maxRow?.v ?? 0) + 1;
      purgeAt = addDays(new Date(), EXTERNAL_REFERENCE_PURGE_DAYS);

      await db.insert(designInputAttestations).values({
        id: attestationId,
        designId: existing.designId,
        statement: EXTERNAL_ATTESTATION_STATEMENT,
        version,
        attestedById: session.user.id,
      });

      await db
        .update(assets)
        .set({ purgeAt, updatedAt: new Date() })
        .where(eq(assets.id, existing.assetId));
    }

    let derivedAssetId = existing.derivedAssetId;
    if (isSketchRole(nextRole) && !derivedAssetId) {
      derivedAssetId = await processSketchDerivative(existing.assetId);
    }
    if (!isSketchRole(nextRole)) {
      derivedAssetId = null;
    }

    await db
      .update(designInputs)
      .set({
        role: nextRole,
        weight: nextWeight,
        attestationId,
        purgeAt,
        derivedAssetId,
        updatedAt: new Date(),
      })
      .where(eq(designInputs.id, payload.inputId));

    const roles = await syncDesignFlags(existing.designId);
    await syncOrigin(existing.designId, roles);

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.input.update",
      entityType: "design",
      entityId: existing.designId,
      before: { role: existing.role, weight: existing.weight },
      after: { role: nextRole, weight: nextWeight },
    });

    revalidatePath(`/admin/studio/${existing.designId}/inputs`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Update failed",
    };
  }
}

export async function removeDesignInput(
  inputId: string,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("designs.create");

    const [existing] = await db
      .select()
      .from(designInputs)
      .where(eq(designInputs.id, inputId))
      .limit(1);
    if (!existing) return { ok: false, error: "Input not found" };

    await db.delete(designInputs).where(eq(designInputs.id, inputId));

    const roles = await syncDesignFlags(existing.designId);
    await syncOrigin(existing.designId, roles);

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.input.remove",
      entityType: "design",
      entityId: existing.designId,
      before: { inputId, role: existing.role },
      after: null,
    });

    revalidatePath(`/admin/studio/${existing.designId}/inputs`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Remove failed",
    };
  }
}

export async function setDesignOriginOverride(payload: {
  designId: string;
  origin: PromptProfileOrigin;
}): Promise<ActionResult> {
  try {
    const session = await requirePermission("designs.create");
    await requireDesign(payload.designId);

    await db
      .update(designPromptProfiles)
      .set({
        origin: payload.origin,
        updatedAt: new Date(),
      })
      .where(eq(designPromptProfiles.designId, payload.designId));

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.origin.override",
      entityType: "design",
      entityId: payload.designId,
      before: null,
      after: { origin: payload.origin },
    });

    revalidatePath(`/admin/studio/${payload.designId}/inputs`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Origin update failed",
    };
  }
}

export async function resetDesignOriginToInferred(
  designId: string,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("designs.create");
    await requireDesign(designId);

    const rows = await db
      .select({ role: designInputs.role })
      .from(designInputs)
      .where(eq(designInputs.designId, designId));

    const roles = rows.map((r) => r.role as DesignInputRole);
    const origin = inferPromptProfileOrigin(roles);

    await db
      .update(designPromptProfiles)
      .set({ origin, updatedAt: new Date() })
      .where(eq(designPromptProfiles.designId, designId));

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.origin.reset",
      entityType: "design",
      entityId: designId,
      before: null,
      after: { origin },
    });

    revalidatePath(`/admin/studio/${designId}/inputs`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Reset failed",
    };
  }
}
