"use server";

import { revalidatePath } from "next/cache";

import { db, expenditures, insertAuditLog } from "@aks/db";
import { uuidv7 } from "@aks/shared";
import { eq } from "drizzle-orm";

import { requirePermission } from "@/modules/auth";

import type {
  ExpenditureCategory,
  ExpenditurePaymentMethod,
  ExpenditureRecurrence,
} from "./expenditures-math";

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const CATEGORIES: ExpenditureCategory[] = [
  "RENT",
  "SALARIES",
  "MARKETING",
  "UTILITIES",
  "SOFTWARE",
  "EQUIPMENT",
  "MATERIALS",
  "TAXES",
  "OTHER",
];

const METHODS: ExpenditurePaymentMethod[] = [
  "CASH",
  "BANK_TRANSFER",
  "CARD",
];

export async function saveExpenditureAction(input: {
  id?: string;
  date: string;
  category: string;
  payee: string;
  amountPkr: string;
  paymentMethod: string;
  isRecurring: boolean;
  recurrenceCycle?: string | null;
  note?: string;
}): Promise<ActionResult> {
  try {
    const session = await requirePermission("money.edit_costs");
    if (!CATEGORIES.includes(input.category as ExpenditureCategory)) {
      return { ok: false, error: "Invalid category" };
    }
    if (!METHODS.includes(input.paymentMethod as ExpenditurePaymentMethod)) {
      return { ok: false, error: "Invalid payment method" };
    }
    const payee = input.payee.trim();
    if (!payee) return { ok: false, error: "Payee is required" };

    const amountMinor = Math.round(Number(input.amountPkr) * 100);
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      return { ok: false, error: "Enter a valid amount" };
    }

    const date = new Date(input.date);
    if (Number.isNaN(date.getTime())) {
      return { ok: false, error: "Enter a valid date" };
    }

    let recurrenceCycle: ExpenditureRecurrence | null = null;
    if (input.isRecurring) {
      if (
        input.recurrenceCycle !== "MONTHLY" &&
        input.recurrenceCycle !== "YEARLY"
      ) {
        recurrenceCycle = "MONTHLY";
      } else {
        recurrenceCycle = input.recurrenceCycle;
      }
    }

    const id = input.id ?? uuidv7();
    if (input.id) {
      await db
        .update(expenditures)
        .set({
          date,
          category: input.category as ExpenditureCategory,
          payee,
          amountMinor,
          paymentMethod: input.paymentMethod as ExpenditurePaymentMethod,
          isRecurring: input.isRecurring,
          recurrenceCycle,
          note: input.note?.trim() || null,
        })
        .where(eq(expenditures.id, input.id));
    } else {
      await db.insert(expenditures).values({
        id,
        date,
        category: input.category as ExpenditureCategory,
        payee,
        amountMinor,
        paymentMethod: input.paymentMethod as ExpenditurePaymentMethod,
        isRecurring: input.isRecurring,
        recurrenceCycle,
        note: input.note?.trim() || null,
        actorId: session.user.id,
      });
    }

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: input.id ? "finance.expenditure.update" : "finance.expenditure.create",
      entityType: "expenditure",
      entityId: id,
      before: null,
      after: { payee, amountMinor, category: input.category },
    });

    revalidatePath("/admin/finance");
    revalidatePath("/admin/money");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
