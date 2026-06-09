import { Check, BookOpen, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Mission } from "@/context/AppContext";

interface MissionCardProps {
  mission: Mission;
  childId?: string;
  showActionButton?: boolean;
}

export function MissionCard({ mission, childId, showActionButton = true }: MissionCardProps) {
  const [_, setLocation] = useLocation();

  const handleStart = () => {
    if (!childId || mission.completed) return;
    setLocation(`/child/quiz/${mission.id}`);
  };

  return (
    <div
      className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100 relative overflow-hidden"
      data-testid={`mission-card-${mission.id}`}
    >
      {mission.completed && (
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-primary/10 rounded-full blur-xl" />
      )}

      <div className="flex justify-between items-start mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl ${mission.completed ? "bg-primary/20 text-primary-foreground" : "bg-gray-100 text-gray-500"}`}>
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">{mission.title}</h3>
            <p className="text-xs text-gray-500">{mission.dueDate}</p>
          </div>
        </div>
        <div className="bg-accent/20 text-accent-foreground px-3 py-1 rounded-full text-sm font-bold">
          +{mission.reward}원
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-3 mb-4 relative z-10">
        <p className="text-sm text-gray-700 italic">"{mission.verse}"</p>
      </div>

      {showActionButton && childId && (
        <div className="relative z-10">
          {mission.completed ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full h-[52px] bg-primary/10 text-primary-foreground rounded-[14px] flex items-center justify-center font-bold gap-2"
              data-testid={`mission-completed-${mission.id}`}
            >
              <Check className="w-5 h-5" /> 읽기 완료!
            </motion.div>
          ) : (
            <motion.button
              onClick={handleStart}
              whileTap={{ scale: 0.97 }}
              className="w-full h-[52px] rounded-[14px] font-bold text-base bg-primary hover:bg-primary/90 text-white flex items-center justify-center gap-2 transition-colors"
              data-testid={`mission-quiz-btn-${mission.id}`}
            >
              📖 성경 읽었어요!
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      )}
    </div>
  );
}
