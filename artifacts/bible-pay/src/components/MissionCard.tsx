import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useAppContext, type Mission } from "@/context/AppContext";
import { useToast } from "@/hooks/use-toast";

interface MissionCardProps {
  mission: Mission;
  childId?: number;
}

const TYPE_INFO: Record<Mission["type"], { emoji: string; label: string; color: string; btnColor: string }> = {
  bible:   { emoji: "📖", label: "성경읽기", color: "bg-blue-50 text-blue-700 border-blue-200",   btnColor: "bg-blue-500 hover:bg-blue-600 text-white" },
  auto:    { emoji: "✅", label: "자율형",   color: "bg-green-50 text-green-700 border-green-200", btnColor: "bg-green-500 hover:bg-green-600 text-white" },
  confirm: { emoji: "🔍", label: "확인형",   color: "bg-orange-50 text-orange-700 border-orange-200", btnColor: "bg-orange-500 hover:bg-orange-600 text-white" },
};

export function MissionCard({ mission, childId }: MissionCardProps) {
  const [_, setLocation] = useLocation();
  const { submitMission } = useAppContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const info = TYPE_INFO[mission.type];

  const handleAction = async () => {
    if (!childId) return;

    if (mission.type === "bible") {
      setLocation(`/child/bible/${mission.id}`);
      return;
    }

    setLoading(true);
    try {
      await submitMission(mission.id);
      setDone(true);
      if (mission.type === "auto") {
        toast({ title: `🎉 완료! +${mission.reward.toLocaleString("ko-KR")}P 지급됐어요!` });
      } else {
        toast({ title: "📨 완료 요청을 보냈어요!", description: "부모님이 확인하면 용돈이 지급돼요." });
      }
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
          +{mission.reward.toLocaleString("ko-KR")}P
        </div>
      </div>

      {mission.description && (
        <div className="bg-gray-50 rounded-xl p-3 mb-3">
          <p className="text-sm text-gray-600">{mission.description}</p>
        </div>
      )}

      {mission.type === "bible" && !done && (
        <p className="text-xs text-gray-500 mb-3 bg-blue-50 rounded-xl px-3 py-2">
          📚 성경 책과 장을 선택하면 AI가 퀴즈 2문제를 내요. 전부 맞히면 용돈 지급!
        </p>
      )}
      {mission.type === "confirm" && !done && (
        <p className="text-xs text-gray-500 mb-3 bg-orange-50 rounded-xl px-3 py-2">
          ✋ 완료 요청 후 부모님이 확인하면 용돈이 지급돼요.
        </p>
      )}

      {childId && (
        done ? (
          <div className={`w-full py-3 rounded-[14px] text-center font-bold text-sm ${
            mission.type === "confirm" ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600"
          }`}>
            {mission.type === "confirm" ? "⏳ 부모님 확인 중..." : "✅ 완료됐어요!"}
          </div>
        ) : (
          <button
            onClick={handleAction}
            disabled={loading}
            className={`w-full h-[48px] rounded-[14px] font-bold text-sm flex items-center justify-center gap-2 transition-colors ${info.btnColor}`}
            data-testid={`mission-action-btn-${mission.id}`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mission.type === "bible" ? "📖 성경책 선택하기" : "✅ 완료했어요!"}
          </button>
        )
      )}
    </div>
  );
}
