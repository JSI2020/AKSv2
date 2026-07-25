import { and, eq } from "drizzle-orm";

import { designEvents, designs } from "@aks/db";
import {
  DESIGN_STATUS_ALLOW,
  type DesignStatus,
} from "@aks/shared";
import {
  registerEntityTransitions,
  type TransitionAllowList,
} from "@/modules/platform/transition";

export const DESIGN_TRANSITION_ALLOW: TransitionAllowList =
  DESIGN_STATUS_ALLOW as TransitionAllowList;

let registered = false;

export function registerDesignTransitions(): void {
  if (registered) return;
  registered = true;
  registerEntityTransitions("design", {
    applyStatusChange: async (tx, id, from, to) => {
      const patch: {
        status: DesignStatus;
        updatedAt: Date;
        publishedAt?: Date | null;
        archivedAt?: Date | null;
      } = {
        status: to as DesignStatus,
        updatedAt: new Date(),
      };
      if (to === "PUBLISHED") patch.publishedAt = new Date();
      if (to === "ARCHIVED") patch.archivedAt = new Date();
      if (to === "DRAFT") {
        patch.publishedAt = null;
        patch.archivedAt = null;
      }

      const rows = await tx
        .update(designs)
        .set(patch)
        .where(and(eq(designs.id, id), eq(designs.status, from as DesignStatus)))
        .returning({ id: designs.id });
      return rows.length;
    },
    insertEvent: async (tx, row) => {
      await tx.insert(designEvents).values(row);
    },
  });
}

registerDesignTransitions();
