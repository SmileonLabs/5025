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
}

export interface Mission {
  id: string;
  title: string;
  verse: string;
  reward: number;
  completed: boolean;
  dueDate: string;
  completedAt?: string;
}

const INITIAL_MISSIONS: Mission[] = [
  { id: "m1", title: "창세기 1장", verse: "태초에 하나님이 천지를 창조하시니라", reward: 500, completed: false, dueDate: "오늘" },
  { id: "m2", title: "시편 23편", verse: "여호와는 나의 목자시니 내게 부족함이 없으리로다", reward: 300, completed: false, dueDate: "내일" },
  { id: "m3", title: "요한복음 3:16", verse: "하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니...", reward: 400, completed: false, dueDate: "이번 주" },
];

interface AppState {
  role: Role;
  loading: boolean;
  parent: ParentData | null;
  currentChild: ChildData | null;
  children: ChildData[];
  transactions: Transaction[];
  missions: Mission[];
  // Auth actions
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
  // Transactions
  completeMission: (missionId: string, childId: number) => Promise<void>;
  chargeAllowance: (childId: number, amount: number) => Promise<void>;
  spendAllowance: (childId: number, amount: number, purpose: string) => Promise<boolean>;
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children: reactChildren }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  const [parent, setParent] = useState<ParentData | null>(null);
  const [currentChild, setCurrentChild] = useState<ChildData | null>(null);
  const [children, setChildren] = useState<ChildData[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [missions, setMissions] = useState<Mission[]>(INITIAL_MISSIONS);

  const refreshChildren = useCallback(async () => {
    try {
      const data = await api.get<ChildData[]>("/children");
      setChildren(data);
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
          const kids = await api.get<ChildData[]>("/children");
          setChildren(kids);
        } else if (me.role === "child") {
          setRole("child");
          setCurrentChild({ id: me.id, name: me.name, age: me.age, avatar: me.avatar, balance: me.balance, parentId: me.parentId });
          const txs = await api.get<Transaction[]>("/transactions");
          setTransactions(txs);
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
    const kids = await api.get<ChildData[]>("/children");
    setChildren(kids);
  };

  const signup = async (name: string, email: string, password: string) => {
    const data = await api.post<ParentData>("/auth/signup", { name, email, password });
    setParent(data);
    setRole("parent");
    setCurrentChild(null);
    setChildren([]);
  };

  const logout = async () => {
    await api.post("/auth/logout", {});
    setRole(null);
    setParent(null);
    setCurrentChild(null);
    setChildren([]);
    setTransactions([]);
    setMissions(INITIAL_MISSIONS);
  };

  const childLogin = async (childId: number, pin: string) => {
    const data = await api.post<ChildData>("/auth/child-login", { childId, pin });
    setCurrentChild(data);
    setRole("child");
    setParent(null);
    setChildren([]);
    const txs = await api.get<Transaction[]>("/transactions");
    setTransactions(txs);
    setMissions(INITIAL_MISSIONS);
  };

  const createChild = async (name: string, age: number, avatar: string, pin: string) => {
    const child = await api.post<ChildData>("/children", { name, age, avatar, pin });
    setChildren(prev => [...prev, child]);
  };

  const deleteChild = async (childId: number) => {
    await api.delete(`/children/${childId}`);
    setChildren(prev => prev.filter(c => c.id !== childId));
  };

  const completeMission = async (missionId: string, childId: number) => {
    const mission = missions.find(m => m.id === missionId);
    if (!mission || mission.completed) return;
    const result = await api.post<{ childBalance: number; id: number; createdAt: string }>("/transactions", {
      childId,
      amount: mission.reward,
      description: `${mission.title} 읽기 완료`,
      type: "mission",
    });
    setMissions(prev => prev.map(m => m.id === missionId ? { ...m, completed: true, completedAt: new Date().toISOString() } : m));
    setCurrentChild(prev => prev ? { ...prev, balance: result.childBalance } : prev);
    setTransactions(prev => [{
      id: result.id,
      childId,
      amount: mission.reward,
      description: `${mission.title} 읽기 완료`,
      type: "mission",
      createdAt: result.createdAt ?? new Date().toISOString(),
    }, ...prev]);
  };

  const chargeAllowance = async (childId: number, amount: number) => {
    const result = await api.post<{ childBalance: number; id: number; createdAt: string }>("/transactions", {
      childId,
      amount,
      description: "용돈 채우기",
      type: "charge",
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

  const spendAllowance = async (childId: number, amount: number, purpose: string): Promise<boolean> => {
    try {
      const result = await api.post<{ childBalance: number; id: number; createdAt: string }>("/transactions", {
        childId,
        amount: -amount,
        description: purpose,
        type: "spend",
      });
      setCurrentChild(prev => prev ? { ...prev, balance: result.childBalance } : prev);
      setTransactions(prev => [{
        id: result.id,
        childId,
        amount: -amount,
        description: purpose,
        type: "spend",
        createdAt: result.createdAt ?? new Date().toISOString(),
      }, ...prev]);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <AppContext.Provider value={{
      role, loading, parent, currentChild, children, transactions, missions,
      login, signup, logout, childLogin,
      topupParent,
      createChild, deleteChild, refreshChildren,
      completeMission, chargeAllowance, spendAllowance,
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
