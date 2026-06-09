import { useLocation } from "wouter";
import { useAppContext } from "@/context/AppContext";
import { BottomNav } from "@/components/BottomNav";
import { TransactionItem } from "@/components/TransactionItem";

export default function LedgerPage() {
  const [_, setLocation] = useLocation();
  const { selectedChildId, children, transactions } = useAppContext();

  const child = children.find(c => c.id === selectedChildId);

  if (!child) {
    setLocation("/login");
    return null;
  }

  const childTransactions = transactions.filter(t => t.childId === child.id);
  
  // In a real app we'd group by month. Here we just show them.

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-24">
      <div className="bg-primary px-6 pt-12 pb-8 rounded-b-[32px] text-white shadow-sm mb-6">
        <h1 className="text-lg font-bold text-center mb-6 text-primary-foreground">용돈기입장</h1>
        <div className="text-center">
          <p className="text-primary-foreground/80 text-sm font-medium mb-1">현재 잔액</p>
          <h2 className="text-4xl font-black">₩{child.balance.toLocaleString('ko-KR')}</h2>
        </div>
      </div>

      <div className="px-6">
        <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-500 mb-2">최근 내역</h3>
          {childTransactions.length > 0 ? (
            <div className="flex flex-col">
              {childTransactions.map(tx => (
                <TransactionItem 
                  key={tx.id}
                  description={tx.description}
                  amount={tx.amount}
                  date={tx.date}
                  type={tx.type}
                />
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-gray-500">아직 용돈 내역이 없어요.</p>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
