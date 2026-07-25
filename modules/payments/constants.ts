/** System actor for automated payment webhooks — no human user. */
export const PAYMENT_WEBHOOK_ACTOR_ID =
  "01900001-2345-7890-abcd-ef123456789d";

export const SAFEPAY_SUCCESS_EVENTS = [
  "payment.completed",
  "payment.settled",
] as const;

export const SAFEPAY_TERMINAL_FAILURE_EVENTS = [
  "payment.failed",
  "payment.rejected",
  "payment.reversed",
  "payment.voided",
] as const;
