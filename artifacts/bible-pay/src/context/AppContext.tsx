import React, { createContext, useState, useContext, useCallback, useEffect, useRef, ReactNode } from "react";
import { api } from "@/lib/api";
import { requestTossTopupPayment, type TossTopupRequest } from "@/lib/tossPayments";
import { toast } from "@/hooks/use-toast";

export type Role = "parent" | "child" | null;

export interface ParentData {
  id: number;
  name: string;
  email: string;
  balance: number;
}

export interface ChildData {
  id: number;
  name: string;
  age: number;
  balance: number;
  avatar: string;
  parentId: number;
  grade: number | null;
  readingLevel: "easy" | "normal" | "advanced";
  aiAnswerLength: "short" | "normal" | "long";
  explainDifficultWords: boolean;
  dailyReadingRetryLimit: number;
}

export type TransactionType = "mission" | "charge" | "spend" | "gifticon" | "refund";

export interface Transaction {
  id: number;
  childId: number;
  createdAt: string;
  amount: number;
  description: string;
  type: TransactionType;
  category?: string | null;
}

export interface ChildRequest {
  id: number;
  childId: number;
  type: "allowance" | "mission" | "message";
  message: string;
  status: "pending" | "resolved" | "dismissed";
  createdAt: string;
  childName: string;
  childAvatar: string;
}

type TopupConfirmRequest = {
  paymentKey: string;
  orderId: string;
  amount: number;
};

type TopupConfirmResult = {
  credited: boolean;
  paidAmount: number;
  creditedPoints: number;
  balance: number;
  status?: string;
};

type TopupPrepareResponse = TossTopupRequest & {
  provider: "toss";
};

export type MissionType = "bible" | "activity" | "book";
export type MissionScheduleType = "daily" | "weekly" | "once";

export interface Mission {
  id: number;
  parentId: number;
  title: string;
  description: string;
  type: MissionType;
  reward: number;
  bookId: number | null;
  minRewardPoints: number;
  maxRewardPoints: number;
  // activity 전용 메타 (bible은 무시)
  scheduleType: MissionScheduleType;
  scheduledDate: string | null;
  weeklyDays: number[];
  timeLimit: string | null;
  requiresPhoto: boolean;
  // activity 전용: 아이별 최대 수행 횟수(승인+대기 누적). null이면 무제한.
  maxCompletions: number | null;
  // 대상 아이: assignToAll=true면 부모의 모든 아이. false면 assignedChildIds에 명시된 아이만.
  assignToAll: boolean;
  assignedChildIds: number[];
  isActive: boolean;
  createdAt: string;
}

// createMission 입력 (서버 zod 형태와 일치)
export interface MissionInput {
  title: string;
  description: string;
  type: MissionType;
  reward: number;
  scheduleType: MissionScheduleType;
  scheduledDate?: string | null;
  weeklyDays?: number[];
  timeLimit?: string | null;
  requiresPhoto: boolean;
  // activity 전용: 아이별 최대 수행 횟수. null/생략 시 무제한.
  maxCompletions?: number | null;
  // assignToAll=false면 childIds에 대상 아이를 명시 (생략 시 전체 대상)
  assignToAll?: boolean;
  childIds?: number[];
}

