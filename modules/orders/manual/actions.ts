"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  db,
  insertAuditLog,
  orderPayments,
  type Database,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import {
  clientIpFromHeaders,
  PermissionDeniedError,
  requirePermission,
} from "@/modules/auth";
import { computeCartLineUnitPrice } from "@/modules/cart/compute-unit-price";
import {
  computeDepositAmounts,
  type PaymentPlan,
} from "@/modules/checkout/payment-plans";
import { toShippingSnapshot } from "@/modules/checkout/types";
import { buildStandardMeasurementSnapshot } from "@/modules/orders/compute-cut-spec-snapshot";
import { priceAdjustmentReasonLabel } from "@/modules/orders/reason-codes";
import { placeOrderCore } from "@/modules/orders/place-order-core";
import { transitionOrder } from "@/modules/orders/transition-order";
import { linkOrderCustomer } from "@/modules/customers/link-order-customer";

import {
  getCustomerById,
  getManualOrderDesignDetail,
  getManualOrderDesignOptions,
  searchCustomers,
} from "./queries";
import { validatePlaceManualOrderInput } from "./schemas";
import type {
  ManualOrderDesignDetail,
  ManualOrderDesignOption,
  PlaceManualOrderInput,
  PlaceManualOrderResult,
} from "./types";

function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/** One WhatsApp number, copied onto shipping when that field was left blank. */
async function withCopiedWhatsapp(
  input: PlaceManualOrderInput,
): Promise<PlaceManualOrderInput | { error: string }> {
  const fromAddress = digitsOnly(input.address.whatsappNumber);
  let whatsapp = fromAddress;
  if (input.customer.mode === "new") {
    whatsapp = fromAddress || digitsOnly(input.customer.whatsappNumber);
  } else {
    const customer = await getCustomerById(input.customer.userId);
    whatsapp =
      fromAddress ||
      digitsOnly(customer?.whatsappNumber) ||
      digitsOnly(customer?.phone);
  }

  if (whatsapp.length < 10 || whatsapp.length > 15) {
    return {
      error:
        "Enter a WhatsApp number on the customer. Shipping uses the same number.",
    };
  }

  return {
    ...input,
    address: { ...input.address, whatsappNumber: whatsapp },
    customer:
      input.customer.mode === "new"
        ? {
            ...input.customer,
            whatsappNumber:
              digitsOnly(input.customer.whatsappNumber) || whatsapp,
          }
        : input.customer,
  };
}

async function auditContext() {
  const h = await headers();
  return {
    ip: clientIpFromHeaders(h),
    userAgent: h.get("user-agent")?.slice(0, 512) ?? null,
  };
}

function actionError(error: unknown): { ok: false; error: string } {
  if (error instanceof PermissionDeniedError) {
    return { ok: false, error: "You do not have permission for this action." };
  }
  if (error instanceof Error) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: "Something went wrong." };
}

function buildManualMeasurementSnapshot(input: {
  sizeMode: "STANDARD" | "MADE_TO_MEASURE";
  sizeLabel: string | null;
  measurements: Record<string, number>;
}) {
  if (input.sizeMode === "STANDARD" && input.sizeLabel) {
    return null;
  }

  const sessionId = `manual:${uuidv7()}`;
  return {
    sessionId,
    values: input.measurements,
  };
}

export async function searchCustomersAction(
  query: string,
): Promise<
  | { ok: true; customers: Awaited<ReturnType<typeof searchCustomers>> }
  | { ok: false; error: string }
> {
  try {
    await requirePermission("orders.create");
    const customers = await searchCustomers(query);
    return { ok: true, customers };
  } catch (error) {
    return actionError(error);
  }
}

export async function loadManualOrderDesignOptionsAction(): Promise<
  | { ok: true; designs: ManualOrderDesignOption[] }
  | { ok: false; error: string }
> {
  try {
    await requirePermission("orders.create");
    const designs = await getManualOrderDesignOptions();
    return { ok: true, designs };
  } catch (error) {
    return actionError(error);
  }
}

export async function loadManualOrderDesignDetailAction(
  designId: string,
): Promise<
  | { ok: true; design: ManualOrderDesignDetail }
  | { ok: false; error: string }
> {
  try {
    await requirePermission("orders.create");
    const design = await getManualOrderDesignDetail(designId);
    if (!design) {
      return { ok: false, error: "Design not found or not published." };
    }
    return { ok: true, design };
  } catch (error) {
    return actionError(error);
  }
}

