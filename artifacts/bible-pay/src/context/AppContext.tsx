import React, { createContext, useState, useContext, useCallback, useEffect, ReactNode } from "react";
import { api } from "@/lib/api";

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

export type TransactionType = "mission" | "charge" | "spend";

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

export interface Mission {
  id: number;
  parentId: number;
  title: string;
  description: string;
  type: "bible" | "auto" | "confirm";
  reward: number;
  isActive: boolean;
  createdAt: string;
}

export interface PendingLog {
  id: number;
  missionId: number;
  childId: number;
  status: "requested";
  requestedAt: string;
  mission: { id: number; title: string; reward: number; type: string };
  child: { id: number; name: string; avatar: string };
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
  childRequests: ChildRequest[];
  // Auth
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  childLogin: (childId: number, pin: string) => Promise<void>;
  // Parent top-up
  topupParent: (amount: number) => Promise<void>;
  // Child management
  createChild: (name: string, age: number, avatar: string, pin: string) => Promise<void>;
  deleteChild: (childId: number) => Promise<void>;
  refreshChildren: () => Promise<void>;
  // Mission management (parent)
  createMission: (data: { title: string; description: string; type: Mission["type"]; reward: number }) => Promise<void>;
  updateMission: (id: number, data: Partial<Pick<Mission, "title" | "description" | "reward" | "isActive">>) => Promise<void>;
  deleteMission: (id: number) => Promise<void>;
  refreshMissions: () => Promise<void>;
  // Mission actions (child)
  submitMission: (missionId: number, opts?: { bibleBook?: string; bibleChapter?: number; reflection?: string }) => Promise<{ childBalance: number }>;
  // Pending approvals (parent)
  refreshPendingLogs: () => Promise<void>;
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
  const [childRequests, setChildRequests] = useState<ChildRequest[]>([]);

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

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const me = await api.get<{ role: "parent" | "child" } & ParentData & ChildData>("/auth/me");
        if (me.role === "parent") {
          setRole("parent");
          setParent({ id: me.id, name: me.name, email: me.email, balance: me.balance });
          const [kids, missionList, pending, parentTxs, requests] = await Promise.all([
            api.get<ChildData[]>("/children"),
            api.get<Mission[]>("/missions"),
            api.get<PendingLog[]>("/missions/pending"),
            api.get<Transaction[]>("/transactions/all"),
            api.get<ChildRequest[]>("/requests"),
          ]);
          setChildren(kids);
          setMissions(missionList);
          setPendingLogs(pending);
          setParentTransactions(parentTxs);
          setChildRequests(requests);
        } else if (me.role === "child") {
          setRole("child");
          setCurrentChild({ id: me.id, name: me.name, age: me.age, avatar: me.avatar, balance: me.balance, parentId: me.parentId });
          const [txs, missionList] = await Promise.all([
            api.get<Transaction[]>("/transactions"),
            api.get<Mission[]>("/missions"),
          ]);
          setTransactions(txs);
          setMissions(missionList);
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
    const [kids, missionList, pending, parentTxs, requests] = await Promise.all([
      api.get<ChildData[]>("/children"),
      api.get<Mission[]>("/missions"),
      api.get<PendingLog[]>("/missions/pending"),
      api.get<Transaction[]>("/transactions/all"),
      api.get<ChildRequest[]>("/requests"),
    ]);
    setChildren(kids);
    setMissions(missionList);
    setPendingLogs(pending);
    setParentTransactions(parentTxs);
    setChildRequests(requests);
  };

  const signup = async (name: string, email: string, password: string) => {
    const data = await api.post<ParentData>("/auth/signup", { name, email, password });
    setParent(data);
    setRole("parent");
    setCurrentChild(null);
    setChildren([]);
    setMissions([]);
    setPendingLogs([]);
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
    setChildRequests([]);
  };

  const childLogin = async (childId: number, pin: string) => {
    const data = await api.post<ChildData>("/auth/child-login", { childId, pin });
    setCurrentChild(data);
    setRole("child");
    setParent(null);
    setChildren([]);
    const [txs, missionList] = await Promise.all([
      api.get<Transaction[]>("/transactions"),
      api.get<Mission[]>("/missions"),
    ]);
    setTransactions(txs);
    setMissions(missionList);
  };

  const createChild = async (name: string, age: number, avatar: string, pin: string) => {
    const child = await api.post<ChildData>("/children", { name, age, avatar, pin });
    setChildren(prev => [...prev, child]);
  };

  const deleteChild = async (childId: number) => {
    await api.delete(`/children/${childId}`);
    setChildren(prev => prev.filter(c => c.id !== childId));
  };

  const createMission = async (data: { title: string; description: string; type: Mission["type"]; reward: number }) => {
    const mission = await api.post<Mission>("/missions", { ...data, isActive: true });
    setMissions(prev => [mission, ...prev]);
  };

  const updateMission = async (id: number, data: Partial<Pick<Mission, "title" | "description" | "reward" | "isActive">>) => {
    const updated = await api.patch<Mission>(`/missions/${id}`, data);
    setMissions(prev => prev.map(m => m.id === id ? updated : m));
  };

  const deleteMission = async (id: number) => {
    await api.delete(`/missions/${id}`);
    setMissions(prev => prev.filter(m => m.id !== id));
  };

  const submitMission = async (missionId: number, opts?: { bibleBook?: string; bibleChapter?: number; reflection?: string }): Promise<{ childBalance: number }> => {
    const result = await api.post<{ childBalance: number; log: unknown; tx?: unknown; pending?: boolean }>(
      `/missions/${missionId}/submit`,
      { bibleBook: opts?.bibleBook, bibleChapter: opts?.bibleChapter, reflection: opts?.reflection }
    );
    if (!result.pending && result.childBalance !== undefined) {
      setCurrentChild(prev => prev ? { ...prev, balance: result.childBalance } : prev);
      const txs = await api.get<Transaction[]>("/transactions");
      setTransactions(txs);
    }
    return { childBalance: result.childBalance };
  };

  const approveMissionLog = async (logId: number) => {
    const result = await api.post<{ childBalance: number }>(`/mission-logs/${logId}/approve`, {});
    setPendingLogs(prev => prev.filter(l => l.id !== logId));
    // Refresh children to show updated balance
    await refreshChildren();
  };

  const rejectMissionLog = async (logId: number) => {
    await api.post(`/mission-logs/${logId}/reject`, {});
    setPendingLogs(prev => prev.filter(l => l.id !== logId));
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

  const topupParent = async (amount: number) => {
    const result = await api.post<{ balance: number }>("/auth/topup", { amount });
    setParent(prev => prev ? { ...prev, balance: result.balance } : prev);
  };

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

  return (
    <AppContext.Provider value={{
      role, loading, parent, currentChild, children, transactions, parentTransactions, missions, pendingLogs, childRequests,
      login, signup, logout, childLogin,
      topupParent,
      createChild, deleteChild, refreshChildren,
      createMission, updateMission, deleteMission, refreshMissions,
      submitMission,
      refreshPendingLogs, approveMissionLog, rejectMissionLog,
      chargeAllowance, spendAllowance, refreshParentTransactions,
      createRequest, refreshRequests, resolveRequest,
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
