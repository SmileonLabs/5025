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
  return process.env["TOSS_CLIENT_KEY"] ?? DEFAULT_TOSS_CLIENT_KEY;
}

export async function confirmTossPayment(params: {
  paymentKey: string;
  orderId: string;
  amount: number;
}) {
  const secretKey = process.env["TOSS_SECRET_KEY"] ?? DEFAULT_TOSS_SECRET_KEY;
  const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
      "Idempotency-Key": params.orderId,
    },
    body: JSON.stringify(params),
  });

  const data = (await res.json()) as {
    paymentKey?: string;
    orderId?: string;
    status?: string;
    totalAmount?: number;
    code?: string;
    message?: string;
  };

  if (!res.ok) {
    throw new PaymentProviderError(res.status, data.message ?? "Toss Payments confirmation failed.", data.code);
  }

  return data;
}
