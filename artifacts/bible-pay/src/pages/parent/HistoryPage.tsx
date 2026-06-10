import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft } from "lucide-react";
import { useAppContext, Transaction } from "@/context/AppContext";
import { TransactionItem } from "@/components/TransactionItem";
import { TransactionDetailModal } from "@/components/TransactionDetailModal";

type Filter = "전체" | "미션" | "충전" | "사용";

const FILTERS: { label: Filter; match: (t: Transaction) => boolean }[] = [
  { label: "전체", match: () => true },
  { label: "미션", match: t => t.type === "mission" },
  { label: "충전", match: t => t.type === "charge" },
  { label: "사용", match: t => t.type === "spend" },
];

function groupByDate(transactions: Transaction[]): { label: string; items: Transaction[] }[] {
  const map = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const d = new Date(t.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return Array.from(map.entries()).map(([key, items]) => {
    const d = new Date(items[0].createdAt);
    return { label: `${d.getMonth() + 1}월 ${d.getDate()}일`, items };
  });
}

export default function HistoryPage() {
  const [_, setLocation] = useLocation();
  const { parent, parentTransactions, children, refreshParentTransactions } = useAppContext();
  const [filter, setFilter] = useState<Filter>("전체");
  const [detailTxId, setDetailTxId] = useState<number | null>(null);

  useEffect(() => {
    if (!parent) {
      setLocation("/");
      return;
    }
    refreshParentTransactions();
  }, [parent, setLocation, refreshParentTransactions]);

  if (!parent) return null;

  const childName = (childId: number) => children.find(c => c.id === childId)?.name ?? "";

  const matcher = FILTERS.find(f => f.label === filter)!.match;
  const filtered = parentTransactions
    .filter(matcher)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const grouped = groupByDate(filtered);

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-12">
      <div className="bg-white px-6 pt-12 pb-4 sticky top-0 z-40 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setLocation("/parent/dashboard")}
            className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full"
            data-testid="btn-back"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">전체 거래 내역</h1>
        </div>

        <div className="flex gap-2">
          {FILTERS.map(f => (
            <button
              key={f.label}
              onClick={() => setFilter(f.label)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${
                filter === f.label ? "bg-primary text-primary-foreground" : "bg-gray-100 text-gray-500"
              }`}
              data-testid={`filter-${f.label}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 pt-5 space-y-6">
        {grouped.length === 0 ? (
          <div className="bg-white rounded-[24px] p-10 shadow-sm border border-gray-100 text-center">
            <div className="text-4xl mb-2">📭</div>
            <p className="font-bold text-gray-700">거래 내역이 없어요</p>
          </div>
        ) : (
          grouped.map(({ label, items }) => (
            <div key={label}>
              <p className="text-xs font-bold text-gray-400 mb-2 px-1">{label}</p>
              <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 px-4 overflow-hidden">
                {items.map(tx => (
                  <TransactionItem
                    key={tx.id}
                    description={`${childName(tx.childId)} · ${tx.description}`}
                    amount={tx.amount}
                    date={tx.createdAt}
                    type={tx.type}
                    category={tx.category}
                    onClick={() => setDetailTxId(tx.id)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <TransactionDetailModal
        transactionId={detailTxId}
        open={detailTxId !== null}
        onClose={() => setDetailTxId(null)}
        showChild
      />
    </div>
  );
}
