import { useLocation } from "wouter";
import { Settings, Plus, ChevronRight } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { BibleIllustration } from "@/components/BibleIllustration";
import { TransactionItem } from "@/components/TransactionItem";

export default function DashboardPage() {
  const [_, setLocation] = useLocation();
  const { parent, children, transactions } = useAppContext();

  const totalBalance = children.reduce((sum, child) => sum + child.balance, 0);
  const recentMissions = transactions.filter(t => t.type === 'mission').slice(0, 3);

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-12">
      {/* Header */}
      <div className="bg-white px-6 pt-12 pb-6 shadow-sm rounded-b-[32px] mb-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            안녕하세요, <br/>
            <span className="text-primary-foreground">{parent.name}</span>님 👋
          </h1>
          <button className="p-2 bg-gray-50 rounded-full text-gray-500">
            <Settings className="w-6 h-6" />
          </button>
        </div>

        <div className="flex gap-4 mb-6">
          <div className="flex-1 bg-primary/10 rounded-[20px] p-4 border border-primary/20">
            <p className="text-sm font-medium text-primary-foreground/80 mb-1">아이들 총 잔액</p>
            <p className="text-2xl font-bold text-primary-foreground">{totalBalance.toLocaleString('ko-KR')}원</p>
          </div>
          <div className="flex-1 bg-secondary/20 rounded-[20px] p-4 border border-secondary/30">
            <p className="text-sm font-medium text-secondary-foreground/80 mb-1">아이 수</p>
            <p className="text-2xl font-bold text-secondary-foreground">{children.length}명</p>
          </div>
        </div>

        <Button 
          onClick={() => setLocation("/parent/charge")}
          className="w-full h-[56px] rounded-[16px] text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
          data-testid="btn-go-charge"
        >
          💰 용돈 채우기
        </Button>
      </div>

      <div className="px-6 space-y-8">
        {/* Children Balances */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900">아이 잔고 현황</h2>
          </div>
          <div className="space-y-4">
            {children.map(child => {
              const targetGoal = 20000;
              const progress = Math.min(100, (child.balance / targetGoal) * 100);
              
              return (
                <div key={child.id} className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-2xl">
                        {child.avatar}
                      </div>
                      <span className="font-bold text-lg">{child.name}</span>
                    </div>
                    <div className="font-bold text-xl">
                      {child.balance.toLocaleString('ko-KR')}원
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1.5 font-medium">
                      <span>이번 달 목표</span>
                      <span>{progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-secondary/80 rounded-full" 
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <BibleIllustration />

        {/* Recent Missions */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900">최근 완료한 미션</h2>
            <button className="text-primary-foreground text-sm font-bold flex items-center">
              더보기 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100">
            {recentMissions.length > 0 ? (
              <div className="flex flex-col">
                {recentMissions.map((tx, i) => (
                  <TransactionItem 
                    key={tx.id} 
                    description={`${children.find(c => c.id === tx.childId)?.name} - ${tx.description}`}
                    amount={tx.amount}
                    date={tx.date}
                    type={tx.type}
                  />
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-4">최근 완료된 미션이 없습니다.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
