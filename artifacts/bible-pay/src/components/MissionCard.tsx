import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Camera, Clock, CalendarDays, RefreshCw, X } from "lucide-react";
import { useAppContext, type Mission } from "@/context/AppContext";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface MissionCardProps {
  mission: Mission;
  childId?: number;
}

const TYPE_INFO: Record<Mission["type"], { emoji: string; label: string; color: string; btnColor: string }> = {
  bible:    { emoji: "📖", label: "성경읽기", color: "bg-blue-50 text-blue-700 border-blue-200",     btnColor: "bg-blue-500 hover:bg-blue-600 text-white" },
  activity: { emoji: "🔍", label: "활동미션", color: "bg-orange-50 text-orange-700 border-orange-200", btnColor: "bg-orange-500 hover:bg-orange-600 text-white" },
  book:     { emoji: "📚", label: "일반도서", color: "bg-violet-50 text-violet-700 border-violet-200", btnColor: "bg-violet-500 hover:bg-violet-600 text-white" },
};

function scheduleLabel(m: Mission): string {
  if (m.scheduleType === "once") return m.scheduledDate ? `${m.scheduledDate} 하루` : "지정일";
  if (m.scheduleType === "weekly") {
    const labels = ["일", "월", "화", "수", "목", "금", "토"];
    return `매주 ${(m.weeklyDays ?? []).map(day => labels[day]).filter(Boolean).join("·")}`;
  }
  return "매일";
}

/** Request a presigned PUT URL, upload the file directly to storage, and return
 * the stored object path ("/objects/...") to send with the mission submission. */
async function uploadPhoto(file: File): Promise<string> {
  const { uploadURL, objectPath } = await api.post<{ uploadURL: string; objectPath: string }>(
    "/storage/uploads/request-url",
    { contentType: file.type, size: file.size },
  );
  const putRes = await fetch(uploadURL, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!putRes.ok) throw new Error("사진 업로드에 실패했어요. 다시 시도해주세요.");
  return objectPath;
}

