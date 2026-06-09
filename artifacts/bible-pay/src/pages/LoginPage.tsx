import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { User, Users } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import { BibleIllustration } from "@/components/BibleIllustration";

export default function LoginPage() {
  const [_, setLocation] = useLocation();
  const { setRole, children, setSelectedChildId } = useAppContext();
  const [showChildSelect, setShowChildSelect] = useState(false);

  const handleParentSelect = () => {
    setRole("parent");
    setLocation("/parent/dashboard");
  };

  const handleChildSelectClick = () => {
    setShowChildSelect(true);
  };

  const handleChildSelect = (childId: string) => {
    setRole("child");
    setSelectedChildId(childId);
    setLocation("/child/home");
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-accent/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

      <div className="w-full max-w-md relative z-10 flex flex-col gap-8">
        <div className="text-center">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white shadow-md mb-6"
          >
            <span className="text-5xl">🎁</span>
          </motion.div>
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-4xl font-black text-gray-900 tracking-tight"
          >
            성경 용돈
          </motion.h1>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-gray-500 mt-2 font-medium"
          >
            말씀으로 자라나는 우리 아이 지갑
          </motion.p>
        </div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-4"
        >
          <BibleIllustration />
        </motion.div>

        <AnimatePresence mode="wait">
          {!showChildSelect ? (
            <motion.div 
              key="role-select"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-4"
            >
              <button 
                onClick={handleParentSelect}
                className="w-full bg-white p-6 rounded-[24px] shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow hover-elevate"
                data-testid="btn-login-parent"
              >
                <div className="w-14 h-14 rounded-full bg-primary/20 text-primary-foreground flex items-center justify-center">
                  <User className="w-7 h-7" />
                </div>
                <div className="text-left">
                  <h2 className="font-bold text-xl text-gray-900">부모로 로그인</h2>
                  <p className="text-sm text-gray-500">아이들 용돈을 관리해요</p>
                </div>
              </button>

              <button 
                onClick={handleChildSelectClick}
                className="w-full bg-white p-6 rounded-[24px] shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow hover-elevate"
                data-testid="btn-login-child-flow"
              >
                <div className="w-14 h-14 rounded-full bg-secondary/30 text-secondary-foreground flex items-center justify-center">
                  <Users className="w-7 h-7" />
                </div>
                <div className="text-left">
                  <h2 className="font-bold text-xl text-gray-900">아이로 로그인</h2>
                  <p className="text-sm text-gray-500">내 용돈을 확인해요</p>
                </div>
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="child-select"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-col gap-4"
            >
              <h3 className="text-center font-bold text-lg text-gray-700 mb-2">누구인가요?</h3>
              {children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => handleChildSelect(child.id)}
                  className="w-full bg-white p-6 rounded-[24px] shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow"
                  data-testid={`btn-login-child-${child.id}`}
                >
                  <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center text-3xl">
                    {child.avatar}
                  </div>
                  <div className="text-left">
                    <h2 className="font-bold text-xl text-gray-900">{child.name}</h2>
                    <p className="text-sm text-gray-500">{child.age}세</p>
                  </div>
                </button>
              ))}
              <button 
                onClick={() => setShowChildSelect(false)}
                className="mt-4 text-gray-400 font-medium p-2 text-sm"
              >
                뒤로가기
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
