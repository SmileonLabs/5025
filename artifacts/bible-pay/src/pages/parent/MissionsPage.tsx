import { useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Plus, Trash2, ToggleLeft, ToggleRight, CheckCircle, XCircle, Clock, Camera, CalendarDays, Users, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext, type Mission, type MissionScheduleType, type PendingLog, type ChildData, type MissionLog } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MissionLogList } from "@/components/MissionLogList";
import { MissionLogDetailModal } from "@/components/MissionLogDetailModal";
import { apiUrl } from "@/lib/api";

const TYPE_LABELS: Record<Mission["type"], { label: string; emoji: string; desc: string; color: string }> = {
  bible:    { label: "성경읽기", emoji: "📖", desc: "책과 장을 선택 → AI 퀴즈 2문제 통과 시 즉시 지급", color: "bg-blue-50 text-blue-700 border-blue-200" },
  activity: { label: "활동미션", emoji: "🔍", desc: "아이가 완료(인증샷)하면 부모님이 확인 후 지급", color: "bg-orange-50 text-orange-700 border-orange-200" },
};

function todayKst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function MissionCreateModal({ onClose }: { onClose: () => void }) {
  const { createMission, children } = useAppContext();
  const { toast } = useToast();
  const [type, setType] = useState<Mission["type"]>("bible");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState("");
  const [scheduleType, setScheduleType] = useState<MissionScheduleType>("daily");
  const [scheduledDate, setScheduledDate] = useState("");
  const [timeLimit, setTimeLimit] = useState("");
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const [maxLimited, setMaxLimited] = useState(false);
  const [maxCount, setMaxCount] = useState("");
  const [assignToAll, setAssignToAll] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const selectAll = () => { setAssignToAll(true); setSelectedIds([]); };
  const toggleChild = (id: number) => {
    const next = selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id];
    setSelectedIds(next);
    // 아무도 선택 안 하면 자동으로 "전체"로 되돌림 (불변식 유지)
    setAssignToAll(next.length === 0);
  };

  const handleSubmit = async () => {
    if (!title.trim()) { toast({ title: "미션 이름을 입력해주세요.", variant: "destructive" }); return; }
    const rewardNum = parseInt(reward, 10);
    if (!reward || isNaN(rewardNum) || rewardNum < 0) { toast({ title: "보상 금액을 입력해주세요.", variant: "destructive" }); return; }
    if (type === "activity" && scheduleType === "once" && !scheduledDate) {
      toast({ title: "지정일을 선택해주세요.", variant: "destructive" }); return;
    }
    // 수행 횟수 제한은 매일 활동미션에만 적용 (once는 본래 1회, bible은 제외)
    let maxCompletions: number | null = null;
    if (type === "activity" && scheduleType === "daily" && maxLimited) {
      const n = parseInt(maxCount, 10);
      if (!maxCount || isNaN(n) || n < 1) {
        toast({ title: "수행 횟수를 1 이상으로 입력해주세요.", variant: "destructive" }); return;
      }
      maxCompletions = n;
    }
    setSaving(true);
    try {
      await createMission({
        title: title.trim(),
        description: description.trim(),
        type,
        reward: rewardNum,
        scheduleType: type === "activity" ? scheduleType : "daily",
        scheduledDate: type === "activity" && scheduleType === "once" ? scheduledDate : null,
        timeLimit: type === "activity" && timeLimit ? timeLimit : null,
        requiresPhoto: type === "activity" ? requiresPhoto : false,
        maxCompletions,
        assignToAll: children.length === 0 ? true : assignToAll,
        childIds: children.length === 0 || assignToAll ? undefined : selectedIds,
      });
      toast({ title: "미션이 추가됐어요! 🎉" });
      onClose();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "미션 추가에 실패했어요.", variant: "destructive" });
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
        className="bg-white w-full rounded-t-[32px] p-6 pb-10 space-y-5 max-h-[92dvh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-2" />
        <h2 className="text-xl font-black text-gray-900">새 미션 추가</h2>

        <div>
          <p className="text-sm font-bold text-gray-600 mb-2">미션 종류</p>
          <div className="grid grid-cols-2 gap-2">
            {(["bible", "activity"] as Mission["type"][]).map(t => {
              const tinfo = TYPE_LABELS[t];
              return (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`p-3 rounded-[16px] border-2 flex flex-col items-center gap-1.5 transition-all ${
                    type === t ? "border-primary bg-primary/5" : "border-gray-100 bg-white"
                  }`}
                  data-testid={`type-${t}`}
                >
                  <span className="text-2xl">{tinfo.emoji}</span>
                  <span className="text-xs font-bold text-gray-800">{tinfo.label}</span>
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
            placeholder={type === "bible" ? "예) 성경 읽기" : "예) 방 청소하기"}
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-4 py-3 rounded-[14px] border border-gray-200 text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            data-testid="input-title"
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
            data-testid="input-description"
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
              data-testid="input-reward"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">P</span>
          </div>
        </div>

        <div>
          <p className="text-sm font-bold text-gray-600 mb-2">대상 아이</p>
          {children.length === 0 ? (
            <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2">
              아직 등록된 아이가 없어요. 모든 아이에게 적용돼요.
            </p>
          ) : (
            <div className="space-y-2">
              <button
                onClick={selectAll}
                className={`w-full py-2.5 rounded-[14px] border-2 text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                  assignToAll ? "border-primary bg-primary/5 text-gray-900" : "border-gray-100 bg-white text-gray-500"
                }`}
                data-testid="assign-all"
              >
                <Users className="w-4 h-4" /> 전체 아이
              </button>
              <div className="flex flex-wrap gap-2">
                {children.map(c => {
                  const active = !assignToAll && selectedIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleChild(c.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-[14px] border-2 text-sm font-bold transition-all ${
                        active ? "border-primary bg-primary/5 text-gray-900" : "border-gray-100 bg-white text-gray-500"
                      }`}
                      data-testid={`assign-child-${c.id}`}
                    >
                      <span className="text-base">{c.avatar}</span> {c.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-400">
                {assignToAll ? "지금 있는·앞으로 추가될 모든 아이에게 보여요." : `선택한 ${selectedIds.length}명에게만 보여요.`}
              </p>
            </div>
          )}
        </div>

        {type === "activity" && (
          <div className="space-y-4 bg-orange-50/50 rounded-[18px] p-4 border border-orange-100">
            <div>
              <p className="text-sm font-bold text-gray-600 mb-2">반복</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { v: "daily" as MissionScheduleType, label: "매일", emoji: "🔁" },
                  { v: "once" as MissionScheduleType, label: "특정일 하루", emoji: "📅" },
                ]).map(opt => (
                  <button
                    key={opt.v}
                    onClick={() => setScheduleType(opt.v)}
                    className={`py-2.5 rounded-[14px] border-2 text-sm font-bold transition-all ${
                      scheduleType === opt.v ? "border-primary bg-white" : "border-gray-100 bg-white/60 text-gray-500"
                    }`}
                    data-testid={`schedule-${opt.v}`}
                  >
                    {opt.emoji} {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {scheduleType === "once" && (
              <div>
                <p className="text-sm font-bold text-gray-600 mb-1.5 flex items-center gap-1">
                  <CalendarDays className="w-4 h-4" /> 지정일
                </p>
                <input
                  type="date"
                  value={scheduledDate}
                  min={todayKst()}
                  onChange={e => setScheduledDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-[14px] border border-gray-200 text-sm font-medium focus:outline-none focus:border-primary"
                  data-testid="input-date"
                />
              </div>
            )}

            {scheduleType === "daily" && (
              <div>
                <p className="text-sm font-bold text-gray-600 mb-2 flex items-center gap-1">
                  <RefreshCw className="w-4 h-4" /> 수행 횟수
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMaxLimited(false)}
                    className={`py-2.5 rounded-[14px] border-2 text-sm font-bold transition-all ${
                      !maxLimited ? "border-primary bg-white" : "border-gray-100 bg-white/60 text-gray-500"
                    }`}
                    data-testid="max-unlimited"
                  >
                    ♾️ 무제한
                  </button>
                  <button
                    onClick={() => setMaxLimited(true)}
                    className={`py-2.5 rounded-[14px] border-2 text-sm font-bold transition-all ${
                      maxLimited ? "border-primary bg-white" : "border-gray-100 bg-white/60 text-gray-500"
                    }`}
                    data-testid="max-limited"
                  >
                    🔢 횟수 지정
                  </button>
                </div>
                {maxLimited && (
                  <div className="relative mt-2">
                    <input
                      type="number"
                      min={1}
                      placeholder="예) 5"
                      value={maxCount}
                      onChange={e => setMaxCount(e.target.value)}
                      className="w-full px-4 py-3 rounded-[14px] border border-gray-200 text-sm font-medium focus:outline-none focus:border-primary pr-10"
                      data-testid="input-max-count"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">회</span>
                  </div>
                )}
                <p className="text-[11px] text-gray-400 mt-1">정한 횟수만큼 수행하면 더 이상 할 수 없어요. (하루 1번씩)</p>
              </div>
            )}

            <div>
              <p className="text-sm font-bold text-gray-600 mb-1.5 flex items-center gap-1">
                <Clock className="w-4 h-4" /> 마감 시간 (선택)
              </p>
              <input
                type="time"
                value={timeLimit}
                onChange={e => setTimeLimit(e.target.value)}
                className="w-full px-4 py-3 rounded-[14px] border border-gray-200 text-sm font-medium focus:outline-none focus:border-primary"
                data-testid="input-time"
              />
              <p className="text-[11px] text-gray-400 mt-1">이 시간이 지나면 아이가 완료 요청을 보낼 수 없어요.</p>
            </div>

            <button
              onClick={() => setRequiresPhoto(v => !v)}
              className="w-full flex items-center justify-between bg-white rounded-[14px] px-4 py-3 border border-gray-200"
              data-testid="toggle-photo"
            >
              <span className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                <Camera className="w-4 h-4" /> 인증샷 필수
              </span>
              {requiresPhoto ? <ToggleRight className="w-7 h-7 text-primary" /> : <ToggleLeft className="w-7 h-7 text-gray-300" />}
            </button>
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full h-[52px] rounded-[16px] font-bold text-base bg-primary hover:bg-primary/90 text-white"
          data-testid="btn-submit-mission"
        >
          {saving ? "저장 중..." : "미션 추가하기 🚀"}
        </Button>
      </motion.div>
    </div>
  );
}

function PendingCard({ log, onApprove, onReject }: { log: PendingLog; onApprove: () => void; onReject: () => void }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const approve = async () => {
    setLoading(true);
    try {
      await onApprove();
    } catch (err: any) {
      toast({ title: err?.message ?? "승인에 실패했어요.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
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

      {log.photoUrl && (
        <img
          src={apiUrl(`/storage${log.photoUrl}`)}
          alt="인증샷"
          className="w-full max-h-56 object-cover rounded-[14px] border border-gray-100 mb-3"
          data-testid={`pending-photo-${log.id}`}
        />
      )}

      <p className="text-xs text-gray-400 mb-3">
        <Clock className="w-3 h-3 inline mr-1" />
        {new Date(log.requestedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" })}
      </p>
      <div className="flex gap-2">
        <button
          onClick={reject}
          disabled={loading}
          className="flex-1 py-2.5 rounded-[12px] border-2 border-red-100 text-red-500 font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-red-50 transition-colors"
          data-testid={`btn-reject-${log.id}`}
        >
          <XCircle className="w-4 h-4" /> 반려
        </button>
        <button
          onClick={approve}
          disabled={loading}
          className="flex-1 py-2.5 rounded-[12px] bg-green-500 text-white font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-green-600 transition-colors"
          data-testid={`btn-approve-${log.id}`}
        >
          <CheckCircle className="w-4 h-4" /> 승인 (+{log.mission.reward.toLocaleString("ko-KR")}P)
        </button>
      </div>
    </div>
  );
}

function MissionMeta({ m }: { m: Mission }) {
  if (m.type !== "activity") return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-50 rounded-full px-2 py-0.5">
        <CalendarDays className="w-2.5 h-2.5" /> {m.scheduleType === "once" ? (m.scheduledDate ?? "지정일") : "매일"}
      </span>
      {m.timeLimit && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500 bg-rose-50 rounded-full px-2 py-0.5">
          <Clock className="w-2.5 h-2.5" /> {m.timeLimit}까지
        </span>
      )}
      {m.maxCompletions != null && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-600 bg-violet-50 rounded-full px-2 py-0.5">
          <RefreshCw className="w-2.5 h-2.5" /> {m.maxCompletions}회까지
        </span>
      )}
      {m.requiresPhoto && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 rounded-full px-2 py-0.5">
          <Camera className="w-2.5 h-2.5" /> 인증샷
        </span>
      )}
    </div>
  );
}

function MissionTargetBadge({ m, kids }: { m: Mission; kids: ChildData[] }) {
  const cls = "inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold text-violet-600 bg-violet-50 rounded-full px-2 py-0.5";
  if (m.assignToAll) {
    return <span className={cls}><Users className="w-2.5 h-2.5" /> 전체 아이</span>;
  }
  const names = m.assignedChildIds.map(id => kids.find(k => k.id === id)?.name).filter(Boolean) as string[];
  const label = names.length > 0 ? names.join(", ") : `아이 ${m.assignedChildIds.length}명`;
  return <span className={cls}><Users className="w-2.5 h-2.5" /> {label}</span>;
}

export default function ParentMissionsPage() {
  const [_, setLocation] = useLocation();
  const { missions, children, pendingLogs, missionLogs, updateMission, deleteMission, approveMissionLog, rejectMissionLog } = useAppContext();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [tab, setTab] = useState<"missions" | "pending" | "history">("missions");
  const [selectedLog, setSelectedLog] = useState<MissionLog | null>(null);

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
            data-testid="btn-open-create"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-full">
          <button
            onClick={() => setTab("missions")}
            className={`flex-1 py-2 text-xs font-bold rounded-full transition-all ${tab === "missions" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
          >
            📋 미션
          </button>
          <button
            onClick={() => setTab("pending")}
            className={`flex-1 py-2 text-xs font-bold rounded-full transition-all relative ${tab === "pending" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
          >
            🔔 확인 요청
            {pendingLogs.length > 0 && (
              <span className="absolute top-0.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                {pendingLogs.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("history")}
            className={`flex-1 py-2 text-xs font-bold rounded-full transition-all ${tab === "history" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
          >
            🗒️ 내역
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
                  <p className="text-sm text-gray-400 mt-1">아이가 완료하면 용돈이 지급돼요</p>
                </div>
              </button>
            ) : (
              missions.map(m => {
                const info = TYPE_LABELS[m.type];
                return (
                  <div key={m.id} className={`bg-white rounded-[20px] p-4 border shadow-sm ${m.isActive ? "border-gray-100" : "border-gray-100 opacity-60"}`} data-testid={`mission-row-${m.id}`}>
                    <div className="flex items-start gap-3">
                      <div className={`px-2.5 py-1 rounded-full text-xs font-bold border ${info.color} shrink-0`}>
                        {info.emoji} {info.label}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900">{m.title}</p>
                        {m.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{m.description}</p>}
                        <p className="text-sm font-black text-primary-foreground mt-1">+{m.reward.toLocaleString("ko-KR")}P</p>
                        <MissionMeta m={m} />
                        <MissionTargetBadge m={m} kids={children} />
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

        {tab === "history" && (
          <MissionLogList logs={missionLogs} showChild onSelect={setSelectedLog} />
        )}
      </div>

      <AnimatePresence>
        {createOpen && <MissionCreateModal onClose={() => setCreateOpen(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {selectedLog && (
          <MissionLogDetailModal log={selectedLog} open={!!selectedLog} onClose={() => setSelectedLog(null)} showChild />
        )}
      </AnimatePresence>
    </div>
  );
}
