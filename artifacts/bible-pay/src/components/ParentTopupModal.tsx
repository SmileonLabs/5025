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

type Step = "amount" | "confirm";

export function ParentTopupModal({ open, onClose }: ParentTopupModalProps) {
  const { startTopupCheckout, parent } = useAppContext();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const numAmount = parseInt(amount.replace(/,/g, ""), 10);
  const isValid = !isNaN(numAmount) && numAmount >= 1000;

  const handleClose = () => {
    setStep("amount");
    setAmount("");
    setLoading(false);
    onClose();
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, "");
    setAmount(val ? parseInt(val, 10).toLocaleString("ko-KR") : "");
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      // Redirects the browser to the secure Stripe Checkout page.
      await startTopupCheckout(numAmount);
    } catch (err: any) {
      toast({ title: err.message ?? "결제 페이지를 여는 데 실패했어요.", variant: "destructive" });
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
                  {step === "confirm" && "결제 확인"}
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

                    {amount && numAmount < 1000 && (
                      <p className="text-xs text-red-400 font-medium mb-3 text-right">
                        최소 1,000원부터 충전할 수 있어요.
                      </p>
                    )}

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
                      onClick={() => setStep("confirm")}
                      disabled={!isValid}
                      className="w-full h-[54px] rounded-[16px] font-bold text-base bg-blue-500 hover:bg-blue-600 text-white"
                      data-testid="btn-topup-next"
                    >
                      다음 <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </motion.div>
                )}

                {/* STEP 2: 결제 확인 */}
                {step === "confirm" && (
                  <motion.div
                    key="confirm"
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

                    <p className="text-sm font-bold text-gray-500 mb-3">결제 수단</p>

                    <div className="flex items-center gap-4 p-4 rounded-[18px] border-2 border-blue-400 bg-blue-50 mb-6">
                      <span className="text-2xl">💳</span>
                      <span className="font-bold text-blue-700">신용·체크카드</span>
                      <div className="ml-auto w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                    </div>

                    <p className="text-xs text-gray-400 text-center mb-4 leading-relaxed">
                      안전한 Stripe 결제 페이지로 이동해요.<br />
                      지금은 테스트 모드라 실제 결제는 일어나지 않아요.<br />
                      카드번호 <span className="font-bold text-gray-500">4242 4242 4242 4242</span>로 결제해보세요.
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
                        {loading ? "결제 페이지 여는 중..." : "결제하기 💳"}
                      </Button>
                    </div>
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
