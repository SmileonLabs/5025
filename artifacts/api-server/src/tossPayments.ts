const DEFAULT_TOSS_CLIENT_KEY = "test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq";
const DEFAULT_TOSS_SECRET_KEY = "test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R";

export class PaymentProviderError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export function getTossClientKey(): string {
  const configured = process.env["TOSS_CLIENT_KEY"];
  if (configured) return configured;
  if (process.env["NODE_ENV"] === "production") throw new Error("TOSS_CLIENT_KEY is required in production.");
  return DEFAULT_TOSS_CLIENT_KEY;
}

function getTossSecretKey(): string {
  const configured = process.env["TOSS_SECRET_KEY"];
  if (configured) return configured;
  if (process.env["NODE_ENV"] === "production") throw new Error("TOSS_SECRET_KEY is required in production.");
  return DEFAULT_TOSS_SECRET_KEY;
}

function authorizationHeader(): string {
  return `Basic ${Buffer.from(`${getTossSecretKey()}:`).toString("base64")}`;
}

export type TossPayment = {
  paymentKey?: string;
  orderId?: string;
  status?: string;
  totalAmount?: number;
  code?: string;
  message?: string;
};

export async function confirmTossPayment(params: {
  paymentKey: string;
  orderId: string;
  amount: number;
}) {
  const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: authorizationHeader(),
      "Content-Type": "application/json",
      "Idempotency-Key": params.orderId,
    },
    body: JSON.stringify(params),
  });

  const data = (await res.json()) as TossPayment;

  if (!res.ok) {
    throw new PaymentProviderError(res.status, data.message ?? "Toss Payments confirmation failed.", data.code);
  }

  return data;
}

/** Re-query Toss before trusting an asynchronous webhook payload. */
export async function getTossPayment(paymentKey: string): Promise<TossPayment> {
  const res = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}`, {
    headers: { Authorization: authorizationHeader() },
  });
  const data = (await res.json()) as TossPayment;
  if (!res.ok) {
    throw new PaymentProviderError(res.status, data.message ?? "Toss Payments lookup failed.", data.code);
  }
  return data;
}
