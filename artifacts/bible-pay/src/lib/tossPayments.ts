const TOSS_SDK_URL = "https://js.tosspayments.com/v2/standard";
const TOSS_SDK_ID = "toss-payments-sdk";

type TossPayment = {
  requestPayment(params: {
    method: "CARD";
    amount: { currency: "KRW"; value: number };
    orderId: string;
    orderName: string;
    successUrl: string;
    failUrl: string;
    customerName?: string;
    customerEmail?: string;
    windowTarget?: "self" | "iframe";
    metadata?: Record<string, string>;
    card?: {
      useEscrow?: boolean;
      flowMode?: "DEFAULT" | "DIRECT";
      useCardPoint?: boolean;
      useAppCardOnly?: boolean;
    };
  }): Promise<void>;
};

type TossPaymentsFactory = ((clientKey: string) => {
  payment(params: { customerKey: string }): TossPayment;
}) & {
  ANONYMOUS: string;
};

declare global {
  interface Window {
    TossPayments?: TossPaymentsFactory;
  }
}

export interface TossTopupRequest {
  clientKey: string;
  customerKey: string;
  orderId: string;
  orderName: string;
  amount: number;
  successUrl: string;
  failUrl: string;
  customerName?: string;
  customerEmail?: string;
}

let sdkPromise: Promise<TossPaymentsFactory> | null = null;

function loadTossPayments(): Promise<TossPaymentsFactory> {
  if (window.TossPayments) return Promise.resolve(window.TossPayments);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(TOSS_SDK_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.TossPayments) resolve(window.TossPayments);
        else reject(new Error("Toss Payments SDK를 불러오지 못했어요."));
      });
      existing.addEventListener("error", () => reject(new Error("Toss Payments SDK를 불러오지 못했어요.")));
      return;
    }

    const script = document.createElement("script");
    script.id = TOSS_SDK_ID;
    script.src = TOSS_SDK_URL;
    script.async = true;
    script.onload = () => {
      if (window.TossPayments) resolve(window.TossPayments);
      else reject(new Error("Toss Payments SDK를 불러오지 못했어요."));
    };
    script.onerror = () => reject(new Error("Toss Payments SDK를 불러오지 못했어요."));
    document.head.appendChild(script);
  });

  return sdkPromise;
}

export async function requestTossTopupPayment(request: TossTopupRequest): Promise<void> {
  const TossPayments = await loadTossPayments();
  const tossPayments = TossPayments(request.clientKey);
  const payment = tossPayments.payment({ customerKey: request.customerKey });

  await payment.requestPayment({
    method: "CARD",
    amount: {
      currency: "KRW",
      value: request.amount,
    },
    orderId: request.orderId,
    orderName: request.orderName,
    successUrl: request.successUrl,
    failUrl: request.failUrl,
    customerName: request.customerName,
    customerEmail: request.customerEmail,
    windowTarget: "self",
    metadata: {
      kind: "budget_topup",
    },
    card: {
      useEscrow: false,
      flowMode: "DEFAULT",
      useCardPoint: false,
      useAppCardOnly: false,
    },
  });
}
