import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from "@/context/AppContext";

interface ParentTopupModalProps {
  open: boolean;
  onClose: () => void;
}

const PRESET_AMOUNTS = [10000, 30000, 50000, 100000];

const METHODS = [
  { id: "card", label: "신용·체크카드", emoji: "💳" },
  { id: "bank", label: "계좌이체", emoji: "🏦" },
  { id: "kakao", label: "카카오페이", emoji: "💛" },
];

type Step = "amount" | "method" | "done";

export function ParentTopupModal({ open, onClose }: ParentTopupModalProps) {
  const { topupParent, parent } = useAppContext();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("card");
  const [loading, setLoading] = useState(false);

  const numAmount = parseInt(amount.replace(/,/g, ""), 10);
  const isValid = !isNaN(numAmount) && numAmount >= 100;

  const handleClose = () => {
    setStep("amount");
    setAmount("");
    setSelectedMethod("card");
    onClose();
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, "");
    setAmount(val ? parseInt(val, 10).toLocaleString("ko-KR") : "");
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await topupParent(numAmount);
      setStep("done");
    } catch (err: any) {
      toast({ title: err.message ?? "충전에 실패했어요.", variant: "destructive" });
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
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[28px] shadow-2xl"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            <div className="px-6 pb-10">
              <div className="flex items-center justify-between py-4 mb-1">
                <h2 className="text-xl font-black text-gray-900">
                  {step === "amount" && "💰 예산 충전하기"}
                  {step === "method" && "결제 방법 선택"}
                  {step === "done" && "✅ 충전 완료!"}
                </h2>
                <button
                  onClick={handleClose}
                  className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"
                  data-testid="btn-close-topup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <AnimatePresence mode="wait">
                {/* STEP 1: 금액 입력 */}
                {step === "amount" && (
                  <motion.div
                    key="amount"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <div className="bg-blue-50 rounded-[18px] p-4 mb-5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Wallet className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-blue-600 font-bold">현재 예산 잔액</p>
                        <p className="font-black text-blue-800 text-lg">
                          ₩{(parent?.balance ?? 0).toLocaleString("ko-KR")}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm font-bold text-gray-500 mb-3">얼마를 충전할까요?</p>

                    <div className="relative mb-4">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={amount}
                        onChange={handleAmountChange}
                        placeholder="0"
                        autoFocus
                        className="w-full text-right text-4xl font-black h-[80px] rounded-[20px] px-5 pr-14 bg-white border-2 border-gray-200 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        data-testid="input-topup-amount"
                      />
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-400">원</span>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-6">
                      {PRESET_AMOUNTS.map(p => (
                        <button
                          key={p}
                          onClick={() => setAmount(p.toLocaleString("ko-KR"))}
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm font-bold text-gray-700 transition-colors"
                          data-testid={`topup-preset-${p}`}
                        >
                          +{p.toLocaleString("ko-KR")}원
                        </button>
                      ))}
                    </div>

                    <Button
                      onClick={() => setStep("method")}
                      disabled={!isValid}
                      className="w-full h-[54px] rounded-[16px] font-bold text-base bg-blue-500 hover:bg-blue-600 text-white"
                      data-testid="btn-topup-next"
                    >
                      다음 <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </motion.div>
                )}

                {/* STEP 2: 결제 방법 */}
                {step === "method" && (
                  <motion.div
                    key="method"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <div className="bg-gray-50 rounded-[18px] p-4 mb-5 text-center">
                      <p className="text-sm text-gray-500 mb-1">충전 금액</p>
                      <p className="text-3xl font-black text-gray-900">
                        +{numAmount.toLocaleString("ko-KR")}원
                      </p>
                    </div>

                    <p className="text-sm font-bold text-gray-500 mb-3">결제 방법을 선택해주세요</p>

                    <div className="space-y-3 mb-6">
                      {METHODS.map(m => (
                        <button
                          key={m.id}
                          onClick={() => setSelectedMethod(m.id)}
                          className={`w-full flex items-center gap-4 p-4 rounded-[18px] border-2 transition-all ${
                            selectedMethod === m.id
                              ? "border-blue-400 bg-blue-50"
                              : "border-gray-100 bg-white"
                          }`}
                          data-testid={`method-${m.id}`}
                        >
                          <span className="text-2xl">{m.emoji}</span>
                          <span className={`font-bold ${selectedMethod === m.id ? "text-blue-700" : "text-gray-700"}`}>
                            {m.label}
                          </span>
                          {selectedMethod === m.id && (
                            <div className="ml-auto w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>

                    <p className="text-xs text-gray-400 text-center mb-4">
                      실제 결제는 발생하지 않아요. 데모 충전입니다.
                    </p>

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setStep("amount")}
                        className="flex-1 h-[54px] rounded-[16px] font-bold border-gray-200"
                      >
                        이전
                      </Button>
                      <Button
                        onClick={handleConfirm}
                        disabled={loading}
                        className="flex-[2] h-[54px] rounded-[16px] font-bold text-base bg-blue-500 hover:bg-blue-600 text-white"
                        data-testid="btn-topup-confirm"
                      >
                        {loading ? "충전 중..." : "충전하기 💰"}
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* STEP 3: 완료 */}
                {step === "done" && (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center text-center gap-5 py-4"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.2, 1] }}
                      transition={{ duration: 0.5, ease: "backOut" }}
                      className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-4xl shadow-lg"
                    >
                      💰
                    </motion.div>
                    <div>
                      <p className="text-2xl font-black text-gray-900 mb-1">충전 완료!</p>
                      <p className="text-3xl font-black text-blue-500">
                        +{numAmount.toLocaleString("ko-KR")}원
                      </p>
                      {(() => {
                        const m = METHODS.find(x => x.id === selectedMethod);
                        return m ? (
                          <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-gray-100 rounded-full" data-testid="done-method">
                            <span className="text-base">{m.emoji}</span>
                            <span className="text-sm font-bold text-gray-600">{m.label}로 충전</span>
                          </div>
                        ) : null;
                      })()}
                      <p className="text-sm text-gray-500 mt-3">
                        현재 잔액:{" "}
                        <span className="font-bold text-gray-700">
                          ₩{(parent?.balance ?? 0).toLocaleString("ko-KR")}
                        </span>
                      </p>
                    </div>
                    <Button
                      onClick={handleClose}
                      className="w-full h-[54px] rounded-[16px] font-bold text-base bg-blue-500 hover:bg-blue-600 text-white"
                      data-testid="btn-topup-done"
                    >
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
