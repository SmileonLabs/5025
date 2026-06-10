import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from "@/context/AppContext";
import { SPEND_CATEGORIES } from "@/lib/spendCategories";

interface SpendModalProps {
  open: boolean;
  onClose: () => void;
  childId: number;
  balance: number;
}

type Step = "purpose" | "amount" | "confirm" | "done";

const QUICK_CATEGORIES = SPEND_CATEGORIES;

const PRESET_AMOUNTS = [500, 1000, 2000, 3000, 5000];

export function SpendModal({ open, onClose, childId, balance }: SpendModalProps) {
  const { spendAllowance } = useAppContext();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("purpose");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [customPurpose, setCustomPurpose] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const purpose = customPurpose || selectedCategory;
  const numAmount = parseInt(amount.replace(/,/g, ""), 10);
  const isAmountValid = !isNaN(numAmount) && numAmount > 0 && numAmount <= balance;

  const handleClose = () => {
    setStep("purpose");
    setSelectedCategory("");
    setCustomPurpose("");
    setAmount("");
    onClose();
  };

  const handleCategorySelect = (label: string) => {
    setSelectedCategory(label);
    setCustomPurpose("");
  };

  const handleSubmit = async () => {
    if (!isAmountValid || !purpose.trim()) return;
    setIsSubmitting(true);
    const category = selectedCategory || "기타";
    const success = await spendAllowance(childId, numAmount, purpose, category);
    setIsSubmitting(false);
    if (success) {
      setStep("done");
    } else {
      toast({ title: "잔액이 부족해요!", variant: "destructive" });
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, "");
    setAmount(val ? parseInt(val, 10).toLocaleString("ko-KR") : "");
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

            <div className="px-6 pb-safe-bottom">
              <div className="flex items-center justify-between py-4 mb-2">
                <AnimatePresence mode="wait">
                  {step === "purpose" && (
                    <motion.h2 key="h-purpose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="text-xl font-black text-gray-900">💸 이 용돈은 어디에 쓸 건가요?</motion.h2>
                  )}
                  {step === "amount" && (
                    <motion.div key="h-amount" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <h2 className="text-xl font-black text-gray-900">얼마를 쓸 건가요?</h2>
                      <p className="text-sm text-gray-500 mt-0.5">"{purpose}"에 쓸 금액</p>
                    </motion.div>
                  )}
                  {step === "confirm" && (
                    <motion.h2 key="h-confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="text-xl font-black text-gray-900">정말 쓸 건가요?</motion.h2>
                  )}
                  {step === "done" && (
                    <motion.h2 key="h-done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="text-xl font-black text-gray-900">🎉 용돈을 썼어요!</motion.h2>
                  )}
                </AnimatePresence>
                <button onClick={handleClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full" data-testid="btn-close-modal">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <AnimatePresence mode="wait">
                {step === "purpose" && (
                  <motion.div key="purpose" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="pb-8">
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      {QUICK_CATEGORIES.map(cat => (
                        <button
                          key={cat.label}
                          onClick={() => handleCategorySelect(cat.label)}
                          className={`flex flex-col items-center gap-2 p-4 rounded-[18px] border-2 transition-all ${
                            selectedCategory === cat.label && !customPurpose
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-gray-100 bg-gray-50 hover:border-gray-200"
                          }`}
                          data-testid={`category-${cat.label}`}
                        >
                          <span className="text-2xl">{cat.emoji}</span>
                          <span className="text-xs font-bold text-gray-700 text-center leading-tight">{cat.label}</span>
                        </button>
                      ))}
                    </div>

                    <div className="mb-6">
                      <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">직접 쓰기</p>
                      <input
                        type="text"
                        placeholder='예: "떡볶이 냠냠 🌶️"'
                        value={customPurpose}
                        onChange={e => { setCustomPurpose(e.target.value); setSelectedCategory(""); }}
                        className="w-full px-4 py-3 rounded-[16px] border border-gray-200 bg-white text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        data-testid="input-custom-purpose"
                      />
                    </div>

                    <Button onClick={() => setStep("amount")} disabled={!purpose.trim()} className="w-full h-[54px] rounded-[16px] font-bold text-base" data-testid="btn-next-amount">
                      다음 <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </motion.div>
                )}

                {step === "amount" && (
                  <motion.div key="amount" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="pb-8">
                    <div className="bg-gray-50 rounded-[20px] p-4 mb-5 flex justify-between items-center">
                      <span className="text-sm text-gray-500 font-medium">현재 잔액</span>
                      <span className="font-black text-gray-900 text-lg">{balance.toLocaleString("ko-KR")}P</span>
                    </div>

                    <div className="relative mb-4">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={amount}
                        onChange={handleAmountChange}
                        placeholder="0"
                        className="w-full text-right text-4xl font-black h-[80px] rounded-[20px] px-5 pr-14 bg-white border border-gray-200 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        data-testid="input-spend-amount"
                        autoFocus
                      />
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-400">P</span>
                    </div>

                    {!isNaN(numAmount) && numAmount > balance && (
                      <p className="text-red-500 text-sm font-bold text-center mb-3">잔액보다 많이 쓸 수 없어요!</p>
                    )}

                    <div className="flex flex-wrap gap-2 mb-6">
                      {PRESET_AMOUNTS.map(p => (
                        <button key={p} onClick={() => setAmount(p.toLocaleString("ko-KR"))}
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm font-bold text-gray-700 transition-colors"
                          data-testid={`preset-spend-${p}`}>
                          {p.toLocaleString("ko-KR")}P
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setStep("purpose")} className="flex-1 h-[54px] rounded-[16px] font-bold border-gray-200">이전</Button>
                      <Button onClick={() => setStep("confirm")} disabled={!isAmountValid} className="flex-[2] h-[54px] rounded-[16px] font-bold text-base" data-testid="btn-next-confirm">
                        다음 <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {step === "confirm" && (
                  <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="pb-8">
                    <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-[24px] p-6 mb-6 text-center border border-red-100">
                      <div className="text-5xl mb-3">🛒</div>
                      <p className="text-gray-600 text-sm mb-1 font-medium">이걸 살 거예요</p>
                      <p className="text-xl font-black text-gray-900 mb-4">"{purpose}"</p>
                      <div className="inline-block bg-white rounded-[14px] px-6 py-3 shadow-sm">
                        <p className="text-3xl font-black text-red-500">-{numAmount.toLocaleString("ko-KR")}P</p>
                      </div>
                      <p className="text-sm text-gray-500 mt-3">
                        남은 잔액: <span className="font-bold text-gray-700">{(balance - numAmount).toLocaleString("ko-KR")}P</span>
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setStep("amount")} className="flex-1 h-[54px] rounded-[16px] font-bold border-gray-200">취소</Button>
                      <Button onClick={handleSubmit} disabled={isSubmitting}
                        className="flex-[2] h-[54px] rounded-[16px] font-bold text-base bg-red-500 hover:bg-red-600 text-white"
                        data-testid="btn-confirm-spend">
                        {isSubmitting ? "처리 중..." : "용돈 쓰기! 💸"}
                      </Button>
                    </div>
                  </motion.div>
                )}

                {step === "done" && (
                  <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="pb-8 flex flex-col items-center text-center gap-5">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ delay: 0.1, duration: 0.5, ease: "backOut" }}
                      className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-300 to-red-300 flex items-center justify-center text-4xl shadow-lg">
                      🛍️
                    </motion.div>
                    <div>
                      <p className="text-lg font-black text-gray-900">{purpose}</p>
                      <p className="text-3xl font-black text-red-500 mt-1">-{numAmount.toLocaleString("ko-KR")}P</p>
                      <p className="text-sm text-gray-500 mt-2">용돈기입장에 기록됐어요!</p>
                    </div>
                    <Button onClick={handleClose} className="w-full h-[54px] rounded-[16px] font-bold text-base" data-testid="btn-done-spend">확인</Button>
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
