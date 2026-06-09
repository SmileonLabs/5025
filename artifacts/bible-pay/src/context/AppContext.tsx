import React, { createContext, useState, useContext, ReactNode } from "react";

export type Role = "parent" | "child" | null;

export interface Parent {
  name: string;
  email: string;
  balance: number;
}

export interface Child {
  id: string;
  name: string;
  age: number;
  balance: number;
  avatar: string;
}

export interface Transaction {
  id: string;
  childId: string;
  date: string;
  amount: number;
  description: string;
  type: "mission" | "charge";
}

export interface Mission {
  id: string;
  title: string;
  verse: string;
  reward: number;
  completed: boolean;
  dueDate: string;
  completedAt?: string;
  childId?: string;
}

interface AppState {
  role: Role;
  setRole: (role: Role) => void;
  parent: Parent;
  children: Child[];
  selectedChildId: string | null;
  setSelectedChildId: (id: string | null) => void;
  transactions: Transaction[];
  missions: Mission[];
  completeMission: (missionId: string, childId: string) => void;
  chargeAllowance: (childId: string, amount: number) => void;
  rewardChild: (childId: string, amount: number, description: string) => boolean;
}

const initialMissions: Mission[] = [
  { id: "m1", title: "창세기 1장", verse: "태초에 하나님이 천지를 창조하시니라", reward: 500, completed: false, dueDate: "오늘" },
  { id: "m2", title: "시편 23편", verse: "여호와는 나의 목자시니 내게 부족함이 없으리로다", reward: 300, completed: true, dueDate: "어제" },
  { id: "m3", title: "요한복음 3:16", verse: "하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니...", reward: 400, completed: false, dueDate: "내일" }
];

const initialChildren: Child[] = [
  { id: "c1", name: "김하은", age: 9, balance: 12500, avatar: "🌸" },
  { id: "c2", name: "김도현", age: 7, balance: 8000, avatar: "⭐" }
];

const initialTransactions: Transaction[] = [
  { id: "t1", childId: "c1", date: new Date().toISOString(), amount: 500, description: "잠언 1장 읽기 완료", type: "mission" },
  { id: "t2", childId: "c1", date: new Date(Date.now() - 86400000).toISOString(), amount: 5000, description: "용돈 채우기", type: "charge" },
  { id: "t3", childId: "c2", date: new Date().toISOString(), amount: 300, description: "시편 23편 읽기 완료", type: "mission" },
];

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [parentBalance, setParentBalance] = useState<number>(50000);
  const [childrenState, setChildrenState] = useState<Child[]>(initialChildren);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [missions, setMissions] = useState<Mission[]>(initialMissions);

  const parent: Parent = { name: "김부모", email: "parent@demo.com", balance: parentBalance };

  const completeMission = (missionId: string, childId: string) => {
    const mission = missions.find(m => m.id === missionId);
    if (!mission || mission.completed) return;

    setMissions(prev => prev.map(m => m.id === missionId ? { ...m, completed: true, completedAt: new Date().toISOString() } : m));

    const newTx: Transaction = {
      id: `tx_${Date.now()}`,
      childId,
      date: new Date().toISOString(),
      amount: mission.reward,
      description: `${mission.title} 읽기 완료`,
      type: "mission"
    };
    setTransactions(prev => [newTx, ...prev]);
    setChildrenState(prev => prev.map(c => c.id === childId ? { ...c, balance: c.balance + mission.reward } : c));
    setParentBalance(prev => Math.max(0, prev - mission.reward));
  };

  const rewardChild = (childId: string, amount: number, description: string): boolean => {
    if (parentBalance < amount) return false;

    const newTx: Transaction = {
      id: `tx_${Date.now()}`,
      childId,
      date: new Date().toISOString(),
      amount,
      description,
      type: "mission"
    };
    setTransactions(prev => [newTx, ...prev]);
    setChildrenState(prev => prev.map(c => c.id === childId ? { ...c, balance: c.balance + amount } : c));
    setParentBalance(prev => prev - amount);
    return true;
  };

  const chargeAllowance = (childId: string, amount: number) => {
    const newTx: Transaction = {
      id: `tx_${Date.now()}`,
      childId,
      date: new Date().toISOString(),
      amount,
      description: "용돈 채우기",
      type: "charge"
    };
    setTransactions(prev => [newTx, ...prev]);
    setChildrenState(prev => prev.map(c => c.id === childId ? { ...c, balance: c.balance + amount } : c));
    setParentBalance(prev => prev + amount);
  };

  return (
    <AppContext.Provider value={{
      role, setRole,
      parent,
      children: childrenState,
      selectedChildId, setSelectedChildId,
      transactions,
      missions,
      completeMission,
      chargeAllowance,
      rewardChild,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}