export async function placeManualOrderAction(
  input: PlaceManualOrderInput,
): Promise<PlaceManualOrderResult> {
  try {
    const session = await requirePermission("orders.create");

    let subtotalMinor = 0;
    const resolvedLines: Awaited<
      ReturnType<typeof buildManualOrderLine>
    >[] = [];

    for (const line of input.lines) {
      const resolved = await buildManualOrderLine(line);
      subtotalMinor += resolved.lineTotalMinor;
      resolvedLines.push(resolved);
    }

    const shippingMinor = 0;
    const taxMinor = 0;
    let totalMinor = subtotalMinor + shippingMinor + taxMinor;
    let discountMinor = 0;

    if (
      input.priceAdjustment &&
      input.priceAdjustment.newTotalMinor !== totalMinor
    ) {
      totalMinor = input.priceAdjustment.newTotalMinor;
      discountMinor = Math.max(0, subtotalMinor - totalMinor);
    }

    const { depositAmountMinor } = computeDepositAmounts({
      totalMinor,
      plan: input.paymentPlan,
    });

    const prepared = await withCopiedWhatsapp(input);
    if ("error" in prepared) return { ok: false, error: prepared.error };

    const validation = validatePlaceManualOrderInput(
      prepared,
      subtotalMinor,
      depositAmountMinor,
    );
    if (!validation.ok) return validation;

    const addressResult = prepared.address;
    const shippingSnapshot = toShippingSnapshot({
      ...addressResult,
      guestEmail: undefined,
      saveAddress: false,
    });

    const ctx = await auditContext();

    const existingCustomer =
      prepared.customer.mode === "existing"
        ? await getCustomerById(prepared.customer.userId)
        : null;
    if (prepared.customer.mode === "existing" && !existingCustomer) {
      return { ok: false, error: "Selected customer no longer exists." };
    }

    const newCustomerEmail =
      prepared.customer.mode === "new"
        ? prepared.customer.email?.trim().toLowerCase() ||
          `${digitsOnly(prepared.customer.phone)}@customers.aks.local`
        : null;

    const result = await db.transaction(async (tx) => {
      const userId = await linkOrderCustomer(tx, {
        existingUserId: existingCustomer?.id ?? null,
        email: existingCustomer?.email ?? newCustomerEmail,
        name:
          prepared.customer.mode === "new"
            ? prepared.customer.name
            : (existingCustomer?.name ?? addressResult.recipientName),
        phone:
          prepared.customer.mode === "new"
            ? prepared.customer.phone
            : (existingCustomer?.phone ?? addressResult.phone),
        whatsappNumber: addressResult.whatsappNumber,
        source: validation.source,
        address: shippingSnapshot,
      });
      if (!userId) {
        throw new Error("Could not save the customer.");
      }

      const guestEmail = existingCustomer?.email ?? newCustomerEmail;
      const guestPhone =
        prepared.customer.mode === "new"
          ? prepared.customer.phone
          : (existingCustomer?.phone ?? addressResult.phone);

      const whatsappNumber = addressResult.whatsappNumber;

      const priceReason = input.priceAdjustment
        ? [
            priceAdjustmentReasonLabel(input.priceAdjustment.reasonCode),
            input.priceAdjustment.note?.trim(),
          ]
            .filter(Boolean)
            .join(" — ")
        : null;

      const internalNotes = [
        input.internalNotes?.trim(),
        priceReason ? `Price adjustment: ${priceReason}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const placed = await placeOrderCore(
        {
          userId,
          guestEmail,
          guestPhone,
          whatsappNumber,
          shippingAddressSnapshot: shippingSnapshot,
          paymentPlan: input.paymentPlan as PaymentPlan,
          customerNotes: input.customerNotes,
          internalNotes: internalNotes || null,
          source: validation.source,
          subtotalMinor,
          discountMinor,
          shippingMinor,
          taxMinor,
          totalMinor,
          lines: resolvedLines,
          actor: { id: session.user.id, role: session.user.role },
          transitionNote: `Manual order (${validation.source})`,
        },
        tx,
      );

      if (input.deposit && input.deposit.amountMinor > 0) {
        const paymentKind =
          input.paymentPlan === "FULL_PREPAID" ? "FULL" : "DEPOSIT";

        await tx.insert(orderPayments).values({
          id: uuidv7(),
          orderId: placed.orderId,
          kind: paymentKind,
          amountMinor: input.deposit.amountMinor,
          provider: input.deposit.provider,
          status: "SUCCEEDED",
          note: input.deposit.note?.trim() || "Deposit recorded at order entry",
          recordedById: session.user.id,
        });

        await transitionOrder({
          orderId: placed.orderId,
          from: "AWAITING_DEPOSIT",
          to: "DEPOSIT_PAID",
          actor: { id: session.user.id, role: session.user.role },
          note: input.deposit.note?.trim() || "Deposit recorded at order entry",
          tx,
        });
      }

      await insertAuditLog(tx as unknown as Database, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "orders.create_manual",
        entityType: "order",
        entityId: placed.orderId,
        before: null,
        after: {
          orderNumber: placed.orderNumber,
          source: validation.source,
          totalMinor,
          depositRecorded: input.deposit?.amountMinor ?? 0,
        },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });

      return placed;
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${result.orderId}`);
    revalidatePath("/admin/customers");

    return {
      ok: true,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
    };
  } catch (error) {
    return actionError(error);
  }
}

async function buildManualOrderLine(line: PlaceManualOrderInput["lines"][number]) {
  const design = await getManualOrderDesignDetail(line.designId);
  if (!design) {
    throw new Error("A selected design is no longer available.");
  }

  const colourway = design.colourways.find((cw) => cw.id === line.colourwayId);
  if (!colourway) {
    throw new Error(`Colourway missing for ${design.name}.`);
  }

  const price = await computeCartLineUnitPrice({
    designId: line.designId,
    colourwayId: line.colourwayId,
    sizeMode: line.sizeMode,
    customizationSelections: line.customizationSelections,
  });

  if (!price) {
    throw new Error(`${design.name} is not available in that configuration.`);
  }

  let measurementSnapshot;
  if (line.sizeMode === "STANDARD" && line.sizeLabel) {
    measurementSnapshot = await buildStandardMeasurementSnapshot({
      designId: line.designId,
      sizeLabel: line.sizeLabel,
    });
  } else {
    measurementSnapshot = buildManualMeasurementSnapshot(line);
    if (!measurementSnapshot) {
      throw new Error(`Measurements required for ${design.name}.`);
    }
  }

  const lineTotalMinor = price.unitPriceMinor * line.quantity;

  return {
    designId: line.designId,
    colourwayId: line.colourwayId,
    designSlug: design.slug,
    designName: design.name,
    sizeMode: line.sizeMode,
    sizeLabel: line.sizeLabel,
    measurementSnapshot,
    customizationSelections: line.customizationSelections,
    quantity: line.quantity,
    unitPriceMinor: price.unitPriceMinor,
    lineTotalMinor,
    priceBreakdown: price,
  };
}
