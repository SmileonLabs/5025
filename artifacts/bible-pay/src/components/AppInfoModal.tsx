import { motion, AnimatePresence } from "framer-motion";
import { X, BookOpen, Brain, PenLine, Coins } from "lucide-react";

interface AppInfoModalProps {
  open: boolean;
  onClose: () => void;
}

const STEPS = [
  { icon: BookOpen, bg: "bg-green-50", color: "text-green-600", text: "성경을 읽어요" },
  { icon: Brain, bg: "bg-blue-50", color: "text-blue-500", text: "AI 퀴즈를 풀어요" },
  { icon: PenLine, bg: "bg-amber-50", color: "text-amber-500", text: "묵상을 적어요" },
  { icon: Coins, bg: "bg-primary/10", color: "text-primary", text: "용돈을 받아요" },
];

export function AppInfoModal({ open, onClose }: AppInfoModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[28px] shadow-2xl"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="px-6 pb-10">
              <div className="flex items-center justify-between py-4">
                <h2 className="text-xl font-black text-gray-900">앱 정보</h2>
                <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full" data-testid="btn-close-appinfo">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col items-center text-center mb-6">
                <img
                  src={`${import.meta.env.BASE_URL}logo.png`}
                  alt="5025"
                  className="w-28 h-28 object-contain mb-3"
                />
                <p className="text-2xl font-black text-gray-900">5025</p>
                <p className="text-sm text-gray-400 font-medium mt-1">버전 1.0.0</p>
                <p className="text-sm text-gray-500 mt-3 leading-relaxed">
                  성경을 읽고 퀴즈를 풀면서<br />용돈도 벌고 말씀도 배우는 앱이에요.
                </p>
              </div>

              <div className="bg-gray-50 rounded-[20px] p-5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">이렇게 용돈을 벌어요</p>
                <div className="space-y-3">
                  {STEPS.map((s, i) => {
                    const Icon = s.icon;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${s.bg} ${s.color}`}>
                          <Icon className="w-4.5 h-4.5" />
                        </div>
                        <span className="font-bold text-gray-700 text-sm">{i + 1}. {s.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="text-xs text-gray-400 text-center mt-5">© 2026 5025</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
