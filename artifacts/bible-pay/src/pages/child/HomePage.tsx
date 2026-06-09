import { useLocation } from "wouter";
import { Bell, Award, Wallet } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import { BottomNav } from "@/components/BottomNav";
import { MissionCard } from "@/components/MissionCard";
import { BibleIllustration } from "@/components/BibleIllustration";

export default function HomePage() {
  const [_, setLocation] = useLocation();
  const { selectedChildId, children, missions, transactions } = useAppContext();
  
  const child = children.find(c => c.id === selectedChildId);

  if (!child) {
    setLocation("/login");
    return null;
  }

  // Find today's mission - just pick the first uncompleted one for mock
  const todaysMission = missions.find(m => !m.completed) || missions[0];
  
  const thisMonthTransactions = transactions.filter(t => t.childId === child.id && t.type === 'charge');
  const thisMonthAllowance = thisMonthTransactions.reduce((sum, t) => sum + t.amount, 0);
  
  const completedMissionsCount = transactions.filter(t => t.childId === child.id && t.type === 'mission').length;

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white px-6 pt-12 pb-4 flex justify-between items-center sticky top-0 z-40 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          안녕, {child.name}! <span className="text-2xl">{child.avatar}</span>
        </h1>
        <button className="p-2 text-gray-500 bg-gray-50 rounded-full relative">
          <Bell className="w-6 h-6" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-white"></span>
        </button>
      </div>

      <div className="px-6 pt-6 space-y-6">
        {/* HERO Balance Card */}
        <div className="w-full bg-gradient-to-br from-primary via-primary/90 to-accent/80 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-xl translate-y-1/2 -translate-x-1/2"></div>
          
          <div className="relative z-10">
            <p className="text-primary-foreground/80 font-medium mb-1">내 잔액</p>
            <h2 className="text-4xl font-black mb-4">₩{child.balance.toLocaleString('ko-KR')}</h2>
            
            <div className="flex gap-2">
              <button 
                onClick={() => setLocation("/child/ledger")}
                className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-bold transition-colors"
              >
                내역 보기
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-4">
          <div className="flex-1 bg-white rounded-[20px] p-4 shadow-sm border border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary/20 text-secondary-foreground flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">이번 달 받은 용돈</p>
              <p className="font-bold text-gray-900">{thisMonthAllowance.toLocaleString('ko-KR')}원</p>
            </div>
          </div>
          <div className="flex-1 bg-white rounded-[20px] p-4 shadow-sm border border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/20 text-accent-foreground flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">완료한 미션</p>
              <p className="font-bold text-gray-900">{completedMissionsCount}개</p>
            </div>
          </div>
        </div>

        {/* Today's Mission */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900">오늘의 성경 읽기</h2>
            <button 
              onClick={() => setLocation("/child/missions")}
              className="text-primary-foreground text-sm font-bold"
            >
              전체보기
            </button>
          </div>
          
          <MissionCard mission={todaysMission} childId={child.id} />
        </section>

        <BibleIllustration />
      </div>

      <BottomNav />
    </div>
  );
}
