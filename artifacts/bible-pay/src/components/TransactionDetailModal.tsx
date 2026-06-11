import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, BookOpen, Coins, ShoppingBag, Gift, RotateCcw, Loader2, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { TransactionType, type QuizQuestion } from "@/context/AppContext";
import { categoryEmoji } from "@/lib/spendCategories";
import { MissionResultContent } from "./MissionResultContent";

interface MissionResult {
  missionTitle: string | null;
  missionType: string | null;
  bibleBook: string | null;
  bibleChapter: number | null;
  reflection: string | null;
  quiz: QuizQuestion[] | null;
  photoUrl: string | null;
  status: "completed" | "requested" | "approved" | "rejected";
  completedAt: string;
}

interface TransactionDetail {
  id: number;
  childId: number;
  amount: number;
  description: string;
  type: TransactionType;
  category: string | null;
  createdAt: string;
  child: { id: number; name: string; avatar: string };
  mission: MissionResult | null;
}

const TYPE_CONFIG: Record<TransactionType, { icon: React.ComponentType<{ className?: string }>; bgClass: string; iconClass: string; label: string }> = {
  mission: { icon: BookOpen, bgClass: "bg-green-50", iconClass: "text-green-600", label: "미션 보상" },
  charge: { icon: Coins, bgClass: "bg-blue-50", iconClass: "text-blue-500", label: "용돈 충전" },
  spend: { icon: ShoppingBag, bgClass: "bg-red-50", iconClass: "text-red-400", label: "용돈 사용" },
  gifticon: { icon: Gift, bgClass: "bg-purple-50", iconClass: "text-purple-500", label: "기프티콘 구매" },
  refund: { icon: RotateCcw, bgClass: "bg-teal-50", iconClass: "text-teal-500", label: "기프티콘 환불" },
};

const STATUS_LABEL: Record<MissionResult["status"], string> = {
  completed: "완료",
  approved: "부모님 승인 완료",
  requested: "승인 대기 중",
  rejected: "반려됨",
};

const STATUS_STYLE: Record<MissionResult["status"], string> = {
  completed: "text-green-600",
  approved: "text-green-600",
  requested: "text-orange-500",
  rejected: "text-red-500",
};

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const hours = d.getHours();
  const ampm = hours < 12 ? "오전" : "오후";
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${ampm} ${h12}:${mm}`;
}

interface Props {
  transactionId: number | null;
  open: boolean;
  onClose: () => void;
  /** Show the child name (used in the parent view where one list spans multiple kids) */
  showChild?: boolean;
}

export function TransactionDetailModal({ transactionId, open, onClose, showChild = false }: Props) {
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || transactionId === null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    api
      .get<TransactionDetail>(`/transactions/${transactionId}`)
      .then(data => { if (!cancelled) setDetail(data); })
      .catch((err: Error) => { if (!cancelled) setError(err.message ?? "내역을 불러오지 못했어요."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, transactionId]);

  const config = detail ? TYPE_CONFIG[detail.type] : null;
  const Icon = config?.icon;
  const isPositive = (detail?.amount ?? 0) > 0;
  const m = detail?.mission ?? null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm"
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[60] bg-white rounded-t-[28px] shadow-2xl max-h-[90dvh] overflow-y-auto"
            data-testid="transaction-detail-modal"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            <div className="px-6 pb-10">
              <div className="flex items-center justify-between py-3">
                <h2 className="text-lg font-black text-gray-900">거래 내역 상세</h2>
                <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full" data-testid="btn-close-detail">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {loading && (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
                  <Loader2 className="w-7 h-7 animate-spin" />
                  <p className="text-sm font-medium">불러오는 중...</p>
                </div>
              )}

              {error && !loading && (
                <div className="py-16 text-center">
                  <p className="text-4xl mb-2">😢</p>
                  <p className="text-gray-500 font-medium">{error}</p>
                </div>
              )}

              {detail && config && Icon && !loading && (
                <div className="flex flex-col gap-5">
                  {/* Summary */}
                  <div className="flex flex-col items-center text-center gap-2 pt-1">
                    <div className={`w-16 h-16 rounded-[20px] flex items-center justify-center ${config.bgClass}`}>
                      <Icon className={`w-8 h-8 ${config.iconClass}`} />
                    </div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mt-1">{config.label}</p>
                    <p className="font-bold text-gray-900 text-base leading-snug">{detail.description}</p>
                    <p className={`text-3xl font-black tabular-nums ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
                      {isPositive ? "+" : ""}{detail.amount.toLocaleString("ko-KR")}P
                    </p>
                  </div>

                  {/* Meta */}
                  <div className="bg-gray-50 rounded-[18px] divide-y divide-gray-100">
                    {showChild && (
                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm text-gray-400 font-medium">아이</span>
                        <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                          <span className="text-base">{detail.child.avatar}</span>
                          {detail.child.name}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-gray-400 font-medium">일시</span>
                      <span className="text-sm font-bold text-gray-800">{formatDateTime(detail.createdAt)}</span>
                    </div>
                    {detail.type === "spend" && detail.category && (
                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm text-gray-400 font-medium">분류</span>
                        <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                          <span className="text-base">{categoryEmoji(detail.category)}</span>
                          {detail.category}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Mission result */}
                  {detail.type === "mission" && m && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">미션 결과</span>
                        <div className="flex-1 h-px bg-gray-100" />
                      </div>

                      <MissionResultContent data={{
                        missionType: m.missionType,
                        bibleBook: m.bibleBook,
                        bibleChapter: m.bibleChapter,
                        reflection: m.reflection,
                        quiz: m.quiz,
                        photoUrl: m.photoUrl,
                      }} />

                      {m.missionTitle && (
                        <div className="flex items-center justify-between px-1">
                          <span className="text-sm text-gray-400 font-medium">미션</span>
                          <span className="text-sm font-bold text-gray-800">{m.missionTitle}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between px-1">
                        <span className="text-sm text-gray-400 font-medium flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> 상태
                        </span>
                        <span className={`text-sm font-bold ${STATUS_STYLE[m.status]}`}>{STATUS_LABEL[m.status]}</span>
                      </div>
                    </div>
                  )}

                  {detail.type === "mission" && !m && (
                    <p className="text-center text-sm text-gray-400 py-2">이 미션의 상세 기록이 없어요.</p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
