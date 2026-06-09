import { useState } from "react";
import { useLocation } from "wouter";
import { useAppContext } from "@/context/AppContext";
import { BottomNav } from "@/components/BottomNav";
import { MissionCard } from "@/components/MissionCard";
import { BibleIllustration } from "@/components/BibleIllustration";

type FilterTab = "전체" | "미완료" | "완료";

export default function MissionsPage() {
  const [_, setLocation] = useLocation();
  const { selectedChildId, children, missions } = useAppContext();
  const [filter, setFilter] = useState<FilterTab>("전체");

  const child = children.find(c => c.id === selectedChildId);

  if (!child) {
    setLocation("/login");
    return null;
  }

  const filteredMissions = missions.filter(m => {
    if (filter === "완료") return m.completed;
    if (filter === "미완료") return !m.completed;
    return true;
  });

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-24">
      <div className="bg-white px-6 pt-12 pb-4 sticky top-0 z-40 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
        <h1 className="text-xl font-bold text-gray-900 text-center mb-6">미션 목록</h1>
        
        {/* Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-full relative">
          {(["전체", "미완료", "완료"] as FilterTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`flex-1 py-2 text-sm font-bold rounded-full transition-all relative z-10 ${
                filter === tab ? "text-gray-900 shadow-sm bg-white" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 pt-6 space-y-6">
        <BibleIllustration />

        <div className="space-y-4">
          {filteredMissions.length > 0 ? (
            filteredMissions.map(mission => (
              <MissionCard 
                key={mission.id} 
                mission={mission} 
                childId={child.id} 
                showActionButton={!mission.completed}
              />
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 font-medium">
                {filter === "완료" ? "아직 완료한 미션이 없어요." : "모든 미션을 완료했어요!"}
              </p>
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
