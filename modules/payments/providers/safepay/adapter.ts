import {
  PaymentProviderError,
  WebhookVerificationError,
  type CheckoutSession,
  type CreateCheckoutInput,
  type PaymentProvider,
  type ProviderPaymentStatus,
  type RefundInput,
  type RefundResult,
  type WebhookEvent,
  type WebhookVerificationContext,
} from "../../types";
import type { SafepayConfig } from "../../config";
import { verifySafepaySignature } from "./verify-signature";
import type {
  SafepayCreatePaymentData,
  SafepayCreateRefundData,
  SafepayErrorResponse,
  SafepayPaymentRecord,
  SafepayStandardResponse,
  SafepayWebhookBody,
} from "./types";

function mapSafepayStatus(
  status: SafepayCreatePaymentData["status"] | string | undefined,
): ProviderPaymentStatus {
  switch (status) {
    case "P_SETTLED":
    case "P_CAPTURED":
      return "SUCCEEDED";
    case "P_REFUNDED":
    case "P_PARTIALLY_REFUNDED":
      return "REFUNDED";
    case "P_FAILED":
    case "P_REJECTED":
    case "P_CANCELLED":
    case "P_REVERSED":
      return "FAILED";
    case "P_INITIATED":
    case "P_RECEIVED":
    case "P_AUTHORIZED":
    default:
      return "PENDING";
  }
}

function parseAmountMinor(value: string | number | undefined): number {
  if (value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new PaymentProviderError("Safepay amount is not a valid integer.");
  }
  return parsed;
}

function extractPaymentRecord(body: SafepayWebhookBody): SafepayPaymentRecord {
  const payment = body.data?.payment;
  if (payment?.token && payment.order_id) {
    return payment;
  }

  const token = payment?.token ?? body.data?.token;
  const orderId = payment?.order_id ?? body.data?.order_id;
  const amount = payment?.amount ?? body.data?.amount;
  const status = payment?.status ?? body.data?.status;

  if (!token || !orderId) {
    throw new PaymentProviderError("Safepay webhook payload missing payment.");
  }

  return {
    token,
    order_id: orderId,
    amount: amount ?? 0,
    status: status ?? "P_INITIATED",
    request_id: payment?.request_id,
  };
}

async function safepayRequest<T>(
  config: SafepayConfig,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-SFPY-AGGREGATOR-SECRET-KEY": config.secretKey,
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await res.json()) as T | SafepayErrorResponse;
  if (!res.ok) {
    const err = payload as SafepayErrorResponse;
    throw new PaymentProviderError(
      err.message ?? `Safepay request failed (${res.status}).`,
      err.code,
    );
  }

  return payload as T;
}

export function createSafepayProvider(
  config: SafepayConfig,
): PaymentProvider {
  return {
    name: "SAFEPAY",

    async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
      if (input.amountMinor <= 0) {
        throw new PaymentProviderError("Amount must be greater than zero.");
      }
      if (!input.debitorRaastId) {
        throw new PaymentProviderError(
          "debitorRaastId (customer phone) is required for Safepay RTP checkout.",
        );
      }

      const payload = await safepayRequest<
        SafepayStandardResponse<SafepayCreatePaymentData>
      >(
        config,
        `/v1/aggregators/${config.aggregatorId}/payments`,
        {
          method: "POST",
          body: JSON.stringify({
            request_id: input.idempotencyKey,
            amount: input.amountMinor,
            aggregator_merchant_identifier:
              config.aggregatorMerchantIdentifier,
            order_id: input.orderReference,
            type: "RTP_NOW",
            expiry_in_minutes: 30,
            debitor_raast_id: input.debitorRaastId,
          }),
        },
      );

      return {
        providerRef: payload.data.token,
        checkoutUrl: null,
        status: mapSafepayStatus(payload.data.status),
        expiresAt: payload.data.expires_at
          ? new Date(payload.data.expires_at)
          : null,
        raw: payload,
      };
    },

    verifyWebhook(
      raw: string,
      sig: string,
      context?: WebhookVerificationContext,
    ): WebhookEvent {
      if (!context?.timestamp || !context.eventId) {
        throw new WebhookVerificationError(
          "Safepay webhooks require timestamp and event ID headers.",
        );
      }

      verifySafepaySignature({
        secretBase64: config.webhookSecret,
        rawBody: raw,
        signature: sig,
        timestamp: context.timestamp,
      });

      let body: SafepayWebhookBody;
      try {
        body = JSON.parse(raw) as SafepayWebhookBody;
      } catch {
        throw new PaymentProviderError("Safepay webhook body is not valid JSON.");
      }

      const payment = extractPaymentRecord(body);
      const eventType = context.eventType ?? "payment.completed";
      const amountMinor = parseAmountMinor(payment.amount);
      const status = mapSafepayStatus(payment.status);

      const successEvents = new Set(["payment.completed", "payment.settled"]);
      const resolvedStatus = successEvents.has(eventType)
        ? "SUCCEEDED"
        : status;

      return {
        idempotencyKey: context.eventId,
        eventType,
        providerRef: payment.token,
        orderReference: payment.order_id,
        amountMinor,
        status: resolvedStatus,
        raw: body,
      };
    },

    async refund(input: RefundInput): Promise<RefundResult> {
      const payload = await safepayRequest<
        SafepayStandardResponse<SafepayCreateRefundData>
      >(config, `/v1/aggregators/${config.aggregatorId}/refunds`, {
        method: "POST",
        body: JSON.stringify({
          request_id: input.idempotencyKey,
          payment_id: input.paymentProviderRef,
          amount: input.amountMinor,
          reason: input.reason,
          debitor_iban: input.debitorIban,
          addtl_info: input.additionalInfo,
        }),
      });

      return {
        providerRef: payload.data.token,
        status: payload.data.status,
        raw: payload,
      };
    },

    async getStatus(providerRef: string): Promise<ProviderPaymentStatus> {
      const payload = await safepayRequest<
        SafepayStandardResponse<SafepayPaymentRecord>
      >(
        config,
        `/v1/aggregators/${config.aggregatorId}/payments/${providerRef}`,
        { method: "GET" },
      );

      return mapSafepayStatus(payload.data.status);
    },
  };
}

export function getSafepayProvider(config: SafepayConfig): PaymentProvider {
  return createSafepayProvider(config);
}
