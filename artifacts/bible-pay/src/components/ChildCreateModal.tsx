import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, ChevronRight } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface ChildCreateModalProps {
  open: boolean;
  onClose: () => void;
}

const AVATARS = ["🌸", "⭐", "🦊", "🐧", "🦄", "🐻", "🌈", "🦁", "🐰", "🌟", "🐸", "🦋"];

type Step = "info" | "pin" | "done";

export function ChildCreateModal({ open, onClose }: ChildCreateModalProps) {
  const { createChild } = useAppContext();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("info");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [avatar, setAvatar] = useState("🌸");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    setStep("info");
    setName("");
    setAge("");
    setAvatar("🌸");
    setPin("");
    setPinConfirm("");
    onClose();
  };

  const handleInfoNext = () => {
    if (!name.trim() || !age.trim()) {
      toast({ title: "이름과 나이를 입력해주세요.", variant: "destructive" });
      return;
    }
    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 1 || ageNum > 18) {
      toast({ title: "나이는 1~18 사이로 입력해주세요.", variant: "destructive" });
      return;
    }
    setStep("pin");
  };

  const handleSubmit = async () => {
    if (pin.length !== 4) {
      toast({ title: "PIN 4자리를 입력해주세요.", variant: "destructive" });
      return;
    }
    if (pin !== pinConfirm) {
      toast({ title: "PIN이 일치하지 않아요!", variant: "destructive" });
      setPinConfirm("");
      return;
    }
    setLoading(true);
    try {
      await createChild(name.trim(), parseInt(age, 10), avatar, pin);
      setStep("done");
    } catch (err: any) {
      toast({ title: err.message ?? "계정 생성에 실패했어요.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[28px] shadow-2xl max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            <div className="px-6 pb-8">
              <div className="flex items-center justify-between py-4 mb-2">
                <AnimatePresence mode="wait">
                  {step === "info" && (
                    <motion.h2 key="h-info" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="text-xl font-black text-gray-900">👶 아이 계정 만들기</motion.h2>
                  )}
                  {step === "pin" && (
                    <motion.div key="h-pin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <h2 className="text-xl font-black text-gray-900">🔐 비밀번호 설정</h2>
                      <p className="text-sm text-gray-500">아이가 로그인할 때 쓸 4자리 숫자예요</p>
                    </motion.div>
                  )}
                  {step === "done" && (
                    <motion.h2 key="h-done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="text-xl font-black text-gray-900">🎉 계정이 만들어졌어요!</motion.h2>
                  )}
                </AnimatePresence>
                <button onClick={handleClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <AnimatePresence mode="wait">
                {/* STEP 1: Child info */}
                {step === "info" && (
                  <motion.div key="info" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col gap-5">
                    {/* Avatar picker */}
                    <div>
                      <p className="text-sm font-bold text-gray-600 mb-2">아이 아바타 선택</p>
                      <div className="grid grid-cols-6 gap-2">
                        {AVATARS.map(a => (
                          <button
                            key={a}
                            onClick={() => setAvatar(a)}
                            className={`h-12 rounded-[12px] text-2xl flex items-center justify-center transition-all ${
                              avatar === a ? "bg-primary/10 border-2 border-primary shadow-sm" : "bg-gray-50 border-2 border-transparent hover:bg-gray-100"
                            }`}
                            data-testid={`avatar-${a}`}
                          >
                            {a}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-bold text-gray-600">아이 이름</label>
                      <Input
                        type="text"
                        placeholder="예: 김하은"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="h-[52px] rounded-[14px] border-gray-200"
                        data-testid="input-child-name"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-bold text-gray-600">나이</label>
                      <Input
                        type="number"
                        placeholder="예: 9"
                        value={age}
                        onChange={e => setAge(e.target.value)}
                        min={1}
                        max={18}
                        className="h-[52px] rounded-[14px] border-gray-200"
                        data-testid="input-child-age"
                      />
                    </div>

                    <Button
                      onClick={handleInfoNext}
                      disabled={!name.trim() || !age.trim()}
                      className="w-full h-[54px] rounded-[16px] font-bold text-base mt-2"
                      data-testid="btn-child-info-next"
                    >
                      다음 <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </motion.div>
                )}

                {/* STEP 2: PIN setup */}
                {step === "pin" && (
                  <motion.div key="pin" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col gap-4">
                    {/* Preview */}
                    <div className="bg-gray-50 rounded-[20px] p-4 flex items-center gap-3">
                      <span className="text-3xl">{avatar}</span>
                      <div>
                        <p className="font-bold text-gray-900">{name}</p>
                        <p className="text-sm text-gray-500">{age}세</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-bold text-gray-600">PIN 번호 (4자리)</label>
                      <Input
                        type="password"
                        inputMode="numeric"
                        placeholder="• • • •"
                        value={pin}
                        onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        className="h-[52px] rounded-[14px] border-gray-200 text-2xl text-center tracking-[0.5em]"
                        data-testid="input-pin"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-bold text-gray-600">PIN 번호 확인</label>
                      <Input
                        type="password"
                        inputMode="numeric"
                        placeholder="• • • •"
                        value={pinConfirm}
                        onChange={e => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        className={`h-[52px] rounded-[14px] text-2xl text-center tracking-[0.5em] ${
                          pinConfirm.length === 4 && pin !== pinConfirm
                            ? "border-red-300 focus-visible:ring-red-300"
                            : "border-gray-200"
                        }`}
                        data-testid="input-pin-confirm"
                      />
                      {pinConfirm.length === 4 && pin !== pinConfirm && (
                        <p className="text-red-500 text-xs font-medium">PIN이 일치하지 않아요.</p>
                      )}
                    </div>

                    <div className="flex gap-3 mt-2">
                      <Button variant="outline" onClick={() => setStep("info")} className="flex-1 h-[52px] rounded-[14px] border-gray-200 font-bold">
                        이전
                      </Button>
                      <Button
                        onClick={handleSubmit}
                        disabled={loading || pin.length !== 4 || pin !== pinConfirm}
                        className="flex-[2] h-[52px] rounded-[14px] font-bold text-base"
                        data-testid="btn-create-child"
                      >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "계정 만들기 🎉"}
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* STEP 3: Done */}
                {step === "done" && (
                  <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center text-center gap-5 py-4">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.3, 1] }}
                      transition={{ duration: 0.6, ease: "backOut" }}
                      className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/30 to-accent/40 flex items-center justify-center text-5xl shadow-lg"
                    >
                      {avatar}
                    </motion.div>
                    <div>
                      <h3 className="text-2xl font-black text-gray-900">{name}</h3>
                      <p className="text-gray-500 mt-1">아이 계정이 만들어졌어요!</p>
                      <p className="text-sm text-gray-400 mt-2">이제 아이가 PIN으로 로그인할 수 있어요 🔐</p>
                    </div>
                    <Button onClick={handleClose} className="w-full h-[52px] rounded-[16px] font-bold text-base" data-testid="btn-done-create">
                      확인
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
