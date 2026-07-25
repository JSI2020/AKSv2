export type SafepayStandardResponse<T> = {
  api_version: string;
  data: T;
};

export type SafepayCreatePaymentData = {
  token: string;
  status:
    | "P_INITIATED"
    | "P_RECEIVED"
    | "P_AUTHORIZED"
    | "P_CAPTURED"
    | "P_SETTLED"
    | "P_FAILED"
    | "P_REJECTED"
    | "P_CANCELLED"
    | "P_REVERSED"
    | "P_PARTIALLY_REFUNDED"
    | "P_REFUNDED";
  request_id: string;
  order_id: string;
  trace_reference?: string;
  msg_id?: string;
  created_at: string;
  expires_at?: string;
};

export type SafepayPaymentRecord = {
  token: string;
  order_id: string;
  amount: string | number;
  status: SafepayCreatePaymentData["status"];
  request_id?: string;
};

export type SafepayWebhookBody = {
  api_version?: string;
  data?: {
    payment?: SafepayPaymentRecord;
    token?: string;
    order_id?: string;
    amount?: string | number;
    status?: SafepayCreatePaymentData["status"];
  };
};

export type SafepayCreateRefundData = {
  token: string;
  status: "R_INITIATED" | "R_COMPLETED" | "R_FAILED" | "R_CANCELED";
};

export type SafepayErrorResponse = {
  code?: string;
  message?: string;
};
