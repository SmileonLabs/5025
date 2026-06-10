import { useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Wallet } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const PRESET_AMOUNTS = [500, 1000, 2000, 5000];

export default function ChargePage() {
  const [_, setLocation] = useLocation();
  const { children, chargeAllowance, parent } = useAppContext();
  const { toast } = useToast();

  const [selectedChildId, setSelectedChildId] = useState<number>(children[0]?.id ?? 0);
  const [amount, setAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleCharge = async () => {
    const numAmount = parseInt(amount.replace(/,/g, ""), 10);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({ title: "금액을 입력해주세요.", variant: "destructive" });
      return;
    }
    if (!selectedChildId) {
      toast({ title: "아이를 선택해주세요.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await chargeAllowance(selectedChildId, numAmount);
      const childName = children.find(c => c.id === selectedChildId)?.name ?? "";
      toast({
        title: "용돈 채우기 완료! 💸",
        description: `${childName}에게 ${numAmount.toLocaleString("ko-KR")}P를 보냈어요!`,
      });
      setTimeout(() => setLocation("/parent/dashboard"), 1500);
    } catch (err: any) {
      toast({ title: err.message ?? "오류가 발생했어요.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, "");
    setAmount(val ? parseInt(val, 10).toLocaleString("ko-KR") : "");
  };

  if (!parent) {
    setLocation("/");
    return null;
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <div className="px-4 py-4 flex items-center relative border-b border-gray-50">
        <button
          onClick={() => setLocation("/parent/dashboard")}
          className="p-2 absolute left-4 text-gray-600 hover:bg-gray-100 rounded-full"
          data-testid="btn-back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="w-full text-center text-lg font-bold text-gray-900">💰 용돈 채우기</h1>
      </div>

      <div className="flex-1 px-6 pt-8 flex flex-col">
        <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-[20px] p-4 mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">현재 용돈 예산</p>
            <p className="font-black text-gray-900 text-lg">{parent.balance.toLocaleString("ko-KR")}P</p>
          </div>
        </div>

        {children.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">👶</p>
            <p className="font-bold text-gray-700">아직 아이 계정이 없어요</p>
            <p className="text-sm text-gray-400 mt-1">대시보드에서 아이 계정을 먼저 만들어주세요</p>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-sm font-bold text-gray-500 mb-3">누구에게 보낼까요?</h2>
              <div className="flex gap-3 flex-wrap">
                {children.map(child => (
                  <button
                    key={child.id}
                    onClick={() => setSelectedChildId(child.id)}
                    className={`flex-1 min-w-[120px] py-4 px-3 rounded-[20px] border-2 transition-all flex flex-col items-center gap-2 ${
                      selectedChildId === child.id
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-gray-100 bg-white"
                    }`}
                    data-testid={`select-child-${child.id}`}
                  >
                    <div className="text-3xl">{child.avatar}</div>
                    <span className={`font-bold ${selectedChildId === child.id ? "text-primary-foreground" : "text-gray-600"}`}>
                      {child.name}
                    </span>
                    <span className="text-xs text-gray-400">{child.balance.toLocaleString("ko-KR")}P</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-sm font-bold text-gray-500 mb-3">얼마를 보낼까요?</h2>
              <div className="relative mb-4">
                <Input
                  type="text"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="0"
                  className="text-right text-3xl font-bold h-[72px] rounded-[20px] pr-12 focus-visible:ring-primary border-gray-200"
                  data-testid="input-amount"
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-400">P</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {PRESET_AMOUNTS.map(preset => (
                  <button
                    key={preset}
                    onClick={() => setAmount(preset.toLocaleString("ko-KR"))}
                    className="px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-full text-sm font-bold text-gray-700 transition-colors"
                    data-testid={`preset-${preset}`}
                  >
                    +{preset.toLocaleString("ko-KR")}P
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-auto pb-12 pt-4">
              <Button
                onClick={handleCharge}
                disabled={loading || !amount || parseInt(amount.replace(/,/g, ""), 10) === 0 || !selectedChildId}
                className="w-full h-[60px] rounded-[20px] text-lg font-bold bg-primary hover:bg-primary/90 text-white shadow-md"
                data-testid="btn-submit-charge"
              >
                {loading ? "처리 중..." : "용돈 보내기 💸"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