export interface PendingLog {
  id: number;
  missionId: number;
  childId: number;
  status: "requested";
  requestedAt: string;
  photoUrl: string | null;
  reflection: string | null;
  mission: { id: number; title: string; reward: number; type: string };
  child: { id: number; name: string; avatar: string };
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export type MissionLogStatus = "completed" | "requested" | "approved" | "rejected";

// 미션 수행 내역 1건 (GET /mission-logs). child는 부모 세션 응답에만 동봉.
export interface MissionLog {
  id: number;
  missionId: number;
  childId: number;
  status: MissionLogStatus;
  bibleBook: string | null;
  bibleChapter: number | null;
  reflection: string | null;
  quiz: QuizQuestion[] | null;
  photoUrl: string | null;
  transactionId: number | null;
  requestedAt: string;
  approvedAt: string | null;
  createdAt: string;
  // 지급 완료면 실제 지급액, 아니면 미션 예정 보상
  rewardAmount: number;
  mission: { id: number; title: string; type: MissionType; reward: number; scheduleType: MissionScheduleType };
  child?: { id: number; name: string; avatar: string };
}

export interface GifticonCatalogItem {
  id: number;
  parentId: number;
  brand: string;
  productName: string;
  price: number;
  isVariablePrice: boolean;
  emoji: string;
  createdAt: string;
}

export type GifticonStatus = "requested" | "fulfilled" | "rejected" | "canceled" | "used";

export interface GifticonOrder {
  id: number;
  childId: number;
  parentId: number;
  catalogItemId: string;
  brand: string;
  productName: string;
  faceValue: number;
  price: number;
  emoji: string;
  status: GifticonStatus;
  rejectReason: string | null;
  fulfilledAt: string | null;
  usedAt: string | null;
  createdAt: string;
  // Present only on the parent-scoped list (joined from the child row).
  childName?: string;
  childAvatar?: string;
}

export interface GifticonOrderDetail extends GifticonOrder {
  issuedPin: string | null;
  issuedBarcode: string | null;
  issuedImageUrl: string | null;
  transactionId: number | null;
  refundTransactionId: number | null;
}

interface AppState {
  role: Role;
  loading: boolean;
  parent: ParentData | null;
  currentChild: ChildData | null;
  children: ChildData[];
  transactions: Transaction[];
  parentTransactions: Transaction[];
  missions: Mission[];
  pendingLogs: PendingLog[];
  missionLogs: MissionLog[];
  childRequests: ChildRequest[];
  // Auth
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  childLogin: (childId: number, pin: string) => Promise<void>;
  // Parent top-up (Toss Payments)
  startTopupCheckout: (amount: number) => Promise<void>;
  confirmTopup: (params: TopupConfirmRequest) => Promise<TopupConfirmResult>;
  // Child management
  createChild: (name: string, age: number, avatar: string, pin: string) => Promise<void>;
  deleteChild: (childId: number) => Promise<void>;
  refreshChildren: () => Promise<void>;
  // Mission management (parent)
  createMission: (data: MissionInput) => Promise<void>;
  updateMission: (id: number, data: Partial<Pick<Mission, "title" | "description" | "type" | "reward" | "isActive" | "scheduleType" | "scheduledDate" | "weeklyDays" | "timeLimit" | "requiresPhoto" | "maxCompletions" | "assignToAll">> & { childIds?: number[] }) => Promise<void>;
  deleteMission: (id: number) => Promise<void>;
  refreshMissions: () => Promise<void>;
  // Mission actions (child)
  submitMission: (missionId: number, opts?: { bibleBook?: string; bibleChapter?: number; reflection?: string; photoUrl?: string; quiz?: QuizQuestion[] }) => Promise<{ childBalance: number }>;
  // Pending approvals (parent)
  refreshPendingLogs: () => Promise<void>;
  // Mission completion history (both roles)
  refreshMissionLogs: () => Promise<void>;
  approveMissionLog: (logId: number) => Promise<void>;
  rejectMissionLog: (logId: number) => Promise<void>;
  // Transactions
  chargeAllowance: (childId: number, amount: number) => Promise<void>;
  spendAllowance: (childId: number, amount: number, purpose: string, category?: string) => Promise<boolean>;
  refreshParentTransactions: () => Promise<void>;
  // Requests (child -> parent)
  createRequest: (type: ChildRequest["type"], message: string) => Promise<void>;
  refreshRequests: () => Promise<void>;
  resolveRequest: (id: number, status: "resolved" | "dismissed") => Promise<void>;
  // Gifticon shop (child)
  gifticonCatalog: GifticonCatalogItem[];
  gifticonOrders: GifticonOrder[];
  refreshGifticonCatalog: () => Promise<void>;
  refreshGifticonOrders: () => Promise<void>;
  buyGifticon: (catalogItemId: string, amount?: number) => Promise<void>;
  cancelGifticonOrder: (orderId: number) => Promise<void>;
  getGifticonOrderDetail: (orderId: number) => Promise<GifticonOrderDetail>;
  markGifticonUsed: (orderId: number) => Promise<void>;
  // Gifticon catalog management (parent)
  createGifticonCatalogItem: (data: { brand: string; productName: string; price: number; isVariablePrice?: boolean; emoji?: string }) => Promise<void>;
  deleteGifticonCatalogItem: (id: number) => Promise<void>;
  // Gifticon fulfillment / rejection (parent)
  fulfillGifticonOrderByParent: (orderId: number, issued?: { issuedPin?: string; issuedBarcode?: string; issuedImageUrl?: string }) => Promise<void>;
  rejectGifticonOrderByParent: (orderId: number, reason?: string) => Promise<void>;
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children: reactChildren }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  const [parent, setParent] = useState<ParentData | null>(null);
  const [currentChild, setCurrentChild] = useState<ChildData | null>(null);
  const [children, setChildren] = useState<ChildData[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [parentTransactions, setParentTransactions] = useState<Transaction[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [pendingLogs, setPendingLogs] = useState<PendingLog[]>([]);
  const [missionLogs, setMissionLogs] = useState<MissionLog[]>([]);
  const [childRequests, setChildRequests] = useState<ChildRequest[]>([]);
  const [gifticonCatalog, setGifticonCatalog] = useState<GifticonCatalogItem[]>([]);
  const [gifticonOrders, setGifticonOrders] = useState<GifticonOrder[]>([]);

  const refreshChildren = useCallback(async () => {
    try {
      const data = await api.get<ChildData[]>("/children");
      setChildren(data);
    } catch {}
  }, []);

  const refreshMissions = useCallback(async () => {
    try {
      const data = await api.get<Mission[]>("/missions");
      setMissions(data);
    } catch {}
  }, []);

  const refreshPendingLogs = useCallback(async () => {
    try {
      const data = await api.get<PendingLog[]>("/missions/pending");
      setPendingLogs(data);
    } catch {}
  }, []);

  const refreshMissionLogs = useCallback(async () => {
    try {
      const data = await api.get<MissionLog[]>("/mission-logs");
      setMissionLogs(data);
    } catch {}
  }, []);

  const refreshParentTransactions = useCallback(async () => {
    try {
      const data = await api.get<Transaction[]>("/transactions/all");
      setParentTransactions(data);
    } catch {}
  }, []);

  const refreshRequests = useCallback(async () => {
    try {
      const data = await api.get<ChildRequest[]>("/requests");
      setChildRequests(data);
    } catch {}
  }, []);

  const refreshGifticonCatalog = useCallback(async () => {
    try {
      const data = await api.get<GifticonCatalogItem[]>("/gifticons/catalog");
      setGifticonCatalog(data);
    } catch {}
  }, []);

  const refreshGifticonOrders = useCallback(async () => {
    try {
      const data = await api.get<GifticonOrder[]>("/gifticons/orders");
      setGifticonOrders(data);
    } catch {}
  }, []);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const me = await api.get<{ role: "parent" | "child" } & ParentData & ChildData>("/auth/me");
        if (me.role === "parent") {
          setRole("parent");
          setParent({ id: me.id, name: me.name, email: me.email, balance: me.balance });
          const [kids, missionList, pending, parentTxs, requests, gOrders, logs] = await Promise.all([
            api.get<ChildData[]>("/children"),
            api.get<Mission[]>("/missions"),
            api.get<PendingLog[]>("/missions/pending"),
            api.get<Transaction[]>("/transactions/all"),
            api.get<ChildRequest[]>("/requests"),
            api.get<GifticonOrder[]>("/gifticons/orders"),
            api.get<MissionLog[]>("/mission-logs"),
          ]);
          setChildren(kids);
          setMissions(missionList);
          setPendingLogs(pending);
          setParentTransactions(parentTxs);
          setChildRequests(requests);
          setGifticonOrders(gOrders);
          setMissionLogs(logs);
        } else if (me.role === "child") {
          setRole("child");
          setCurrentChild(me);
          const [txs, missionList, catalog, orders, logs] = await Promise.all([
            api.get<Transaction[]>("/transactions"),
            api.get<Mission[]>("/missions"),
            api.get<GifticonCatalogItem[]>("/gifticons/catalog"),
            api.get<GifticonOrder[]>("/gifticons/orders"),
            api.get<MissionLog[]>("/mission-logs"),
          ]);
          setTransactions(txs);
          setMissions(missionList);
          setGifticonCatalog(catalog);
          setGifticonOrders(orders);
          setMissionLogs(logs);
        }
      } catch {
        // not logged in
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Keep dashboards and mission lists fresh without requiring a manual reload.
  // Refresh on a short interval and immediately whenever the app regains focus.
  useEffect(() => {
    if (loading || !role) return;
    let refreshing = false;
    const refreshLiveData = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        if (role === "parent") {
          const me = await api.get<{ role: "parent" } & ParentData>("/auth/me").catch(() => null);
          if (me) setParent({ id: me.id, name: me.name, email: me.email, balance: me.balance });
          await Promise.all([
            refreshChildren(), refreshMissions(), refreshPendingLogs(), refreshParentTransactions(),
            refreshRequests(), refreshGifticonOrders(), refreshMissionLogs(),
          ]);
        } else {
          const [me, txs] = await Promise.all([
            api.get<{ role: "child" } & ChildData>("/auth/me").catch(() => null),
            api.get<Transaction[]>("/transactions").catch(() => null),
          ]);
          if (me) setCurrentChild(me);
          if (txs) setTransactions(txs);
          await Promise.all([refreshMissions(), refreshGifticonCatalog(), refreshGifticonOrders(), refreshMissionLogs()]);
        }
      } finally {
        refreshing = false;
      }
    };
    const onVisible = () => { if (document.visibilityState === "visible") void refreshLiveData(); };
    const onFocus = () => { void refreshLiveData(); };
    const interval = window.setInterval(() => void refreshLiveData(), 15_000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loading, role, refreshChildren, refreshGifticonCatalog, refreshGifticonOrders, refreshMissionLogs, refreshMissions, refreshParentTransactions, refreshPendingLogs, refreshRequests]);

  const login = async (email: string, password: string) => {
    const data = await api.post<ParentData>("/auth/login", { email, password });
    setParent(data);
    setRole("parent");
    setCurrentChild(null);
    const [kids, missionList, pending, parentTxs, requests, gOrders, logs] = await Promise.all([
      api.get<ChildData[]>("/children"),
      api.get<Mission[]>("/missions"),
      api.get<PendingLog[]>("/missions/pending"),
      api.get<Transaction[]>("/transactions/all"),
      api.get<ChildRequest[]>("/requests"),
      api.get<GifticonOrder[]>("/gifticons/orders"),
      api.get<MissionLog[]>("/mission-logs"),
    ]);
    setChildren(kids);
    setMissions(missionList);
    setPendingLogs(pending);
    setParentTransactions(parentTxs);
    setChildRequests(requests);
    setGifticonOrders(gOrders);
    setMissionLogs(logs);
  };

  const signup = async (name: string, email: string, password: string) => {
    const data = await api.post<ParentData>("/auth/signup", { name, email, password });
    setParent(data);
    setRole("parent");
    setCurrentChild(null);
    setChildren([]);
    setMissions([]);
    setPendingLogs([]);
    setMissionLogs([]);
    setParentTransactions([]);
    setChildRequests([]);
  };

  const logout = async () => {
    await api.post("/auth/logout", {});
    setRole(null);
    setParent(null);
    setCurrentChild(null);
    setChildren([]);
    setTransactions([]);
    setParentTransactions([]);
    setMissions([]);
    setPendingLogs([]);
    setMissionLogs([]);
    setChildRequests([]);
    setGifticonCatalog([]);
    setGifticonOrders([]);
  };

  const childLogin = async (childId: number, pin: string) => {
    const data = await api.post<ChildData>("/auth/child-login", { childId, pin });
    setCurrentChild(data);
    setRole("child");
    setParent(null);
    setChildren([]);
    const [txs, missionList, catalog, orders, logs] = await Promise.all([
      api.get<Transaction[]>("/transactions"),
      api.get<Mission[]>("/missions"),
      api.get<GifticonCatalogItem[]>("/gifticons/catalog"),
      api.get<GifticonOrder[]>("/gifticons/orders"),
      api.get<MissionLog[]>("/mission-logs"),
    ]);
    setTransactions(txs);
    setMissions(missionList);
    setGifticonCatalog(catalog);
    setGifticonOrders(orders);
    setMissionLogs(logs);
  };

  const createChild = async (name: string, age: number, avatar: string, pin: string) => {
    const child = await api.post<ChildData>("/children", { name, age, avatar, pin });
    setChildren(prev => [...prev, child]);
  };

  const deleteChild = async (childId: number) => {
    await api.delete(`/children/${childId}`);
    setChildren(prev => prev.filter(c => c.id !== childId));
  };

  const createMission = async (data: MissionInput) => {
    const mission = await api.post<Mission>("/missions", { ...data, isActive: true });
    setMissions(prev => [mission, ...prev]);
  };

  const updateMission = async (id: number, data: Partial<Pick<Mission, "title" | "description" | "type" | "reward" | "isActive" | "scheduleType" | "scheduledDate" | "weeklyDays" | "timeLimit" | "requiresPhoto" | "maxCompletions" | "assignToAll">> & { childIds?: number[] }) => {
    const updated = await api.patch<Mission>(`/missions/${id}`, data);
    setMissions(prev => prev.map(m => m.id === id ? updated : m));
  };

  const deleteMission = async (id: number) => {
    await api.delete(`/missions/${id}`);
    setMissions(prev => prev.filter(m => m.id !== id));
  };

  const submitMission = async (missionId: number, opts?: { bibleBook?: string; bibleChapter?: number; reflection?: string; photoUrl?: string; quiz?: QuizQuestion[] }): Promise<{ childBalance: number }> => {
    const result = await api.post<{ childBalance: number; log: unknown; tx?: unknown; pending?: boolean }>(
      `/missions/${missionId}/submit`,
      { bibleBook: opts?.bibleBook, bibleChapter: opts?.bibleChapter, reflection: opts?.reflection, photoUrl: opts?.photoUrl, quiz: opts?.quiz }
    );
    if (!result.pending && result.childBalance !== undefined) {
      setCurrentChild(prev => prev ? { ...prev, balance: result.childBalance } : prev);
      const txs = await api.get<Transaction[]>("/transactions");
      setTransactions(txs);
    }
    // 수행 내역 갱신 (즉시 완료·승인 대기 모두 반영)
    await refreshMissionLogs();
    return { childBalance: result.childBalance };
  };

  const approveMissionLog = async (logId: number) => {
    const result = await api.post<{ childBalance: number; parentBalance: number }>(`/mission-logs/${logId}/approve`, {});
    setPendingLogs(prev => prev.filter(l => l.id !== logId));
    // 닫힌 용돈 구조: 승인 시 부모 잔액이 차감되므로 부모 상태도 갱신한다.
    if (typeof result.parentBalance === "number") {
      setParent(prev => prev ? { ...prev, balance: result.parentBalance } : prev);
    }
    // Refresh children to show updated balance
    await refreshChildren();
    await refreshMissionLogs();
  };

  const rejectMissionLog = async (logId: number) => {
    await api.post(`/mission-logs/${logId}/reject`, {});
    setPendingLogs(prev => prev.filter(l => l.id !== logId));
    await refreshMissionLogs();
  };

  const chargeAllowance = async (childId: number, amount: number) => {
    const result = await api.post<{ childBalance: number; id: number; createdAt: string }>("/transactions", {
      childId, amount, description: "용돈 채우기", type: "charge",
    });
    setChildren(prev => prev.map(c => c.id === childId ? { ...c, balance: result.childBalance } : c));
    if (parent) {
      setParent(prev => prev ? { ...prev, balance: prev.balance - amount } : prev);
    }
  };

  const startTopupCheckout = useCallback(async (amount: number) => {
    const topup = await api.post<TopupPrepareResponse>("/topups/prepare", { amount });
    await requestTossTopupPayment(topup);
  }, []);

  const confirmTopup = useCallback(async (params: TopupConfirmRequest) => {
    const result = await api.post<TopupConfirmResult>(
      "/topups/confirm",
      params,
    );
    setParent(prev => (prev ? { ...prev, balance: result.balance } : prev));
    return result;
  }, []);

  // Capture the Toss return params on first render, BEFORE the router can
  // redirect "/" to the dashboard and strip the query string. (LoginPage, a
  // descendant, runs its redirect effect before this provider's effect.)
  const [topupReturn] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      topup: params.get("topup"),
      paymentKey: params.get("paymentKey"),
      orderId: params.get("orderId"),
      amount: params.get("amount"),
      errorCode: params.get("code"),
      errorMessage: params.get("message"),
    };
  });

  // Handle the return from Toss Payments. The redirect lands on "/" with
  // ?topup=success&paymentKey=...&orderId=...&amount=..., so confirm here once the
  // parent session is restored, then clean the URL.
  const topupHandledRef = useRef(false);

  // Cross-tab budget sync keeps the embedded web app fresh if a payment return
  // completes in another browser context.
  const topupChannelRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("bible-pay-topup");
    topupChannelRef.current = channel;
    channel.onmessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; balance?: number; creditedPoints?: number };
      if (data?.type === "topup-success" && typeof data.balance === "number") {
        const newBalance = data.balance;
        setParent(prev => (prev ? { ...prev, balance: newBalance } : prev));
        toast({ title: `충전 완료! +${Number(data.creditedPoints ?? 0).toLocaleString("ko-KR")}P` });
      }
    };
    return () => {
      channel.close();
      topupChannelRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (loading || topupHandledRef.current) return;

    const { topup, paymentKey, orderId, amount, errorCode, errorMessage } = topupReturn;
    if (!topup) return;

    const cleanUrl = () => window.history.replaceState({}, "", window.location.pathname);

    if (topup === "cancel" || topup === "fail") {
      topupHandledRef.current = true;
      cleanUrl();
      const canceled = errorCode === "PAY_PROCESS_CANCELED";
      toast({
        title: canceled ? "결제를 취소했어요." : errorMessage ?? "결제가 완료되지 않았어요.",
        variant: canceled ? undefined : "destructive",
      });
      return;
    }

    if (topup === "success") {
      const paidAmount = Number(amount);
      if (!paymentKey || !orderId || !amount || !Number.isInteger(paidAmount)) {
        topupHandledRef.current = true;
        cleanUrl();
        return;
      }
      // Wait until the parent session is restored, then confirm exactly once.
      if (role !== "parent") return;
      topupHandledRef.current = true;
      (async () => {
        try {
          const result = await confirmTopup({ paymentKey, orderId, amount: paidAmount });
          cleanUrl();
          if (result.credited) {
            toast({ title: `충전 완료! +${result.creditedPoints.toLocaleString("ko-KR")}P` });
            topupChannelRef.current?.postMessage({
              type: "topup-success",
              balance: result.balance,
              creditedPoints: result.creditedPoints,
            });
          } else if (result.status && result.status !== "DONE") {
            toast({ title: "결제가 아직 완료되지 않았어요.", variant: "destructive" });
          } else {
            // Already credited. The response balance is still authoritative, so
            // broadcast it too in case another app context is open.
            toast({ title: "이미 처리된 결제예요." });
            topupChannelRef.current?.postMessage({
              type: "topup-success",
              balance: result.balance,
              creditedPoints: result.creditedPoints,
            });
          }
        } catch (err) {
          topupHandledRef.current = false;
          const message = err instanceof Error ? err.message : "결제 확인에 실패했어요.";
          toast({ title: message, variant: "destructive" });
        }
      })();
    }
  }, [loading, role, confirmTopup, topupReturn]);

  const spendAllowance = async (childId: number, amount: number, purpose: string, category?: string): Promise<boolean> => {
    try {
      const result = await api.post<{ childBalance: number; id: number; createdAt: string }>("/transactions", {
        childId, amount: -amount, description: purpose, type: "spend", category: category ?? null,
      });
      setCurrentChild(prev => prev ? { ...prev, balance: result.childBalance } : prev);
      setTransactions(prev => [{
        id: result.id, childId, amount: -amount, description: purpose, category: category ?? null,
        type: "spend", createdAt: result.createdAt ?? new Date().toISOString(),
      }, ...prev]);
      return true;
    } catch {
      return false;
    }
  };

  const createRequest = async (type: ChildRequest["type"], message: string) => {
    await api.post("/requests", { type, message });
  };

  const resolveRequest = async (id: number, status: "resolved" | "dismissed") => {
    await api.patch(`/requests/${id}`, { status });
    setChildRequests(prev => prev.filter(r => r.id !== id));
  };

  const buyGifticon = async (catalogItemId: string, amount?: number) => {
    const result = await api.post<{ order: GifticonOrder; childBalance: number }>(
      "/gifticons/orders",
      amount === undefined ? { catalogItemId } : { catalogItemId, amount },
    );
    setCurrentChild(prev => prev ? { ...prev, balance: result.childBalance } : prev);
    const [txs, orders] = await Promise.all([
      api.get<Transaction[]>("/transactions"),
      api.get<GifticonOrder[]>("/gifticons/orders"),
    ]);
    setTransactions(txs);
    setGifticonOrders(orders);
  };

  const cancelGifticonOrder = async (orderId: number) => {
    const result = await api.post<{ order: GifticonOrder; childBalance: number }>(
      `/gifticons/orders/${orderId}/cancel`,
      {},
    );
    setCurrentChild(prev => prev ? { ...prev, balance: result.childBalance } : prev);
    const [txs, orders] = await Promise.all([
      api.get<Transaction[]>("/transactions"),
      api.get<GifticonOrder[]>("/gifticons/orders"),
    ]);
    setTransactions(txs);
    setGifticonOrders(orders);
  };

  const getGifticonOrderDetail = async (orderId: number) => {
    return api.get<GifticonOrderDetail>(`/gifticons/orders/${orderId}`);
  };

  const markGifticonUsed = async (orderId: number) => {
    await api.post<GifticonOrder>(`/gifticons/orders/${orderId}/use`, {});
    await refreshGifticonOrders();
  };

  const createGifticonCatalogItem = async (data: { brand: string; productName: string; price: number; isVariablePrice?: boolean; emoji?: string }) => {
    await api.post<GifticonCatalogItem>("/gifticons/catalog", data);
    await refreshGifticonCatalog();
  };

  const deleteGifticonCatalogItem = async (id: number) => {
    await api.delete(`/gifticons/catalog/${id}`);
    await refreshGifticonCatalog();
  };

  const fulfillGifticonOrderByParent = async (
    orderId: number,
    issued?: { issuedPin?: string; issuedBarcode?: string; issuedImageUrl?: string },
  ) => {
    await api.patch<GifticonOrder>(`/gifticons/orders/${orderId}/fulfill`, issued ?? {});
    await refreshGifticonOrders();
  };

  const rejectGifticonOrderByParent = async (orderId: number, reason?: string) => {
    await api.patch<{ order: GifticonOrder; childBalance: number }>(
      `/gifticons/orders/${orderId}/reject`,
      { reason },
    );
    await refreshGifticonOrders();
  };

  return (
    <AppContext.Provider value={{
      role, loading, parent, currentChild, children, transactions, parentTransactions, missions, pendingLogs, missionLogs, childRequests,
      login, signup, logout, childLogin,
      startTopupCheckout, confirmTopup,
      createChild, deleteChild, refreshChildren,
      createMission, updateMission, deleteMission, refreshMissions,
      submitMission,
      refreshPendingLogs, refreshMissionLogs, approveMissionLog, rejectMissionLog,
      chargeAllowance, spendAllowance, refreshParentTransactions,
      createRequest, refreshRequests, resolveRequest,
      gifticonCatalog, gifticonOrders, refreshGifticonCatalog, refreshGifticonOrders,
      buyGifticon, cancelGifticonOrder, getGifticonOrderDetail, markGifticonUsed,
      createGifticonCatalogItem, deleteGifticonCatalogItem,
      fulfillGifticonOrderByParent, rejectGifticonOrderByParent,
    }}>
      {reactChildren}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) throw new Error("useAppContext must be used within an AppProvider");
  return context;
}
