import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Loader2, Delete } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface PublicChild {
  id: number;
  name: string;
  avatar: string;
}

type Step = "email" | "select" | "pin";

export default function ChildSelectPage() {
  const [_, setLocation] = useLocation();
  const { childLogin } = useAppContext();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [familyChildren, setFamilyChildren] = useState<PublicChild[]>([]);
  const [selectedChild, setSelectedChild] = useState<PublicChild | null>(null);
  const [pin, setPin] = useState("");
  const [pinLoading, setPinLoading] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setEmailLoading(true);
    try {
      const kids = await api.get<PublicChild[]>(`/children/public?parentEmail=${encodeURIComponent(email.trim())}`);
      if (kids.length === 0) {
        toast({ title: "등록된 아이 계정이 없어요.", description: "부모님께 아이 계정을 만들어 달라고 부탁하세요!" });
        return;
      }
      setFamilyChildren(kids);
      setStep("select");
    } catch (err: any) {
      toast({ title: err.message ?? "부모 계정을 찾을 수 없어요.", variant: "destructive" });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleChildSelect = (child: PublicChild) => {
    setSelectedChild(child);
    setPin("");
    setStep("pin");
  };

  const handlePinDigit = (digit: string) => {
    if (pin.length < 4) setPin(p => p + digit);
  };

  const handlePinDelete = () => {
    setPin(p => p.slice(0, -1));
  };

  const handlePinSubmit = async () => {
    if (!selectedChild || pin.length !== 4) return;
    setPinLoading(true);
    try {
      await childLogin(selectedChild.id, pin);
      setLocation("/child/home");
    } catch (err: any) {
      toast({ title: err.message ?? "PIN이 틀렸어요!", variant: "destructive" });
      setPin("");
    } finally {
      setPinLoading(false);
    }
  };

  // Auto-submit when 4 digits entered
  const prevPin = pin;
  if (prevPin.length === 4 && !pinLoading) {
    // handled by useEffect pattern below - we call submit on render instead
  }

  const PIN_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      {/* Header */}
      <div className="px-4 py-4 flex items-center border-b border-gray-50">
        <button
          onClick={() => step === "email" ? setLocation("/") : step === "select" ? setStep("email") : setStep("select")}
          className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="flex-1 text-center text-lg font-bold text-gray-900 pr-10">아이로 로그인</h1>
      </div>

      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">

          {/* STEP 1: Enter parent email */}
          {step === "email" && (
            <motion.form
              key="email"
              onSubmit={handleEmailSubmit}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-6 px-6 pt-10 flex-1"
            >
              <div className="text-center mb-4">
                <div className="text-6xl mb-4">👪</div>
                <h2 className="text-2xl font-black text-gray-900">우리 가족 찾기</h2>
                <p className="text-gray-500 mt-2">부모님의 이메일을 입력해서<br/>가족 계정을 찾아요</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-600">부모님 이메일</label>
                <input
                  type="email"
                  placeholder="parent@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full h-[54px] px-4 rounded-[16px] border border-gray-200 text-base font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  autoComplete="email"
                  data-testid="input-parent-email"
                />
              </div>

              <div className="mt-auto pb-8">
                <button
                  type="submit"
                  disabled={emailLoading || !email.trim()}
                  className="w-full h-[56px] rounded-[20px] text-base font-bold bg-primary hover:bg-primary/90 text-white shadow-md disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                  data-testid="btn-find-family"
                >
                  {emailLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "가족 찾기 🔍"}
                </button>
              </div>
            </motion.form>
          )}

          {/* STEP 2: Select child */}
          {step === "select" && (
            <motion.div
              key="select"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col gap-4 px-6 pt-8 flex-1"
            >
              <h2 className="text-xl font-black text-gray-900 text-center mb-2">누구인가요?</h2>
              <div className="flex flex-col gap-3">
                {familyChildren.map(child => (
                  <button
                    key={child.id}
                    onClick={() => handleChildSelect(child)}
                    className="w-full bg-white p-5 rounded-[24px] shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow hover-elevate"
                    data-testid={`btn-select-child-${child.id}`}
                  >
                    <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-4xl">
                      {child.avatar}
                    </div>
                    <h3 className="font-bold text-xl text-gray-900">{child.name}</h3>
                    <span className="ml-auto text-gray-300 text-xl">›</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* STEP 3: PIN Entry */}
          {step === "pin" && selectedChild && (
            <motion.div
              key="pin"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="flex flex-col items-center pt-8 px-6 flex-1"
            >
              <div className="text-6xl mb-3">{selectedChild.avatar}</div>
              <h2 className="text-2xl font-black text-gray-900 mb-1">{selectedChild.name}</h2>
              <p className="text-gray-500 mb-8">비밀번호 4자리를 입력해요</p>

              {/* PIN dots */}
              <div className="flex gap-4 mb-8">
                {[0, 1, 2, 3].map(i => (
                  <motion.div
                    key={i}
                    animate={{ scale: i === pin.length - 1 ? [1.3, 1] : 1 }}
                    transition={{ duration: 0.15 }}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${
                      i < pin.length ? "bg-primary border-primary" : "bg-gray-100 border-gray-300"
                    }`}
                  />
                ))}
              </div>

              {pinLoading ? (
                <div className="flex items-center gap-2 text-gray-500 mb-8">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="font-medium">확인 중...</span>
                </div>
              ) : null}

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
                {PIN_KEYS.map((key, i) => {
                  if (key === "") return <div key={i} />;
                  if (key === "del") {
                    return (
                      <button
                        key={i}
                        onClick={handlePinDelete}
                        className="h-16 rounded-[18px] bg-gray-100 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-200 transition-colors active:scale-95"
                        data-testid="btn-pin-delete"
                      >
                        <Delete className="w-5 h-5" />
                      </button>
                    );
                  }
                  return (
                    <motion.button
                      key={i}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        if (pin.length < 4) {
                          const newPin = pin + key;
                          setPin(newPin);
                          if (newPin.length === 4) {
                            setPinLoading(true);
                            childLogin(selectedChild.id, newPin)
                              .then(() => setLocation("/child/home"))
                              .catch((err: any) => {
                                toast({ title: err.message ?? "PIN이 틀렸어요!", variant: "destructive" });
                                setPin("");
                              })
                              .finally(() => setPinLoading(false));
                          }
                        }
                      }}
                      className="h-16 rounded-[18px] bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-2xl font-bold text-gray-800 transition-colors"
                      data-testid={`btn-pin-${key}`}
                      disabled={pinLoading}
                    >
                      {key}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
