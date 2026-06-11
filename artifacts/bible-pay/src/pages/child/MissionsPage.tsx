import { useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence } from "framer-motion";
import { useAppContext, type MissionLog } from "@/context/AppContext";
import { BottomNav } from "@/components/BottomNav";
import { BibleIllustration } from "@/components/BibleIllustration";
import { MissionCard } from "@/components/MissionCard";
import { MissionLogList } from "@/components/MissionLogList";
import { MissionLogDetailModal } from "@/components/MissionLogDetailModal";

export default function MissionsPage() {
  const [_, setLocation] = useLocation();
  const { currentChild, missions, missionLogs } = useAppContext();
  const [tab, setTab] = useState<"todo" | "history">("todo");
  const [selectedLog, setSelectedLog] = useState<MissionLog | null>(null);

  if (!currentChild) { setLocation("/login"); return null; }

  const activeMissions = missions.filter(m => m.isActive);

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-24">
      <div className="bg-white px-6 pt-12 pb-4 sticky top-0 z-40 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
        <h1 className="text-xl font-bold text-gray-900 text-center">미션</h1>
        <p className="text-sm text-gray-400 text-center mt-1">미션을 완료하고 용돈을 받아요! 💰</p>

        <div className="flex bg-gray-100 p-1 rounded-full mt-4">
          <button
            onClick={() => setTab("todo")}
            className={`flex-1 py-2 text-sm font-bold rounded-full transition-all ${tab === "todo" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
            data-testid="tab-todo"
          >
            🎯 할 미션
          </button>
          <button
            onClick={() => setTab("history")}
            className={`flex-1 py-2 text-sm font-bold rounded-full transition-all ${tab === "history" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
            data-testid="tab-history"
          >
            🗒️ 수행 내역
          </button>
        </div>
      </div>

      <div className="px-6 pt-6 space-y-4">
        {tab === "todo" ? (
          <>
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
                  <MissionCard key={mission.id} mission={mission} childId={currentChild.id} />
                ))}
              </div>
            )}
          </>
        ) : (
          <MissionLogList logs={missionLogs} onSelect={setSelectedLog} />
        )}
      </div>

      <AnimatePresence>
        {selectedLog && (
          <MissionLogDetailModal log={selectedLog} open={!!selectedLog} onClose={() => setSelectedLog(null)} />
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
