import { useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { User, Users } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import { BibleIllustration } from "@/components/BibleIllustration";

export default function LoginPage() {
  const [_, setLocation] = useLocation();
  const { role, loading } = useAppContext();

  useEffect(() => {
    if (!loading && role === "parent") setLocation("/parent/dashboard");
    if (!loading && role === "child") setLocation("/child/home");
  }, [role, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-accent/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

      <div className="w-full max-w-md relative z-10 flex flex-col gap-8">
        <div className="text-center">
          <motion.img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="5025"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="w-60 max-w-[80%] mx-auto mb-2"
          />
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="sr-only"
          >
            5025
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

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="mb-4">
          <BibleIllustration />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="flex flex-col gap-4">
          <button
            onClick={() => setLocation("/parent/auth")}
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
            onClick={() => setLocation("/child/select")}
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
      </div>
    </div>
  );
}