export function MissionCard({ mission, childId }: MissionCardProps) {
  const [_, setLocation] = useLocation();
  const { submitMission, missionLogs } = useAppContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const info = TYPE_INFO[mission.type];
  const isActivity = mission.type === "activity";

  // 수행 횟수 제한(활동미션): 이 아이의 누적 수행(승인+대기) 횟수. rejected는 제외(재도전 가능).
  const usedCount =
    mission.maxCompletions != null
      ? missionLogs.filter(
          l => l.missionId === mission.id && (l.status === "approved" || l.status === "requested"),
        ).length
      : 0;
  const limitReached = mission.maxCompletions != null && usedCount >= mission.maxCompletions;

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const clearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleAction = async () => {
    if (!childId) return;

    if (mission.type === "bible") {
      setLocation(`/child/bible/${mission.id}`);
      return;
    }
    if (mission.type === "book") {
      setLocation(`/child/book/${mission.id}`);
      return;
    }

    // activity
    if (mission.requiresPhoto && !file) {
      toast({ title: "인증샷을 먼저 골라주세요 📸", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const photoUrl = file ? await uploadPhoto(file) : undefined;
      await submitMission(mission.id, { photoUrl });
      setDone(true);
      toast({ title: "📨 완료 요청을 보냈어요!", description: "부모님이 확인하면 용돈이 지급돼요." });
    } catch (err: any) {
      toast({ title: err?.message ?? "오류가 발생했어요.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100 relative overflow-hidden"
      data-testid={`mission-card-${mission.id}`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{info.emoji}</span>
          <div>
            <h3 className="font-bold text-gray-900">{mission.title}</h3>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${info.color}`}>{info.label}</span>
          </div>
        </div>
        <div className="bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full text-sm font-bold border border-yellow-200 shrink-0">
          {mission.type === "activity" ? `+${mission.reward.toLocaleString("ko-KR")}P` : `${mission.minRewardPoints ?? 500}~${mission.maxRewardPoints ?? 2000}P`}
        </div>
      </div>

      {mission.description && (
        <div className="bg-gray-50 rounded-xl p-3 mb-3">
          <p className="text-sm text-gray-600">{mission.description}</p>
        </div>
      )}

      {(
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 bg-gray-50 rounded-full px-2.5 py-1">
            <CalendarDays className="w-3 h-3" /> {scheduleLabel(mission)}
          </span>
          {mission.timeLimit && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500 bg-rose-50 rounded-full px-2.5 py-1">
              <Clock className="w-3 h-3" /> {mission.timeLimit}까지
            </span>
          )}
          {mission.requiresPhoto && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 bg-orange-50 rounded-full px-2.5 py-1">
              <Camera className="w-3 h-3" /> 인증샷 필요
            </span>
          )}
          {mission.maxCompletions != null && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-600 bg-violet-50 rounded-full px-2.5 py-1">
              <RefreshCw className="w-3 h-3" /> {usedCount}/{mission.maxCompletions}회
            </span>
          )}
        </div>
      )}

      {mission.type === "bible" && !done && (
        <p className="text-xs text-gray-500 mb-3 bg-blue-50 rounded-xl px-3 py-2">
          📖 읽은 장을 고른 뒤 AI와 궁금한 점을 대화해요. 질문의 깊이에 따라 500~2,000P를 받아요.
        </p>
      )}
      {mission.type === "book" && !done && (
        <p className="text-xs text-gray-500 mb-3 bg-violet-50 rounded-xl px-3 py-2">📚 읽은 목차를 고르고 AI와 궁금한 점을 대화해요. 관련 없는 질문은 완료되지 않아요.</p>
      )}

      {/* 인증샷 선택 / 미리보기 (activity & 제출 전) */}
      {isActivity && !done && !limitReached && childId && (
        <div className="mb-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={pickFile}
            className="hidden"
            data-testid={`mission-photo-input-${mission.id}`}
          />
          {previewUrl ? (
            <div className="relative">
              <img src={previewUrl} alt="인증샷 미리보기" className="w-full max-h-52 object-cover rounded-[14px] border border-gray-100" />
              <div className="absolute top-2 right-2 flex gap-1.5">
                <button
                  onClick={() => inputRef.current?.click()}
                  className="w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm"
                  data-testid={`mission-photo-retake-${mission.id}`}
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={clearFile}
                  className="w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm"
                  data-testid={`mission-photo-clear-${mission.id}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full py-3 rounded-[14px] border-2 border-dashed border-gray-200 text-gray-500 font-bold text-sm flex items-center justify-center gap-2 hover:border-orange-300 hover:text-orange-500 transition-colors"
              data-testid={`mission-photo-pick-${mission.id}`}
            >
              <Camera className="w-4 h-4" /> {mission.requiresPhoto ? "인증샷 찍기 / 올리기" : "인증샷 추가 (선택)"}
            </button>
          )}
        </div>
      )}

      {childId && (
        done ? (
          <div className="w-full py-3 rounded-[14px] text-center font-bold text-sm bg-orange-50 text-orange-600">
            {isActivity ? "⏳ 부모님 확인 중..." : "✅ 완료됐어요!"}
          </div>
        ) : limitReached ? (
          <div className="w-full py-3 rounded-[14px] text-center font-bold text-sm bg-violet-50 text-violet-600">
            🎉 정해진 횟수를 모두 채웠어요! ({mission.maxCompletions}회)
          </div>
        ) : (
          <button
            onClick={handleAction}
            disabled={loading}
            className={`w-full h-[48px] rounded-[14px] font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${info.btnColor}`}
            data-testid={`mission-action-btn-${mission.id}`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mission.type === "bible" ? "📖 읽은 성경 장 선택하기" : mission.type === "book" ? "📚 읽은 목차 선택하기" : "✅ 완료했어요!"}
          </button>
        )
      )}
    </div>
  );
}
