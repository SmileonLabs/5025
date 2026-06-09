import { useState } from "react";
import { useLocation } from "wouter";
import { useAppContext, type Mission } from "@/context/AppContext";
import { BottomNav } from "@/components/BottomNav";
import { BibleIllustration } from "@/components/BibleIllustration";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

const TYPE_INFO: Record<Mission["type"], { emoji: string; label: string; color: string }> = {
  bible:   { emoji: "📖", label: "성경읽기", color: "bg-blue-50 text-blue-700 border-blue-200" },
  auto:    { emoji: "✅", label: "자율형",   color: "bg-green-50 text-green-700 border-green-200" },
  confirm: { emoji: "🔍", label: "확인형",   color: "bg-orange-50 text-orange-700 border-orange-200" },
};

function MissionCard({ mission }: { mission: Mission }) {
  const [_, setLocation] = useLocation();
  const { currentChild, submitMission } = useAppContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const info = TYPE_INFO[mission.type];

  const handleAction = async () => {
    if (!currentChild) return;

    if (mission.type === "bible") {
      setLocation(`/child/bible/${mission.id}`);
      return;
    }

    setLoading(true);
    try {
      if (mission.type === "auto") {
        const result = await submitMission(mission.id);
        setDone(true);
        toast({ title: `🎉 완료! +${mission.reward.toLocaleString("ko-KR")}원 지급됐어요!` });
      } else if (mission.type === "confirm") {
        await submitMission(mission.id);
        setDone(true);
        toast({ title: "📨 완료 요청을 보냈어요!", description: "부모님이 확인하면 용돈이 지급돼요." });
      }
    } catch (err: any) {
      toast({ title: err?.message ?? "오류가 발생했어요.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-[20px] p-4 shadow-sm border transition-all ${done ? "border-gray-100 opacity-70" : "border-gray-100"}`}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className={`px-2.5 py-1 rounded-full text-xs font-bold border ${info.color}`}>
          {info.emoji} {info.label}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900">{mission.title}</p>
          {mission.description && <p className="text-xs text-gray-500 mt-0.5">{mission.description}</p>}
        </div>
        <div className="bg-yellow-50 text-yellow-700 px-2.5 py-1 rounded-full text-sm font-black border border-yellow-200 shrink-0">
          +{mission.reward.toLocaleString("ko-KR")}원
        </div>
      </div>

      {mission.type === "bible" && (
        <p className="text-xs text-gray-400 mb-3 bg-blue-50 rounded-xl px-3 py-2">
          📚 성경책과 장을 선택하면 AI가 퀴즈를 낼게요. 2문제 모두 맞추면 용돈이 쏙!
        </p>
      )}
      {mission.type === "confirm" && !done && (
        <p className="text-xs text-gray-400 mb-3 bg-orange-50 rounded-xl px-3 py-2">
          ✋ 완료 후 부모님이 확인해야 용돈이 지급돼요.
        </p>
      )}

      {done ? (
        <div className={`w-full py-3 rounded-[14px] text-center font-bold text-sm ${
          mission.type === "confirm" ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600"
        }`}>
          {mission.type === "confirm" ? "⏳ 부모님 확인 중..." : "✅ 완료됐어요!"}
        </div>
      ) : (
        <button
          onClick={handleAction}
          disabled={loading}
          className={`w-full py-3 rounded-[14px] font-bold text-sm transition-all flex items-center justify-center gap-2 ${
            mission.type === "bible"
              ? "bg-blue-500 hover:bg-blue-600 text-white"
              : mission.type === "auto"
              ? "bg-green-500 hover:bg-green-600 text-white"
              : "bg-orange-500 hover:bg-orange-600 text-white"
          }`}
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {mission.type === "bible" ? "📖 성경책 선택하기" : "✅ 완료했어요!"}
        </button>
      )}
    </motion.div>
  );
}

export default function MissionsPage() {
  const [_, setLocation] = useLocation();
  const { currentChild, missions } = useAppContext();

  if (!currentChild) { setLocation("/login"); return null; }

  const activeMissions = missions.filter(m => m.isActive);

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-24">
      <div className="bg-white px-6 pt-12 pb-4 sticky top-0 z-40 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
        <h1 className="text-xl font-bold text-gray-900 text-center">미션 목록</h1>
        <p className="text-sm text-gray-400 text-center mt-1">미션을 완료하고 용돈을 받아요! 💰</p>
      </div>

      <div className="px-6 pt-6 space-y-4">
        <BibleIllustration />

        {activeMissions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-[24px] border border-gray-100 shadow-sm">
            <div className="text-5xl mb-3">📋</div>
            <p className="font-bold text-gray-700">아직 미션이 없어요</p>
            <p className="text-sm text-gray-400 mt-1">부모님이 미션을 만들어 주실 거예요!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeMissions.map(mission => (
              <MissionCard key={mission.id} mission={mission} />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
