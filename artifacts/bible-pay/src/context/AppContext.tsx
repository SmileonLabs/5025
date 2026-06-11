import React, { createContext, useState, useContext, useCallback, useEffect, useRef, ReactNode } from "react";
import { api } from "@/lib/api";
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

export type MissionType = "bible" | "activity";
export type MissionScheduleType = "daily" | "once";

export interface Mission {
  id: number;
  parentId: number;
  title: string;
  description: string;
  type: MissionType;
  reward: number;
  // activity 전용 메타 (bible은 무시)
  scheduleType: MissionScheduleType;
  scheduledDate: string | null;
  timeLimit: string | null;
  requiresPhoto: boolean;
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
  timeLimit?: string | null;
  requiresPhoto: boolean;
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
  // Parent top-up (Stripe Checkout)
  startTopupCheckout: (amount: number) => Promise<void>;
  confirmTopup: (sessionId: string) => Promise<{ credited: boolean; paidAmount: number; creditedPoints: number; balance: number; status?: string }>;
  // Child management
  createChild: (name: string, age: number, avatar: string, pin: string) => Promise<void>;
  deleteChild: (childId: number) => Promise<void>;
  refreshChildren: () => Promise<void>;
  // Mission management (parent)
  createMission: (data: MissionInput) => Promise<void>;
  updateMission: (id: number, data: Partial<Pick<Mission, "title" | "description" | "reward" | "isActive" | "scheduleType" | "scheduledDate" | "timeLimit" | "requiresPhoto" | "assignToAll">> & { childIds?: number[] }) => Promise<void>;
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
          setCurrentChild({ id: me.id, name: me.name, age: me.age, avatar: me.avatar, balance: me.balance, parentId: me.parentId });
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

  const updateMission = async (id: number, data: Partial<Pick<Mission, "title" | "description" | "reward" | "isActive" | "scheduleType" | "scheduledDate" | "timeLimit" | "requiresPhoto" | "assignToAll">> & { childIds?: number[] }) => {
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
    await api.post<{ childBalance: number }>(`/mission-logs/${logId}/approve`, {});
    setPendingLogs(prev => prev.filter(l => l.id !== logId));
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
    // Stripe Checkout refuses to render inside an iframe (X-Frame-Options), and
    // the app often runs embedded (e.g. the Replit canvas), so open Checkout in a
    // separate tab. Open the blank tab synchronously inside the click gesture so
    // the popup blocker doesn't kill it; only then fetch the session URL.
    const checkoutTab = window.open("about:blank", "_blank");
    if (!checkoutTab) {
      throw new Error("팝업이 차단됐어요. 팝업을 허용한 뒤 다시 시도해주세요.");
    }
    try {
      const { url } = await api.post<{ url: string }>("/topups/checkout-session", { amount });
      checkoutTab.location.href = url;
    } catch (err) {
      checkoutTab.close();
      throw err;
    }
  }, []);

  const confirmTopup = useCallback(async (sessionId: string) => {
    const result = await api.post<{ credited: boolean; paidAmount: number; creditedPoints: number; balance: number; status?: string }>(
      "/topups/confirm",
      { sessionId },
    );
    setParent(prev => (prev ? { ...prev, balance: result.balance } : prev));
    return result;
  }, []);

  // Capture the Stripe return params on first render, BEFORE the router can
  // redirect "/" to the dashboard and strip the query string. (LoginPage, a
  // descendant, runs its redirect effect before this provider's effect.)
  const [stripeReturn] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return { topup: params.get("topup"), sessionId: params.get("session_id") };
  });

  // Handle the return from Stripe Checkout. The redirect lands on "/" with
  // ?topup=success&session_id=... (or ?topup=cancel), so confirm here once the
  // parent session is restored, then clean the URL.
  const topupHandledRef = useRef(false);

  // Cross-tab budget sync: Stripe Checkout completes in a separate tab, so when
  // that tab credits the top-up it broadcasts the new balance and any other open
  // tab (e.g. the embedded app) updates without a manual refresh.
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

    const { topup, sessionId } = stripeReturn;
    if (!topup) return;

    const cleanUrl = () => window.history.replaceState({}, "", window.location.pathname);

    if (topup === "cancel") {
      topupHandledRef.current = true;
      cleanUrl();
      toast({ title: "결제를 취소했어요." });
      return;
    }

    if (topup === "success") {
      if (!sessionId) {
        topupHandledRef.current = true;
        cleanUrl();
        return;
      }
      // Wait until the parent session is restored, then confirm exactly once.
      if (role !== "parent") return;
      topupHandledRef.current = true;
      (async () => {
        try {
          const result = await confirmTopup(sessionId);
          cleanUrl();
          if (result.credited) {
            toast({ title: `충전 완료! +${result.creditedPoints.toLocaleString("ko-KR")}P` });
            topupChannelRef.current?.postMessage({
              type: "topup-success",
              balance: result.balance,
              creditedPoints: result.creditedPoints,
            });
          } else if (result.status && result.status !== "paid") {
            toast({ title: "결제가 아직 완료되지 않았어요.", variant: "destructive" });
          } else {
            // Already credited (e.g. the webhook won the race). The balance in the
            // response is still authoritative, so broadcast it too — otherwise an
            // embedded tab would stay stale until a manual refresh.
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
  }, [loading, role, confirmTopup, stripeReturn]);

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
