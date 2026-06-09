import { useState } from "react";
import { Check, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Mission, useAppContext } from "@/context/AppContext";
import { Button } from "@/components/ui/button";

interface MissionCardProps {
  mission: Mission;
  childId?: string;
  showActionButton?: boolean;
}

export function MissionCard({ mission, childId, showActionButton = true }: MissionCardProps) {
  const { completeMission } = useAppContext();
  const [isCompleting, setIsCompleting] = useState(false);

  const handleComplete = () => {
    if (!childId) return;
    setIsCompleting(true);
    setTimeout(() => {
      completeMission(mission.id, childId);
      setIsCompleting(false);
    }, 1000);
  };

  return (
    <div className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100 relative overflow-hidden" data-testid={`mission-card-${mission.id}`}>
      {mission.completed && (
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-primary/10 rounded-full blur-xl" />
      )}
      
      <div className="flex justify-between items-start mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl ${mission.completed ? 'bg-primary/20 text-primary-foreground' : 'bg-gray-100 text-gray-500'}`}>
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
          <AnimatePresence mode="wait">
            {mission.completed ? (
              <motion.div
                key="completed"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full h-[52px] bg-primary/10 text-primary-foreground rounded-[14px] flex items-center justify-center font-bold gap-2"
                data-testid={`mission-completed-${mission.id}`}
              >
                <Check className="w-5 h-5" /> 읽기 완료!
              </motion.div>
            ) : (
              <motion.div key="incomplete">
                <Button 
                  onClick={handleComplete}
                  disabled={isCompleting}
                  className="w-full h-[52px] rounded-[14px] font-bold text-base bg-primary hover:bg-primary/90 text-primary-foreground relative overflow-hidden"
                  data-testid={`mission-complete-btn-${mission.id}`}
                >
                  {isCompleting ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.2, 1] }}
                      transition={{ duration: 0.5 }}
                      className="absolute inset-0 flex items-center justify-center bg-primary"
                    >
                      <Check className="w-8 h-8 text-white" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        {[...Array(6)].map((_, i) => (
                          <motion.div
                            key={i}
                            initial={{ scale: 0, x: 0, y: 0 }}
                            animate={{
                              scale: [0, 1, 0],
                              x: Math.cos(i * 60 * Math.PI / 180) * 50,
                              y: Math.sin(i * 60 * Math.PI / 180) * 50,
                            }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            className="absolute w-2 h-2 rounded-full bg-yellow-400"
                          />
                        ))}
                      </div>
                    </motion.div>
                  ) : "📖 읽기 완료"}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
