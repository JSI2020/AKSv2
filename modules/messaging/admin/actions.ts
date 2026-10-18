"use server";

import { revalidatePath } from "next/cache";

import { insertAuditLog, db, WHATSAPP_CONNECTION_ID } from "@aks/db";
import { uuidv7 } from "@aks/shared";
import {
  PermissionDeniedError,
  requirePermission,
  UnauthenticatedError,
} from "@/modules/auth";

import {
  completeWhatsappCoexistence,
  saveWhatsappConfigId,
} from "../whatsapp-coexistence";
import { isMetaId, parseEmbeddedSignupMessage } from "../whatsapp-coexistence-parse";

export type WhatsappActionResult = { ok: true } | { ok: false; error: string };

function denied(error: unknown): WhatsappActionResult | null {
  if (
    error instanceof UnauthenticatedError ||
    error instanceof PermissionDeniedError
  ) {
    return { ok: false, error: "You don’t have access to WhatsApp settings." };
  }
  return null;
}

export async function saveWhatsappConfigAction(
  configId: string,
): Promise<WhatsappActionResult> {
  try {
    const session = await requirePermission("settings.view");
    const trimmed = configId.trim();
    if (!isMetaId(trimmed)) {
      return { ok: false, error: "Paste the numeric configuration id from Meta." };
    }
    await saveWhatsappConfigId(trimmed);
    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "whatsapp.coexistence.config",
      entityType: "whatsapp_connection",
      entityId: WHATSAPP_CONNECTION_ID,
      after: { configId: trimmed },
    });
    revalidatePath("/admin/settings/whatsapp");
    return { ok: true };
  } catch (error) {
    return denied(error) ?? { ok: false, error: "Could not save the configuration id." };
  }
}

export async function completeWhatsappCoexistenceAction(input: {
  code: string;
  session: unknown;
}): Promise<WhatsappActionResult> {
  try {
    const session = await requirePermission("settings.view");
    const parsed = parseEmbeddedSignupMessage(input.session);
    if (!parsed || parsed.event !== "finish") {
      return { ok: false, error: "WhatsApp did not finish linking the number." };
    }
    const result = await completeWhatsappCoexistence({
      code: input.code,
      wabaId: parsed.wabaId,
      phoneNumberId: parsed.phoneNumberId,
      actorId: session.user.id,
      actorRole: session.user.role ?? "STAFF",
    });
    revalidatePath("/admin/settings/whatsapp");
    return result;
  } catch (error) {
    return (
      denied(error) ?? { ok: false, error: "Could not finish WhatsApp linking." }
    );
  }
}
