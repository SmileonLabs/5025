import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Tab = "login" | "signup";

export default function ParentAuthPage() {
  const [_, setLocation] = useLocation();
  const { login, signup } = useAppContext();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("login");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPw, setLoginPw] = useState("");

  // Signup form
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPw, setSignupPw] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPw.trim()) return;
    setLoading(true);
    try {
      await login(loginEmail.trim(), loginPw);
      setLocation("/parent/dashboard");
    } catch (err: any) {
      toast({ title: err.message ?? "로그인에 실패했어요.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupName.trim() || !signupEmail.trim() || signupPw.length < 6) return;
    setLoading(true);
    try {
      await signup(signupName.trim(), signupEmail.trim(), signupPw);
      setLocation("/parent/dashboard");
    } catch (err: any) {
      toast({ title: err.message ?? "회원가입에 실패했어요.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      {/* Header */}
      <div className="px-4 py-4 flex items-center border-b border-gray-50">
        <button onClick={() => setLocation("/")} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="flex-1 text-center text-lg font-bold text-gray-900 pr-10">부모 계정</h1>
      </div>

      <div className="flex-1 px-6 pt-6 flex flex-col">
        {/* Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-full mb-8">
          {(["login", "signup"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-bold rounded-full transition-all ${
                tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
              data-testid={`tab-${t}`}
            >
              {t === "login" ? "로그인" : "회원가입"}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === "login" ? (
            <motion.form
              key="login"
              onSubmit={handleLogin}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-4 flex-1"
            >
              <div className="space-y-1">
                <label className="text-sm font-bold text-gray-600">이메일</label>
                <Input
                  type="email"
                  placeholder="parent@example.com"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  className="h-[54px] rounded-[16px] border-gray-200 focus-visible:ring-primary"
                  autoComplete="email"
                  data-testid="input-login-email"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-gray-600">비밀번호</label>
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    placeholder="비밀번호 입력"
                    value={loginPw}
                    onChange={e => setLoginPw(e.target.value)}
                    className="h-[54px] rounded-[16px] border-gray-200 focus-visible:ring-primary pr-12"
                    autoComplete="current-password"
                    data-testid="input-login-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="mt-auto pb-8 pt-4">
                <Button
                  type="submit"
                  disabled={loading || !loginEmail.trim() || !loginPw.trim()}
                  className="w-full h-[56px] rounded-[20px] text-base font-bold bg-primary hover:bg-primary/90 text-white shadow-md"
                  data-testid="btn-submit-login"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "로그인 →"}
                </Button>
                <p className="text-center text-gray-400 text-sm mt-4">
                  계정이 없으신가요?{" "}
                  <button type="button" onClick={() => setTab("signup")} className="text-primary-foreground font-bold">
                    회원가입
                  </button>
                </p>
              </div>
            </motion.form>
          ) : (
            <motion.form
              key="signup"
              onSubmit={handleSignup}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col gap-4 flex-1"
            >
              <div className="space-y-1">
                <label className="text-sm font-bold text-gray-600">이름 (닉네임)</label>
                <Input
                  type="text"
                  placeholder="홍길동 부모님"
                  value={signupName}
                  onChange={e => setSignupName(e.target.value)}
                  className="h-[54px] rounded-[16px] border-gray-200 focus-visible:ring-primary"
                  data-testid="input-signup-name"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-gray-600">이메일</label>
                <Input
                  type="email"
                  placeholder="parent@example.com"
                  value={signupEmail}
                  onChange={e => setSignupEmail(e.target.value)}
                  className="h-[54px] rounded-[16px] border-gray-200 focus-visible:ring-primary"
                  autoComplete="email"
                  data-testid="input-signup-email"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-gray-600">비밀번호 (6자 이상)</label>
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    placeholder="비밀번호 설정"
                    value={signupPw}
                    onChange={e => setSignupPw(e.target.value)}
                    className="h-[54px] rounded-[16px] border-gray-200 focus-visible:ring-primary pr-12"
                    autoComplete="new-password"
                    data-testid="input-signup-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="mt-auto pb-8 pt-4">
                <Button
                  type="submit"
                  disabled={loading || !signupName.trim() || !signupEmail.trim() || signupPw.length < 6}
                  className="w-full h-[56px] rounded-[20px] text-base font-bold bg-primary hover:bg-primary/90 text-white shadow-md"
                  data-testid="btn-submit-signup"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "계정 만들기 🎉"}
                </Button>
                <p className="text-center text-gray-400 text-sm mt-4">
                  이미 계정이 있으신가요?{" "}
                  <button type="button" onClick={() => setTab("login")} className="text-primary-foreground font-bold">
                    로그인
                  </button>
                </p>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
