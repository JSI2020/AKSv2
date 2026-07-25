import { and, eq, inArray } from "drizzle-orm";

import {
  db,
  designGenerations,
  designInputs,
  designLocks,
  designRenders,
  designs,
  designTags,
  houseModels,
  STUDIO_SETTINGS_SINGLETON_ID,
  studioSettings,
} from "@aks/db";
import { formatModelDisclosure } from "@aks/shared";

const GALLERY_ANGLES = ["FRONT", "THREE_QUARTER", "BACK"] as const;

export type PublishChecklistItem = {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
};

export type PublishChecklist = {
  items: PublishChecklistItem[];
  allPassed: boolean;
  modelDisclosure: string | null;
};

export async function buildPublishChecklist(
  designId: string,
): Promise<PublishChecklist> {
  const [design] = await db
    .select()
    .from(designs)
    .where(eq(designs.id, designId))
    .limit(1);

  if (!design) {
    return { items: [], allPassed: false, modelDisclosure: null };
  }

  const [heroLock, angleLock, tags, renders, externalInputs, settings] =
    await Promise.all([
      db
        .select()
        .from(designLocks)
        .where(
          and(
            eq(designLocks.designId, designId),
            eq(designLocks.stage, "HERO"),
          ),
        )
        .limit(1),
      db
        .select()
        .from(designLocks)
        .where(
          and(
            eq(designLocks.designId, designId),
            eq(designLocks.stage, "ANGLE"),
          ),
        )
        .limit(1),
      db.select().from(designTags).where(eq(designTags.designId, designId)),
      db
        .select()
        .from(designRenders)
        .where(eq(designRenders.designId, designId)),
      db
        .select({ id: designInputs.id })
        .from(designInputs)
        .where(
          and(
            eq(designInputs.designId, designId),
            eq(designInputs.role, "REFERENCE_EXTERNAL"),
          ),
        )
        .limit(1),
      db
        .select({ leadTimeDays: studioSettings.defaultLeadTimeDays })
        .from(studioSettings)
        .where(eq(studioSettings.id, STUDIO_SETTINGS_SINGLETON_ID))
        .limit(1),
    ]);

  const approvedAngles = await db
    .select({ angle: designGenerations.angle })
    .from(designGenerations)
    .where(
      and(
        eq(designGenerations.designId, designId),
        eq(designGenerations.stage, "ANGLE"),
        eq(designGenerations.decision, "APPROVED"),
        inArray(designGenerations.angle, ["THREE_QUARTER", "BACK"]),
      ),
    );

  const derivedApproved = new Set(approvedAngles.map((a) => a.angle));
  const anglesLocked =
    Boolean(heroLock[0]) &&
    Boolean(angleLock[0]) &&
    derivedApproved.has("THREE_QUARTER") &&
    derivedApproved.has("BACK");

  const rendersByColourway = new Map<string, typeof renders>();
  for (const render of renders) {
    const list = rendersByColourway.get(render.colourwayId) ?? [];
    list.push(render);
    rendersByColourway.set(render.colourwayId, list);
  }

  let colourwaysApproved = 0;
  for (const [, cwRenders] of rendersByColourway) {
    const angles = new Set(
      cwRenders
        .filter((r) =>
          (GALLERY_ANGLES as readonly string[]).includes(r.angle),
        )
        .map((r) => r.angle),
    );
    if (GALLERY_ANGLES.every((a) => angles.has(a))) {
      colourwaysApproved += 1;
    }
  }

  const components = design.components ?? [];
  const fitProfiles = design.fitProfileIds ?? {};
  const fitPerComponent =
    components.length === 0
      ? Object.keys(fitProfiles).length >= 1
      : components.every((c) => Boolean(fitProfiles[c]));

  const leadTimeSet =
    design.leadTimeDaysOverride != null ||
    (settings[0]?.leadTimeDays ?? 0) > 0;

  const missingAlt = renders.filter((r) => !r.altText.trim());
  const nonAiRenders = renders.filter((r) => !r.isAiGenerated);

  const archetypeId = renders.find((r) => r.archetypeId)?.archetypeId;
  let modelDisclosure: string | null = null;
  if (archetypeId) {
    const [model] = await db
      .select()
      .from(houseModels)
      .where(eq(houseModels.id, archetypeId))
      .limit(1);
    if (model) {
      modelDisclosure = formatModelDisclosure(model);
    }
  }

  const hasOccasion = tags.some((t) => t.kind === "OCCASION");
  const hasSeason = tags.some((t) => t.kind === "SEASON");
  const hasWork = tags.some((t) => t.kind === "WORK");

  const ipReviewed =
    !design.externalReferencesFlagged && externalInputs.length === 0
      ? true
      : design.externalReferencesFlagged
        ? externalInputs.length > 0
        : true;

  const items: PublishChecklistItem[] = [
    {
      id: "hero_locked",
      label: "Hero locked",
      passed: Boolean(heroLock[0]),
    },
    {
      id: "angles_locked",
      label: "Angles locked (3/3)",
      passed: anglesLocked,
      detail: anglesLocked
        ? undefined
        : "Front hero plus approved three-quarter and back",
    },
    {
      id: "colourway_approved",
      label: "≥1 colourway approved",
      passed: colourwaysApproved >= 1,
      detail:
        colourwaysApproved >= 1
          ? `${colourwaysApproved} colourway(s) with full angle sets`
          : "Approve a colourway set on the colourways stage",
    },
    {
      id: "pricing",
      label: "Base price, fabric consumption, lead time set",
      passed:
        design.basePriceMinor > 0 &&
        design.fabricConsumptionMeters > 0 &&
        leadTimeSet,
    },
    {
      id: "size_block",
      label: "Size block resolved per component",
      passed: Boolean(design.sizeBlockId),
    },
    {
      id: "fit_profile",
      label: "Fit profile per component",
      passed: fitPerComponent,
    },
    {
      id: "tags",
      label: "Occasion, season, and work tags",
      passed: hasOccasion && hasSeason && hasWork,
    },
    {
      id: "alt_text",
      label: "Alt text on every render",
      passed: renders.length > 0 && missingAlt.length === 0,
      detail:
        missingAlt.length > 0
          ? `${missingAlt.length} render(s) missing alt text`
          : undefined,
    },
    {
      id: "ai_label",
      label: "AI-visualization label on all customer-facing renders",
      passed: renders.length > 0 && nonAiRenders.length === 0,
      detail:
        nonAiRenders.length > 0
          ? `${nonAiRenders.length} render(s) not marked AI-generated`
          : undefined,
    },
    {
      id: "model_disclosure",
      label: "Model disclosure string present",
      passed: Boolean(modelDisclosure),
    },
    {
      id: "ip_attestation",
      label: "IP attestation reviewed (if external references used)",
      passed: ipReviewed,
      detail: design.externalReferencesFlagged
        ? "External references flagged on this design"
        : undefined,
    },
  ];

  return {
    items,
    allPassed: items.every((i) => i.passed),
    modelDisclosure,
  };
}

export async function countApprovedColourways(
  designId: string,
): Promise<number> {
  const renders = await db
    .select({
      colourwayId: designRenders.colourwayId,
      angle: designRenders.angle,
    })
    .from(designRenders)
    .where(
      and(
        eq(designRenders.designId, designId),
        inArray(designRenders.angle, [...GALLERY_ANGLES]),
      ),
    );

  const byColourway = new Map<string, Set<string>>();
  for (const row of renders) {
    const set = byColourway.get(row.colourwayId) ?? new Set<string>();
    set.add(row.angle);
    byColourway.set(row.colourwayId, set);
  }

  let count = 0;
  for (const angles of byColourway.values()) {
    if (GALLERY_ANGLES.every((a) => angles.has(a))) count += 1;
  }
  return count;
}
