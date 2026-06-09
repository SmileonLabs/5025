import { useLocation } from "wouter";
import { Mission } from "@/context/AppContext";

interface MissionCardProps {
  mission: Mission;
  childId?: number;
}

const TYPE_LABELS: Record<Mission["type"], { emoji: string; label: string }> = {
  bible:   { emoji: "📖", label: "성경읽기" },
  auto:    { emoji: "✅", label: "자율형" },
  confirm: { emoji: "🔍", label: "확인형" },
};

export function MissionCard({ mission, childId }: MissionCardProps) {
  const [_, setLocation] = useLocation();
  const info = TYPE_LABELS[mission.type];

  const handleStart = () => {
    if (!childId) return;
    if (mission.type === "bible") {
      setLocation(`/child/bible/${mission.id}`);
    } else {
      setLocation(`/child/missions`);
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
            <span className="text-xs text-gray-500">{info.label}</span>
          </div>
        </div>
        <div className="bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full text-sm font-bold border border-yellow-200">
          +{mission.reward.toLocaleString("ko-KR")}원
        </div>
      </div>

      {mission.description && (
        <div className="bg-gray-50 rounded-xl p-3 mb-3">
          <p className="text-sm text-gray-600">{mission.description}</p>
        </div>
      )}

      {childId && (
        <button
          onClick={handleStart}
          className="w-full h-[48px] rounded-[14px] font-bold text-sm bg-primary hover:bg-primary/90 text-white flex items-center justify-center gap-2 transition-colors"
          data-testid={`mission-start-btn-${mission.id}`}
        >
          {mission.type === "bible" ? "📖 성경책 선택하기" : "미션 하러 가기 →"}
        </button>
      )}
    </div>
  );
}
