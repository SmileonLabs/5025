import { useState } from "react";
import { useLocation } from "wouter";
import { Plus, ChevronRight, LogOut, UserPlus, PlusCircle, ClipboardList, Gift, Check, X, Settings2, BookOpen } from "lucide-react";
import { useAppContext, type ChildData } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { BibleIllustration } from "@/components/BibleIllustration";
import { TransactionItem } from "@/components/TransactionItem";
import { ChildCreateModal } from "@/components/ChildCreateModal";
import { ParentTopupModal } from "@/components/ParentTopupModal";
import { PushNotificationCard } from "@/components/PushNotificationCard";
import { ReadingProfileModal } from "@/components/ReadingProfileModal";

const REQUEST_TYPE_META: Record<string, { emoji: string; label: string }> = {
  allowance: { emoji: "💸", label: "용돈 요청" },
  mission: { emoji: "📋", label: "미션 요청" },
  message: { emoji: "💬", label: "메시지" },
};

export default function DashboardPage() {
  const [_, setLocation] = useLocation();
  const { parent, children, parentTransactions, logout, pendingLogs, missions, childRequests, resolveRequest, gifticonOrders, refreshChildren } = useAppContext();
  const [createOpen, setCreateOpen] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [readingProfileChild, setReadingProfileChild] = useState<ChildData | null>(null);

  if (!parent) {
    setLocation("/");
    return null;
  }

  const childName = (childId: number) => children.find(c => c.id === childId)?.name ?? "";
  const totalBalance = children.reduce((sum, child) => sum + child.balance, 0);
  const recentMissions = parentTransactions
    .filter(t => t.type === "mission")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);
  const pendingRequests = childRequests.filter(r => r.status === "pending");
  const pendingGifticons = gifticonOrders.filter(o => o.status === "requested").length;

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-12">
      <div className="bg-white px-6 pt-12 pb-6 shadow-sm rounded-b-[32px] mb-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            안녕하세요,<br />
            <span className="text-primary-foreground">{parent.name}</span>님 👋
          </h1>
          <button onClick={handleLogout} className="p-2 bg-gray-50 rounded-full text-gray-500" data-testid="btn-logout">
            <LogOut className="w-6 h-6" />
          </button>
        </div>

        {/* Parent budget card */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-[20px] p-5 mb-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-xl translate-x-1/2 -translate-y-1/2" />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium mb-1">내 예산 잔액</p>
              <p className="text-3xl font-black text-white">{parent.balance.toLocaleString("ko-KR")}P</p>
            </div>
            <button
              onClick={() => setTopupOpen(true)}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-2.5 rounded-full text-white text-sm font-bold transition-colors"
              data-testid="btn-open-topup"
            >
              <PlusCircle className="w-4 h-4" />
              충전
            </button>
          </div>
          <p className="text-blue-200 text-xs mt-2 font-medium relative z-10">
            아이들 용돈은 이 예산에서 나가요
          </p>
        </div>

        <div className="flex gap-3 mb-1">
          <div className="flex-1 bg-primary/10 rounded-[18px] p-3.5 border border-primary/20">
            <p className="text-xs font-medium text-primary-foreground/70 mb-0.5">아이들 총 잔액</p>
            <p className="text-xl font-bold text-primary-foreground">{totalBalance.toLocaleString("ko-KR")}P</p>
          </div>
          <div className="flex-1 bg-secondary/20 rounded-[18px] p-3.5 border border-secondary/30">
            <p className="text-xs font-medium text-secondary-foreground/70 mb-0.5">아이 수</p>
            <p className="text-xl font-bold text-secondary-foreground">{children.length}명</p>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <Button
            onClick={() => setLocation("/parent/charge")}
            className="flex-1 h-[52px] rounded-[16px] text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
            data-testid="btn-go-charge"
          >
            💰 용돈 채우기
          </Button>
          <Button
            onClick={() => setLocation("/parent/missions")}
            variant="outline"
            className="h-[52px] px-4 rounded-[16px] font-bold border-gray-200 relative"
            data-testid="btn-go-missions"
          >
            <ClipboardList className="w-5 h-5" />
            {pendingLogs.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                {pendingLogs.length}
              </span>
            )}
          </Button>
          <Button
            onClick={() => setLocation("/parent/gifticons")}
            variant="outline"
            className="h-[52px] px-4 rounded-[16px] font-bold border-gray-200 relative"
            data-testid="btn-go-gifticons"
          >
            <Gift className="w-5 h-5" />
            {pendingGifticons > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                {pendingGifticons}
              </span>
            )}
          </Button>
          <Button
            onClick={() => setCreateOpen(true)}
            variant="outline"
            className="h-[52px] px-4 rounded-[16px] font-bold border-gray-200"
            data-testid="btn-create-child-icon"
          >
            <UserPlus className="w-5 h-5" />
          </Button>
          <Button onClick={() => setLocation("/parent/books")} variant="outline" className="h-[52px] px-4 rounded-[16px] font-bold border-gray-200" aria-label="일반도서 등록"><BookOpen className="w-5 h-5" /></Button>
        </div>
      </div>

      <div className="px-6 space-y-8">
        <PushNotificationCard />

        {pendingRequests.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-bold text-gray-900">아이들의 요청</h2>
              <span className="w-6 h-6 bg-red-500 text-white text-xs font-black rounded-full flex items-center justify-center">
                {pendingRequests.length}
              </span>
            </div>
            <div className="space-y-3">
              {pendingRequests.map(req => {
                const meta = REQUEST_TYPE_META[req.type] ?? { emoji: "💬", label: "요청" };
                return (
                  <div
                    key={req.id}
                    className="bg-white rounded-[20px] p-4 shadow-sm border border-gray-100"
                    data-testid={`request-${req.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-xl flex-shrink-0">
                        {req.childAvatar || "🧒"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-gray-900 text-sm">{req.childName}</span>
                          <span className="text-xs font-bold text-gray-400">{meta.emoji} {meta.label}</span>
                        </div>
                        <p className="text-sm text-gray-600 break-words">{req.message}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => resolveRequest(req.id, "resolved")}
                        className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-[12px] bg-primary text-primary-foreground text-sm font-bold"
                        data-testid={`btn-resolve-${req.id}`}
                      >
                        <Check className="w-4 h-4" /> 해결됨
                      </button>
                      <button
                        onClick={() => resolveRequest(req.id, "dismissed")}
                        className="px-4 flex items-center justify-center gap-1.5 h-10 rounded-[12px] bg-gray-100 text-gray-500 text-sm font-bold"
                        data-testid={`btn-dismiss-${req.id}`}
                      >
                        <X className="w-4 h-4" /> 무시
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900">아이 잔고 현황</h2>
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1 text-sm font-bold text-primary-foreground"
              data-testid="btn-add-child"
            >
              <Plus className="w-4 h-4" /> 아이 추가
            </button>
          </div>

          {children.length === 0 ? (
            <button
              onClick={() => setCreateOpen(true)}
              className="w-full bg-white rounded-[24px] p-8 shadow-sm border-2 border-dashed border-gray-200 flex flex-col items-center gap-3 hover:border-primary/40 transition-colors"
              data-testid="btn-empty-create-child"
            >
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-2xl">👶</div>
              <div className="text-center">
                <p className="font-bold text-gray-700">아이 계정을 만들어요</p>
                <p className="text-sm text-gray-400 mt-1">아이가 성경을 읽고 용돈을 받을 수 있어요</p>
              </div>
            </button>
          ) : (
            <div className="space-y-4">
              {children.map(child => {
                const activeMissionTotal = missions
                  .filter(m => m.isActive)
                  .reduce((sum, m) => sum + m.reward, 0);
                const hasMissions = activeMissionTotal > 0;
                const progress = hasMissions
                  ? Math.min(100, (child.balance / activeMissionTotal) * 100)
                  : 0;
                return (
                  <div key={child.id} className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-2xl">{child.avatar}</div>
                        <div>
                          <span className="font-bold text-lg">{child.name}</span>
                          <p className="text-sm text-gray-400">{child.age}세</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2"><div className="font-bold text-xl">{child.balance.toLocaleString("ko-KR")}P</div><button onClick={() => setReadingProfileChild(child)} className="p-2 rounded-full bg-violet-50 text-violet-600" aria-label={`${child.name} 독서 AI 설정`}><Settings2 className="w-4 h-4" /></button></div>
                    </div>
                    {hasMissions ? (
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1.5 font-medium">
                          <span>미션 전부 달성 시 최대 보상</span>
                          <span>{child.balance.toLocaleString("ko-KR")} / {activeMissionTotal.toLocaleString("ko-KR")}P</span>
                        </div>
                        <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-secondary/80 rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2 text-center">
                        미션을 만들면 아이가 용돈을 벌 수 있어요 📋
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <BibleIllustration />

        {recentMissions.length > 0 && (
          <section>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">최근 완료한 미션</h2>
              <button
                onClick={() => setLocation("/parent/history")}
                className="text-primary-foreground text-sm font-bold flex items-center"
                data-testid="btn-history-more"
              >
                더보기 <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100">
              <div className="flex flex-col">
                {recentMissions.map(tx => (
                  <TransactionItem
                    key={tx.id}
                    description={`${childName(tx.childId)} · ${tx.description}`}
                    amount={tx.amount}
                    date={tx.createdAt}
                    type={tx.type}
                  />
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      <ChildCreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <ParentTopupModal open={topupOpen} onClose={() => setTopupOpen(false)} />
      {readingProfileChild && <ReadingProfileModal child={readingProfileChild} onClose={() => setReadingProfileChild(null)} onSaved={refreshChildren} />}
    </div>
  );
}
