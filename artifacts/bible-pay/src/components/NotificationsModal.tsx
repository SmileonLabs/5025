import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, BookOpen, Coins, Sparkles } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import { getNotificationPrefs } from "@/lib/notificationPrefs";

interface NotificationsModalProps {
  open: boolean;
  onClose: () => void;
}

interface NotiItem {
  id: string;
  ts: number;
  icon: React.ComponentType<{ className?: string }>;
  bg: string;
  color: string;
  title: string;
  body: string;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}

export function NotificationsModal({ open, onClose }: NotificationsModalProps) {
  const { currentChild, transactions, missions } = useAppContext();

  const items = useMemo<NotiItem[]>(() => {
    if (!currentChild) return [];
    const prefs = getNotificationPrefs(currentChild.id);
    const list: NotiItem[] = [];

    for (const tx of transactions) {
      const ts = new Date(tx.createdAt).getTime();
      if (tx.type === "mission" && prefs.mission) {
        list.push({
          id: `tx-${tx.id}`, ts, icon: BookOpen, bg: "bg-green-50", color: "text-green-600",
          title: "미션 보상을 받았어요! 🎉",
          body: `${tx.description} · +${tx.amount.toLocaleString("ko-KR")}P`,
        });
      } else if (tx.type === "charge" && prefs.charge) {
        list.push({
          id: `tx-${tx.id}`, ts, icon: Coins, bg: "bg-blue-50", color: "text-blue-500",
          title: "용돈이 충전됐어요 💰",
          body: `${tx.description} · +${tx.amount.toLocaleString("ko-KR")}P`,
        });
      }
    }

    if (prefs.newMission) {
      for (const m of missions) {
        if (!m.isActive) continue;
        list.push({
          id: `m-${m.id}`, ts: new Date(m.createdAt).getTime(), icon: Sparkles,
          bg: "bg-amber-50", color: "text-amber-500",
          title: "새로운 미션이 있어요 ✨",
          body: `${m.title} · ${m.reward.toLocaleString("ko-KR")}P`,
        });
      }
    }

    return list.sort((a, b) => b.ts - a.ts).slice(0, 30);
  }, [currentChild, transactions, missions]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[28px] shadow-2xl max-h-[85dvh] overflow-y-auto"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="px-6 pb-10">
              <div className="flex items-center justify-between py-4">
                <h2 className="text-xl font-black text-gray-900">🔔 알림</h2>
                <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full" data-testid="btn-close-notifications">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {items.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-4xl mb-3">🔕</p>
                  <p className="text-gray-500 font-medium">새로운 알림이 없어요</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map(item => {
                    const Icon = item.icon;
                    return (
                      <div key={item.id} className="flex items-start gap-3 p-3 rounded-[16px] bg-gray-50" data-testid="notification-item">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${item.bg} ${item.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 text-sm">{item.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{item.body}</p>
                        </div>
                        <span className="text-[11px] text-gray-400 font-medium whitespace-nowrap mt-0.5">{timeAgo(item.ts)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
