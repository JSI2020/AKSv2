export type PaymentProviderName =
  | "SAFEPAY"
  | "JAZZCASH"
  | "EASYPAISA"
  | "BANK_TRANSFER"
  | "COD"
  | "CASH";

export type PaymentKind = "DEPOSIT" | "BALANCE" | "FULL" | "REFUND";

export type ProviderPaymentStatus =
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "REFUNDED"
  | "AWAITING_VERIFICATION";

export type CreateCheckoutInput = {
  orderId: string;
  /** Merchant reference sent to the provider — typically the order number. */
  orderReference: string;
  amountMinor: number;
  kind: PaymentKind;
  currency?: "PKR";
  /** Raast alias (phone) for Safepay RTP flows. */
  debitorRaastId?: string;
  successUrl?: string;
  cancelUrl?: string;
  idempotencyKey: string;
};

export type CheckoutSession = {
  providerRef: string;
  checkoutUrl: string | null;
  status: ProviderPaymentStatus;
  expiresAt: Date | null;
  raw: unknown;
};

export type WebhookVerificationContext = {
  timestamp: string;
  eventId: string;
  eventType?: string;
};

export type WebhookEvent = {
  idempotencyKey: string;
  eventType: string;
  providerRef: string;
  orderReference: string;
  amountMinor: number;
  status: ProviderPaymentStatus;
  raw: unknown;
};

export type RefundInput = {
  paymentProviderRef: string;
  amountMinor: number;
  reason: "TechnicalProblem" | "DuplicatePayment" | string;
  debitorIban: string;
  idempotencyKey: string;
  additionalInfo?: string;
};

export type RefundResult = {
  providerRef: string;
  status: string;
  raw: unknown;
};

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  verifyWebhook(
    raw: string,
    sig: string,
    context?: WebhookVerificationContext,
  ): WebhookEvent;
  refund(input: RefundInput): Promise<RefundResult>;
  getStatus(providerRef: string): Promise<ProviderPaymentStatus>;
}

export class PaymentProviderError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }
}

export class WebhookVerificationError extends Error {
  constructor(message = "Invalid webhook signature.") {
    super(message);
    this.name = "WebhookVerificationError";
  }
}
