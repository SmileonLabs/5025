import React, { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Bell, Award, ShoppingBag } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import { BottomNav } from "@/components/BottomNav";
import { MissionCard } from "@/components/MissionCard";
import { BibleIllustration } from "@/components/BibleIllustration";
import { SpendModal } from "@/components/SpendModal";
import { NotificationsModal } from "@/components/NotificationsModal";
import { getNotificationPrefs, getLastSeen, setLastSeen } from "@/lib/notificationPrefs";
import { motion } from "framer-motion";

export default function HomePage() {
  const [_, setLocation] = useLocation();
  const { currentChild, missions, transactions } = useAppContext();
  const [spendOpen, setSpendOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [seenAt, setSeenAt] = useState(0);

  React.useEffect(() => {
    if (!currentChild) setLocation("/login");
    else setSeenAt(getLastSeen(currentChild.id));
  }, [currentChild, setLocation]);

  const hasUnread = useMemo(() => {
    if (!currentChild) return false;
    const prefs = getNotificationPrefs(currentChild.id);
    const txUnread = transactions.some(t =>
      new Date(t.createdAt).getTime() > seenAt &&
      ((t.type === "mission" && prefs.mission) || (t.type === "charge" && prefs.charge))
    );
    const missionUnread = prefs.newMission && missions.some(m => m.isActive && new Date(m.createdAt).getTime() > seenAt);
    return txUnread || missionUnread;
  }, [currentChild, transactions, missions, seenAt]);

  const openNotifications = () => {
    if (currentChild) {
      const now = Date.now();
      setLastSeen(currentChild.id, now);
      setSeenAt(now);
    }
    setNotifOpen(true);
  };

  if (!currentChild) return null;

  const featuredMission = missions.find(m => m.isActive) ?? missions[0];

  const totalEarned = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const completedMissionsCount = transactions.filter(t => t.type === "mission").length;

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-24">
      <div
        className="bg-white px-6 pb-4 sticky top-0 z-40 shadow-[0_4px_24px_rgba(0,0,0,0.02)]"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }}
      >
        <div className="flex justify-center mb-2">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="5025" className="h-11 w-auto" />
        </div>
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            안녕, {currentChild.name}! <span className="text-2xl">{currentChild.avatar}</span>
          </h1>
          <button onClick={openNotifications} className="p-2 text-gray-500 bg-gray-50 rounded-full relative" data-testid="btn-notifications">
            <Bell className="w-6 h-6" />
            {hasUnread && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-400 rounded-full border-2 border-white" />
            )}
          </button>
        </div>
      </div>

      <div className="px-6 pt-6 space-y-6">
        {/* Hero Balance Card */}
        <div className="w-full bg-gradient-to-br from-primary via-primary/90 to-accent/80 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-xl translate-y-1/2 -translate-x-1/2" />

          <div className="relative z-10">
            <p className="text-white/70 font-medium mb-1 text-sm">내 잔액</p>
            <h2 className="text-4xl font-black mb-5">₩{currentChild.balance.toLocaleString("ko-KR")}</h2>

            <div className="flex gap-2">
              <button
                onClick={() => setLocation("/child/ledger")}
                className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-bold transition-colors"
                data-testid="btn-go-ledger"
              >
                내역 보기
              </button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setSpendOpen(true)}
                className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-bold transition-colors flex items-center gap-1"
                data-testid="btn-spend-home"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                용돈 쓰기
              </motion.button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-3">
          <button
            onClick={() => setLocation("/child/ledger?filter=earned")}
            className="flex-1 bg-white rounded-[20px] p-4 shadow-sm border border-gray-100 text-left active:scale-[0.98] transition-transform"
            data-testid="stat-earned"
          >
            <p className="text-xs text-gray-400 font-medium mb-1">총 번 용돈</p>
            <p className="font-black text-emerald-500 text-base">+{totalEarned.toLocaleString("ko-KR")}원</p>
          </button>
          <button
            onClick={() => setLocation("/child/ledger?filter=earned")}
            className="flex-1 bg-white rounded-[20px] p-4 shadow-sm border border-gray-100 flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
            data-testid="stat-missions"
          >
            <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center">
              <Award className="w-4 h-4 text-accent-foreground" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">완료한 미션</p>
              <p className="font-black text-gray-900">{completedMissionsCount}개</p>
            </div>
          </button>
        </div>

        {/* Today's Mission */}
        {featuredMission && (
          <section>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-bold text-gray-900">오늘의 미션</h2>
              <button
                onClick={() => setLocation("/child/missions")}
                className="text-primary-foreground text-sm font-bold"
                data-testid="btn-all-missions"
              >
                전체보기
              </button>
            </div>
            <MissionCard mission={featuredMission} childId={currentChild.id} />
          </section>
        )}

        {missions.length === 0 && (
          <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100 text-center">
            <div className="text-4xl mb-2">📋</div>
            <p className="font-bold text-gray-700">아직 미션이 없어요</p>
            <p className="text-sm text-gray-400 mt-1">부모님이 미션을 만들어 주실 거예요!</p>
          </div>
        )}

        <BibleIllustration />
      </div>

      <BottomNav />

      <SpendModal
        open={spendOpen}
        onClose={() => setSpendOpen(false)}
        childId={currentChild.id}
        balance={currentChild.balance}
      />

      <NotificationsModal open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}
