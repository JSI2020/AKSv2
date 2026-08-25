import { db, messageTemplates } from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { MESSAGE_TEMPLATE_SEEDS } from "./templates";

/** DB seed / bootstrap — no session. Prefer the gated server action from the admin UI. */
export async function seedMessageTemplatesIntoDb(): Promise<void> {
  for (const seed of MESSAGE_TEMPLATE_SEEDS) {
    await db
      .insert(messageTemplates)
      .values({
        id: uuidv7(),
        key: seed.key,
        channel: "EMAIL",
        locale: seed.locale,
        version: 1,
        subject: seed.subject,
        body: seed.body,
      })
      .onConflictDoNothing();
  }
}
