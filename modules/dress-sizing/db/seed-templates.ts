import { eq } from "drizzle-orm";
import { uuidv7 } from "@aks/shared";
import type { Database } from "@/packages/db";
import {
  dressStyleTemplate, dressStyleTemplateFitWeight, dressStyleTemplatePom,
} from "@/packages/db/schema";
import { STYLE_TEMPLATE_SEEDS } from "./template-seeds";

export async function seedStyleTemplates(db: Database): Promise<number> {
  for (const seed of STYLE_TEMPLATE_SEEDS) {
    const [existing] = await db.select().from(dressStyleTemplate)
      .where(eq(dressStyleTemplate.key, seed.key)).limit(1);
    const templateId = existing?.id ?? uuidv7();
    if (existing) {
      await db.update(dressStyleTemplate)
        .set({ category: seed.category, baseSize: seed.baseSize ?? "M" })
        .where(eq(dressStyleTemplate.id, templateId));
      await db.delete(dressStyleTemplatePom).where(eq(dressStyleTemplatePom.templateId, templateId));
      await db.delete(dressStyleTemplateFitWeight).where(eq(dressStyleTemplateFitWeight.templateId, templateId));
    } else {
      await db.insert(dressStyleTemplate).values({
        id: templateId, key: seed.key, category: seed.category, baseSize: seed.baseSize ?? "M",
      });
    }
    await db.insert(dressStyleTemplatePom).values(seed.poms.map((pom) => ({
      id: uuidv7(), templateId, ...pom,
    })));
    await db.insert(dressStyleTemplateFitWeight).values(seed.fitWeights.map((weight) => ({
      id: uuidv7(), templateId, ...weight,
    })));
  }
  return STYLE_TEMPLATE_SEEDS.length;
}
