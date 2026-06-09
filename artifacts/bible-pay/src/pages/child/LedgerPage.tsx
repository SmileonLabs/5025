import React, { useState } from "react";
import { useLocation } from "wouter";
import { TrendingUp, TrendingDown, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext, Transaction } from "@/context/AppContext";
import { BottomNav } from "@/components/BottomNav";
import { TransactionItem } from "@/components/TransactionItem";
import { SpendModal } from "@/components/SpendModal";

function groupByDate(transactions: Transaction[]): { label: string; items: Transaction[] }[] {
  const map = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    const d = new Date(tx.createdAt);
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86400000);

    let label: string;
    if (d.toDateString() === today.toDateString()) {
      label = "오늘";
    } else if (d.toDateString() === yesterday.toDateString()) {
      label = "어제";
    } else {
      label = `${d.getMonth() + 1}월 ${d.getDate()}일`;
    }

    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(tx);
  }

  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

type Filter = "전체" | "번 돈" | "쓴 돈";
const FILTERS: Filter[] = ["전체", "번 돈", "쓴 돈"];

export default function LedgerPage() {
  const [_, setLocation] = useLocation();
  const { currentChild, transactions } = useAppContext();
  const [filter, setFilter] = useState<Filter>("전체");
  const [spendOpen, setSpendOpen] = useState(false);

  React.useEffect(() => {
    if (!currentChild) setLocation("/login");
  }, [currentChild, setLocation]);

  if (!currentChild) return null;

  const childTxs = transactions
    .filter(t => {
      if (filter === "번 돈") return t.amount > 0;
      if (filter === "쓴 돈") return t.amount < 0;
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalEarned = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalSpent = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  const grouped = groupByDate(childTxs);

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-28">
      <div className="bg-white px-6 pt-12 pb-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
        <h1 className="text-lg font-bold text-gray-900 text-center mb-5">용돈기입장</h1>

        <div className="text-center mb-6">
          <p className="text-sm text-gray-400 font-medium mb-1">현재 잔액</p>
          <h2 className="text-4xl font-black text-gray-900">
            ₩{currentChild.balance.toLocaleString("ko-KR")}
          </h2>
        </div>

        <div className="flex gap-3 mb-5">
          <div className="flex-1 bg-emerald-50 rounded-[18px] p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-[11px] text-emerald-600 font-bold">총 번 돈</p>
              <p className="font-black text-emerald-700 text-sm">+{totalEarned.toLocaleString("ko-KR")}원</p>
            </div>
          </div>
          <div className="flex-1 bg-red-50 rounded-[18px] p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <p className="text-[11px] text-red-500 font-bold">총 쓴 돈</p>
              <p className="font-black text-red-600 text-sm">-{totalSpent.toLocaleString("ko-KR")}원</p>
            </div>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setSpendOpen(true)}
          className="w-full h-[52px] bg-gradient-to-r from-orange-400 to-red-400 hover:from-orange-500 hover:to-red-500 text-white rounded-[16px] font-bold text-base flex items-center justify-center gap-2 shadow-md transition-all"
          data-testid="btn-open-spend"
        >
          <Plus className="w-5 h-5" />
          용돈 쓰기
        </motion.button>
      </div>

      <div className="px-6 pt-5 pb-2">
        <div className="flex gap-2">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                filter === f ? "bg-gray-900 text-white shadow-sm" : "bg-white text-gray-500 border border-gray-200"
              }`}
              data-testid={`filter-${f}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 pt-3 space-y-4">
        <AnimatePresence mode="wait">
          {grouped.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-[24px] p-10 text-center shadow-sm border border-gray-100"
            >
              <p className="text-4xl mb-3">📭</p>
              <p className="text-gray-500 font-medium">내역이 없어요</p>
            </motion.div>
          ) : (
            grouped.map(({ label, items }, gi) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gi * 0.04 }}
              >
                <div className="flex items-center gap-3 mb-2 px-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{label}</span>
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-xs text-gray-300 font-medium">
                    {items.reduce((s, t) => s + t.amount, 0) >= 0
                      ? `+${items.reduce((s, t) => s + t.amount, 0).toLocaleString("ko-KR")}원`
                      : `${items.reduce((s, t) => s + t.amount, 0).toLocaleString("ko-KR")}원`}
                  </span>
                </div>

                <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 px-4 overflow-hidden">
                  {items.map(tx => (
                    <TransactionItem
                      key={tx.id}
                      description={tx.description}
                      amount={tx.amount}
                      date={tx.createdAt}
                      type={tx.type}
                    />
                  ))}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      <BottomNav />

      <SpendModal
        open={spendOpen}
        onClose={() => setSpendOpen(false)}
        childId={currentChild.id}
        balance={currentChild.balance}
      />
    </div>
  );
}
