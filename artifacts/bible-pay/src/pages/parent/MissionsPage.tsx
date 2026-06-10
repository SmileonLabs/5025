import { useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Plus, Trash2, ToggleLeft, ToggleRight, CheckCircle, XCircle, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext, type Mission, type PendingLog } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const TYPE_LABELS: Record<Mission["type"], { label: string; emoji: string; desc: string; color: string }> = {
  bible: { label: "성경읽기", emoji: "📖", desc: "책과 장을 선택 → AI 퀴즈 2문제 통과 시 자동 지급", color: "bg-blue-50 text-blue-700 border-blue-200" },
  auto:  { label: "자율형",   emoji: "✅", desc: "아이가 완료 버튼을 누르면 자동으로 지급", color: "bg-green-50 text-green-700 border-green-200" },
  confirm: { label: "확인형", emoji: "🔍", desc: "아이 완료 요청 후 부모님이 확인해야 지급", color: "bg-orange-50 text-orange-700 border-orange-200" },
};

function MissionCreateModal({ onClose }: { onClose: () => void }) {
  const { createMission } = useAppContext();
  const { toast } = useToast();
  const [type, setType] = useState<Mission["type"]>("bible");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) { toast({ title: "미션 이름을 입력해주세요.", variant: "destructive" }); return; }
    const rewardNum = parseInt(reward, 10);
    if (!reward || isNaN(rewardNum) || rewardNum < 0) { toast({ title: "보상 금액을 입력해주세요.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await createMission({ title: title.trim(), description: description.trim(), type, reward: rewardNum });
      toast({ title: "미션이 추가됐어요! 🎉" });
      onClose();
    } catch {
      toast({ title: "미션 추가에 실패했어요.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end" onClick={onClose}>
      <motion.div
        initial={{ y: 300, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 300, opacity: 0 }}
        className="bg-white w-full rounded-t-[32px] p-6 pb-10 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-2" />
        <h2 className="text-xl font-black text-gray-900">새 미션 추가</h2>

        <div>
          <p className="text-sm font-bold text-gray-600 mb-2">미션 종류</p>
          <div className="grid grid-cols-3 gap-2">
            {(["bible", "auto", "confirm"] as Mission["type"][]).map(t => {
              const info = TYPE_LABELS[t];
              return (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`p-3 rounded-[16px] border-2 flex flex-col items-center gap-1.5 transition-all ${
                    type === t ? "border-primary bg-primary/5" : "border-gray-100 bg-white"
                  }`}
                >
                  <span className="text-2xl">{info.emoji}</span>
                  <span className="text-xs font-bold text-gray-800">{info.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-2 bg-gray-50 rounded-xl px-3 py-2">{TYPE_LABELS[type].desc}</p>
        </div>

        <div>
          <p className="text-sm font-bold text-gray-600 mb-1.5">미션 이름</p>
          <input
            type="text"
            placeholder={type === "bible" ? "예) 성경 읽기" : type === "auto" ? "예) 오늘 기도하기" : "예) 방 청소하기"}
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-4 py-3 rounded-[14px] border border-gray-200 text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <p className="text-sm font-bold text-gray-600 mb-1.5">설명 (선택)</p>
          <input
            type="text"
            placeholder="아이에게 보여줄 설명을 입력하세요"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full px-4 py-3 rounded-[14px] border border-gray-200 text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <p className="text-sm font-bold text-gray-600 mb-1.5">보상 금액</p>
          <div className="relative">
            <input
              type="number"
              placeholder="0"
              value={reward}
              onChange={e => setReward(e.target.value)}
              className="w-full px-4 py-3 rounded-[14px] border border-gray-200 text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 pr-10"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">P</span>
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full h-[52px] rounded-[16px] font-bold text-base bg-primary hover:bg-primary/90 text-white"
        >
          {saving ? "저장 중..." : "미션 추가하기 🚀"}
        </Button>
      </motion.div>
    </div>
  );
}

function PendingCard({ log, onApprove, onReject }: { log: PendingLog; onApprove: () => void; onReject: () => void }) {
  const [loading, setLoading] = useState(false);

  const approve = async () => {
    setLoading(true);
    try { await onApprove(); } finally { setLoading(false); }
  };
  const reject = async () => {
    setLoading(true);
    try { await onReject(); } finally { setLoading(false); }
  };

  return (
    <div className="bg-white rounded-[20px] p-4 border border-orange-100 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-xl">{log.child.avatar}</div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm">{log.child.name}</p>
          <p className="text-xs text-gray-500 truncate">{log.mission.title}</p>
        </div>
        <div className="bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full text-xs font-bold">
          +{log.mission.reward.toLocaleString("ko-KR")}P
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        <Clock className="w-3 h-3 inline mr-1" />
        {new Date(log.requestedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" })}
      </p>
      <div className="flex gap-2">
        <button
          onClick={reject}
          disabled={loading}
          className="flex-1 py-2.5 rounded-[12px] border-2 border-red-100 text-red-500 font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-red-50 transition-colors"
        >
          <XCircle className="w-4 h-4" /> 반려
        </button>
        <button
          onClick={approve}
          disabled={loading}
          className="flex-1 py-2.5 rounded-[12px] bg-green-500 text-white font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-green-600 transition-colors"
        >
          <CheckCircle className="w-4 h-4" /> 승인 (+{log.mission.reward.toLocaleString("ko-KR")}P)
        </button>
      </div>
    </div>
  );
}

export default function ParentMissionsPage() {
  const [_, setLocation] = useLocation();
  const { missions, pendingLogs, updateMission, deleteMission, approveMissionLog, rejectMissionLog } = useAppContext();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [tab, setTab] = useState<"missions" | "pending">("missions");

  const handleToggle = async (m: Mission) => {
    try {
      await updateMission(m.id, { isActive: !m.isActive });
      toast({ title: m.isActive ? "미션을 비활성화했어요." : "미션을 활성화했어요!" });
    } catch {
      toast({ title: "변경에 실패했어요.", variant: "destructive" });
    }
  };

  const handleDelete = async (m: Mission) => {
    if (!confirm(`"${m.title}" 미션을 삭제할까요?`)) return;
    try {
      await deleteMission(m.id);
      toast({ title: "미션을 삭제했어요." });
    } catch {
      toast({ title: "삭제에 실패했어요.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-10">
      <div className="bg-white px-6 pt-12 pb-4 sticky top-0 z-40 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between mb-5">
          <button onClick={() => setLocation("/parent/dashboard")} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-black text-gray-900">미션 관리</h1>
          <button
            onClick={() => setCreateOpen(true)}
            className="p-2 bg-primary/10 rounded-full text-primary-foreground hover:bg-primary/20 transition-colors"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-full">
          <button
            onClick={() => setTab("missions")}
            className={`flex-1 py-2 text-sm font-bold rounded-full transition-all ${tab === "missions" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
          >
            📋 미션 목록
          </button>
          <button
            onClick={() => setTab("pending")}
            className={`flex-1 py-2 text-sm font-bold rounded-full transition-all relative ${tab === "pending" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
          >
            🔔 확인 요청
            {pendingLogs.length > 0 && (
              <span className="absolute top-1 right-4 w-4 h-4 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                {pendingLogs.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="px-6 pt-5 space-y-4">
        {tab === "missions" && (
          <>
            {missions.length === 0 ? (
              <button
                onClick={() => setCreateOpen(true)}
                className="w-full bg-white rounded-[24px] p-8 shadow-sm border-2 border-dashed border-gray-200 flex flex-col items-center gap-3 hover:border-primary/40 transition-colors"
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-3xl">📋</div>
                <div className="text-center">
                  <p className="font-bold text-gray-700">첫 번째 미션을 만들어요!</p>
                  <p className="text-sm text-gray-400 mt-1">아이가 완료하면 용돈이 자동으로 지급돼요</p>
                </div>
              </button>
            ) : (
              missions.map(m => {
                const info = TYPE_LABELS[m.type];
                return (
                  <div key={m.id} className={`bg-white rounded-[20px] p-4 border shadow-sm ${m.isActive ? "border-gray-100" : "border-gray-100 opacity-60"}`}>
                    <div className="flex items-start gap-3">
                      <div className={`px-2.5 py-1 rounded-full text-xs font-bold border ${info.color}`}>
                        {info.emoji} {info.label}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900">{m.title}</p>
                        {m.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{m.description}</p>}
                        <p className="text-sm font-black text-primary-foreground mt-1">+{m.reward.toLocaleString("ko-KR")}P</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handleToggle(m)} className={`p-1 rounded-lg transition-colors ${m.isActive ? "text-green-500" : "text-gray-300"}`}>
                          {m.isActive ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                        </button>
                        <button onClick={() => handleDelete(m)} className="p-1 rounded-lg text-red-400 hover:bg-red-50 transition-colors">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {tab === "pending" && (
          <>
            {pendingLogs.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-5xl mb-4">🎉</div>
                <p className="font-bold text-gray-700">확인 대기 중인 미션이 없어요</p>
                <p className="text-sm text-gray-400 mt-1">아이가 완료 요청을 하면 여기에 나타나요</p>
              </div>
            ) : (
              pendingLogs.map(log => (
                <PendingCard
                  key={log.id}
                  log={log}
                  onApprove={() => approveMissionLog(log.id)}
                  onReject={() => rejectMissionLog(log.id)}
                />
              ))
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {createOpen && <MissionCreateModal onClose={() => setCreateOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
