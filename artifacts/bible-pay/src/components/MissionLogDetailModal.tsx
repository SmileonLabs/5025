import { motion, AnimatePresence } from "framer-motion";
import { X, BookOpen } from "lucide-react";
import type { MissionLog } from "@/context/AppContext";
import { MissionResultContent, formatDateTime } from "./MissionResultContent";

const STATUS_BADGE: Record<MissionLog["status"], { label: string; cls: string }> = {
  completed: { label: "완료", cls: "bg-green-50 text-green-700" },
  approved: { label: "부모님 승인 완료", cls: "bg-green-50 text-green-700" },
  requested: { label: "승인 대기 중", cls: "bg-orange-50 text-orange-600" },
  rejected: { label: "반려됨", cls: "bg-red-50 text-red-500" },
};

const TYPE_LABEL: Record<string, string> = { bible: "성경읽기", activity: "활동미션" };

interface Props {
  log: MissionLog | null;
  open: boolean;
  onClose: () => void;
  /** 부모 화면처럼 여러 아이의 내역이 섞일 때 아이 이름을 보여준다 */
  showChild?: boolean;
}

export function MissionLogDetailModal({ log, open, onClose, showChild = false }: Props) {
  return (
    <AnimatePresence>
      {open && log && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[28px] shadow-2xl max-h-[90dvh] overflow-y-auto"
            data-testid="mission-log-detail-modal"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            <div className="px-6 pb-10">
              <div className="flex items-center justify-between py-3">
                <h2 className="text-lg font-black text-gray-900">미션 수행 상세</h2>
                <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full" data-testid="btn-close-log-detail">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col gap-5">
                {/* Summary */}
                <div className="flex flex-col items-center text-center gap-2 pt-1">
                  <div className="w-16 h-16 rounded-[20px] flex items-center justify-center bg-green-50">
                    <BookOpen className="w-8 h-8 text-green-600" />
                  </div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mt-1">{TYPE_LABEL[log.mission.type] ?? "미션"}</p>
                  <p className="font-bold text-gray-900 text-base leading-snug">{log.mission.title}</p>
                  {log.status !== "rejected" && (
                    <p className="text-3xl font-black tabular-nums text-emerald-500">+{log.rewardAmount.toLocaleString("ko-KR")}P</p>
                  )}
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${STATUS_BADGE[log.status].cls}`} data-testid="log-status-badge">
                    {STATUS_BADGE[log.status].label}
                  </span>
                </div>

                {/* Meta */}
                <div className="bg-gray-50 rounded-[18px] divide-y divide-gray-100">
                  {showChild && log.child && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-gray-400 font-medium">아이</span>
                      <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                        <span className="text-base">{log.child.avatar}</span>
                        {log.child.name}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-gray-400 font-medium">일시</span>
                    <span className="text-sm font-bold text-gray-800">{formatDateTime(log.createdAt)}</span>
                  </div>
                </div>

                {/* Result evidence */}
                <MissionResultContent data={{
                  missionType: log.mission.type,
                  bibleBook: log.bibleBook,
                  bibleChapter: log.bibleChapter,
                  reflection: log.reflection,
                  quiz: log.quiz,
                  photoUrl: log.photoUrl,
                }} />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
