import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, BookOpen, Coins, Sparkles } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import { getNotificationPrefs, setNotificationPrefs, NotificationPrefs } from "@/lib/notificationPrefs";

interface NotificationSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const ROWS: { key: keyof NotificationPrefs; icon: React.ComponentType<{ className?: string }>; bg: string; color: string; label: string; desc: string }[] = [
  { key: "mission", icon: BookOpen, bg: "bg-green-50", color: "text-green-600", label: "미션 보상 알림", desc: "용돈을 받으면 알려줘요" },
  { key: "charge", icon: Coins, bg: "bg-blue-50", color: "text-blue-500", label: "용돈 충전 알림", desc: "부모님이 충전하면 알려줘요" },
  { key: "newMission", icon: Sparkles, bg: "bg-amber-50", color: "text-amber-500", label: "새 미션 알림", desc: "새 미션이 생기면 알려줘요" },
];

export function NotificationSettingsModal({ open, onClose }: NotificationSettingsModalProps) {
  const { currentChild } = useAppContext();
  const [prefs, setPrefs] = useState<NotificationPrefs>({ mission: true, charge: true, newMission: true });

  useEffect(() => {
    if (open && currentChild) setPrefs(getNotificationPrefs(currentChild.id));
  }, [open, currentChild]);

  const toggle = (key: keyof NotificationPrefs) => {
    if (!currentChild) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setNotificationPrefs(currentChild.id, next);
  };

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
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[28px] shadow-2xl"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="px-6 pb-10">
              <div className="flex items-center justify-between py-4">
                <h2 className="text-xl font-black text-gray-900">🔔 알림 설정</h2>
                <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full" data-testid="btn-close-notif-settings">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                {ROWS.map(row => {
                  const Icon = row.icon;
                  const on = prefs[row.key];
                  return (
                    <div key={row.key} className="flex items-center gap-3 p-4 rounded-[18px] bg-gray-50">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${row.bg} ${row.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 text-sm">{row.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{row.desc}</p>
                      </div>
                      <button
                        onClick={() => toggle(row.key)}
                        className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${on ? "bg-primary" : "bg-gray-300"}`}
                        data-testid={`toggle-${row.key}`}
                        aria-pressed={on}
                      >
                        <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-gray-400 text-center mt-5">설정은 이 기기에 저장돼요.</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
