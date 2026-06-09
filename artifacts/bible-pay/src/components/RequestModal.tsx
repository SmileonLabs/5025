import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAppContext, ChildRequest } from "@/context/AppContext";

interface RequestModalProps {
  open: boolean;
  onClose: () => void;
}

const TEMPLATES: { type: ChildRequest["type"]; emoji: string; label: string; text: string }[] = [
  { type: "allowance", emoji: "💰", label: "용돈 더 주세요", text: "용돈을 조금 더 주실 수 있나요?" },
  { type: "mission", emoji: "📋", label: "새 미션 만들어주세요", text: "새로운 미션을 만들어 주세요!" },
  { type: "message", emoji: "💬", label: "하고 싶은 말", text: "" },
];

export function RequestModal({ open, onClose }: RequestModalProps) {
  const { createRequest } = useAppContext();
  const { toast } = useToast();

  const [type, setType] = useState<ChildRequest["type"]>("allowance");
  const [message, setMessage] = useState(TEMPLATES[0].text);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleClose = () => {
    setType("allowance");
    setMessage(TEMPLATES[0].text);
    setSent(false);
    onClose();
  };

  const selectTemplate = (t: typeof TEMPLATES[number]) => {
    setType(t.type);
    setMessage(t.text);
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await createRequest(type, message.trim());
      setSent(true);
    } catch (err: any) {
      toast({ title: err?.message ?? "전송에 실패했어요.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[28px] shadow-2xl max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="px-6 pb-10">
              <div className="flex items-center justify-between py-4">
                <h2 className="text-xl font-black text-gray-900">{sent ? "✅ 전송 완료!" : "💌 부모님께 요청하기"}</h2>
                <button onClick={handleClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full" data-testid="btn-close-request">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {sent ? (
                <div className="flex flex-col items-center text-center gap-5 py-4">
                  <motion.div
                    initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ duration: 0.5, ease: "backOut" }}
                    className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-4xl shadow-lg"
                  >
                    💌
                  </motion.div>
                  <p className="text-gray-600 font-medium">부모님께 요청을 보냈어요!<br />곧 확인하실 거예요.</p>
                  <Button onClick={handleClose} className="w-full h-[54px] rounded-[16px] font-bold text-base" data-testid="btn-request-done">확인</Button>
                </div>
              ) : (
                <>
                  <p className="text-sm font-bold text-gray-500 mb-3">무엇을 요청할까요?</p>
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {TEMPLATES.map(t => (
                      <button
                        key={t.type}
                        onClick={() => selectTemplate(t)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-[18px] border-2 transition-all ${
                          type === t.type ? "border-primary bg-primary/5 shadow-sm" : "border-gray-100 bg-gray-50 hover:border-gray-200"
                        }`}
                        data-testid={`request-type-${t.type}`}
                      >
                        <span className="text-2xl">{t.emoji}</span>
                        <span className="text-xs font-bold text-gray-700 text-center leading-tight">{t.label}</span>
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="부모님께 하고 싶은 말을 적어보세요"
                    rows={3}
                    maxLength={500}
                    className="w-full px-4 py-3 rounded-[16px] border border-gray-200 bg-white text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none mb-5"
                    data-testid="input-request-message"
                  />

                  <Button
                    onClick={handleSend}
                    disabled={!message.trim() || sending}
                    className="w-full h-[54px] rounded-[16px] font-bold text-base flex items-center justify-center gap-2"
                    data-testid="btn-send-request"
                  >
                    <Send className="w-4 h-4" /> {sending ? "보내는 중..." : "보내기"}
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
