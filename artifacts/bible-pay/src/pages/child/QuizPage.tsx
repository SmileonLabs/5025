import { useState, useEffect } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { ChevronLeft, Star, Loader2, CheckCircle2, XCircle, Sparkles, PenLine } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

type FlowStep = "loading" | "quiz" | "reflection" | "result";

const MIN_REFLECTION = 5;

function ConfettiPiece({ index }: { index: number }) {
  const colors = ["#FFE066", "#A8EDCB", "#C8B8F8", "#FFD6B0", "#FF8FAB", "#7DD3FC"];
  const color = colors[index % colors.length];
  const x = (Math.random() - 0.5) * 400;
  const y = Math.random() * -300 - 100;
  const rotate = Math.random() * 720 - 360;
  return (
    <motion.div
      className="absolute w-3 h-3 rounded-sm"
      style={{ background: color, top: "50%", left: "50%" }}
      initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
      animate={{ x, y, opacity: 0, rotate, scale: 0.5 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
    />
  );
}

export default function QuizPage() {
  const [_, setLocation] = useLocation();
  const params = useParams<{ missionId: string }>();
  const search = useSearch();
  const { currentChild, missions, submitMission } = useAppContext();
  const { toast } = useToast();

  const missionId = parseInt(params.missionId, 10);
  const mission = missions.find(m => m.id === missionId);

  const searchParams = new URLSearchParams(search);
  const bibleBook = searchParams.get("book") ?? "";
  const bibleChapter = parseInt(searchParams.get("chapter") ?? "0", 10);

  const [step, setStep] = useState<FlowStep>("loading");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answeredCorrectly, setAnsweredCorrectly] = useState<boolean[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [rewardGranted, setRewardGranted] = useState(false);
  const [finalBalance, setFinalBalance] = useState<number | null>(null);
  const [reflection, setReflection] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!currentChild) { setLocation("/login"); return null; }
  if (!mission) { setLocation("/child/missions"); return null; }

  const passage = bibleBook && bibleChapter ? `${bibleBook} ${bibleChapter}장` : mission.title;
  const reward = mission.reward;

  const fetchQuiz = async () => {
    setStep("loading");
    setCurrentQ(0);
    setAnsweredCorrectly([]);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setRewardGranted(false);
    setFinalBalance(null);
    setReflection("");

    try {
      const res = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ passage, bookName: bibleBook || mission.title }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json() as { questions: QuizQuestion[] };
      if (data.questions && data.questions.length >= 2) {
        setQuestions(data.questions.slice(0, 2));
      } else throw new Error("Invalid quiz data");
    } catch {
      toast({ title: "퀴즈 생성에 실패했어요. 다시 시도해주세요.", variant: "destructive" });
      setLocation(`/child/bible/${missionId}`);
      return;
    }
    setStep("quiz");
  };

  useEffect(() => {
    fetchQuiz();
  }, []);

  const handleSelectAnswer = (idx: number) => {
    if (showFeedback) return;
    setSelectedAnswer(idx);
    setShowFeedback(true);
    const isCorrect = idx === questions[currentQ].correctIndex;
    const newAnswers = [...answeredCorrectly, isCorrect];

    setTimeout(() => {
      if (currentQ + 1 < questions.length) {
        setCurrentQ(prev => prev + 1);
        setSelectedAnswer(null);
        setShowFeedback(false);
        setAnsweredCorrectly(newAnswers);
      } else {
        setAnsweredCorrectly(newAnswers);
        const passed = newAnswers.every(Boolean);
        // Passed → go to reflection step (reward only after writing). Failed → result.
        setStep(passed ? "reflection" : "result");
      }
    }, 1200);
  };

  const handleSubmitReflection = async () => {
    if (reflection.trim().length < MIN_REFLECTION || rewardGranted || submitting) return;
    setSubmitting(true);
    try {
      const result = await submitMission(missionId, {
        bibleBook: bibleBook || undefined,
        bibleChapter: bibleChapter || undefined,
        reflection: reflection.trim(),
      });
      setRewardGranted(true);
      setFinalBalance(result.childBalance);
      setShowConfetti(true);
      setStep("result");
    } catch (err: any) {
      if (err?.status === 409) {
        toast({ title: "이미 완료한 장이에요!", description: "다른 장에 도전해보세요." });
        setStep("result");
      } else {
        toast({ title: err?.message ?? "보상 지급에 실패했어요.", variant: "destructive" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const allCorrect = answeredCorrectly.length > 0 && answeredCorrectly.every(Boolean);

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col">
      <div className="bg-white px-4 py-4 flex items-center border-b border-gray-100 sticky top-0 z-40">
        <button
          onClick={() => bibleBook ? setLocation(`/child/bible/${missionId}`) : setLocation("/child/missions")}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-full mr-2"
          data-testid="btn-back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">성경 퀴즈</h1>
          {bibleBook && <p className="text-xs text-gray-400">{passage}</p>}
        </div>
      </div>

      <div className="flex-1 px-6 py-6 flex flex-col">
        <AnimatePresence mode="wait">
          {step === "loading" && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col items-center justify-center gap-6">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 rounded-full bg-gradient-to-tr from-primary/40 to-accent/40 flex items-center justify-center"
              >
                <Loader2 className="w-8 h-8 text-primary-foreground" />
              </motion.div>
              <div className="text-center">
                <p className="font-bold text-gray-900 text-lg">퀴즈를 만들고 있어요!</p>
                <p className="text-gray-500 text-sm mt-1">AI가 {passage} 문제를 만드는 중...</p>
              </div>
            </motion.div>
          )}

          {step === "quiz" && questions.length > 0 && (
            <motion.div key={`quiz-${currentQ}`} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="flex flex-col gap-6 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-500">문제 {currentQ + 1} / {questions.length}</span>
                <div className="flex gap-2">
                  {questions.map((_, i) => (
                    <div key={i} className={`w-8 h-2 rounded-full transition-all ${i < currentQ ? "bg-primary" : i === currentQ ? "bg-primary/40" : "bg-gray-200"}`} />
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-[24px] p-6">
                <div className="text-3xl mb-3 text-center">🤔</div>
                <p className="text-lg font-bold text-gray-900 text-center leading-snug">{questions[currentQ].question}</p>
              </div>

              <div className="flex flex-col gap-3">
                {questions[currentQ].options.map((option, idx) => {
                  let btnStyle = "border-2 border-gray-100 bg-white text-gray-800";
                  if (showFeedback) {
                    if (idx === questions[currentQ].correctIndex) btnStyle = "border-2 border-green-400 bg-green-50 text-green-800";
                    else if (idx === selectedAnswer) btnStyle = "border-2 border-red-300 bg-red-50 text-red-700";
                  } else if (selectedAnswer === idx) {
                    btnStyle = "border-2 border-primary bg-primary/5 text-gray-900";
                  }
                  return (
                    <motion.button
                      key={idx}
                      onClick={() => handleSelectAnswer(idx)}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full p-4 rounded-[16px] text-left font-medium text-sm transition-all flex items-center gap-3 ${btnStyle}`}
                      data-testid={`answer-option-${idx}`}
                    >
                      <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold shrink-0">
                        {["①", "②", "③", "④"][idx]}
                      </span>
                      <span>{option}</span>
                      {showFeedback && idx === questions[currentQ].correctIndex && <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto shrink-0" />}
                      {showFeedback && idx === selectedAnswer && idx !== questions[currentQ].correctIndex && <XCircle className="w-5 h-5 text-red-400 ml-auto shrink-0" />}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {step === "reflection" && (
            <motion.div key="reflection" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col gap-5 flex-1">
              <div className="flex flex-col items-center text-center gap-3 pt-2">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.2, 1] }}
                  transition={{ duration: 0.5, ease: "backOut" }}
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-green-300 to-emerald-400 flex items-center justify-center shadow-md"
                >
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </motion.div>
                <div>
                  <h2 className="text-xl font-black text-gray-900">퀴즈 정답! 🎉</h2>
                  <p className="text-sm text-gray-500 mt-1">마지막으로 깨달은 점이나<br />궁금한 점을 적으면 용돈이 지급돼요.</p>
                </div>
              </div>

              <div className="bg-white rounded-[20px] p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <PenLine className="w-4 h-4 text-primary-foreground" />
                  <span className="font-bold text-gray-800 text-sm">{passage}을(를) 읽고...</span>
                </div>
                <textarea
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  placeholder="예) 하나님이 정말 우리를 사랑하신다는 걸 느꼈어요. 그런데 왜 노아만 방주를 만들었을까요?"
                  rows={5}
                  maxLength={500}
                  className="w-full resize-none rounded-[14px] border-2 border-gray-100 focus:border-primary/40 focus:outline-none p-3 text-sm text-gray-800 placeholder:text-gray-300 leading-relaxed"
                  data-testid="input-reflection"
                />
                <div className="flex justify-between items-center mt-1.5 text-xs">
                  <span className={reflection.trim().length < MIN_REFLECTION ? "text-gray-400" : "text-green-600 font-bold"}>
                    {reflection.trim().length < MIN_REFLECTION
                      ? `${MIN_REFLECTION}자 이상 적어주세요`
                      : "좋아요! 이제 용돈을 받을 수 있어요 ✨"}
                  </span>
                  <span className="text-gray-300">{reflection.length}/500</span>
                </div>
              </div>

              <div className="mt-auto">
                <Button
                  onClick={handleSubmitReflection}
                  disabled={reflection.trim().length < MIN_REFLECTION || submitting}
                  className="w-full h-[52px] rounded-[14px] font-bold bg-primary hover:bg-primary/90 text-white flex items-center justify-center gap-2 disabled:opacity-40"
                  data-testid="btn-submit-reflection"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? "지급 중..." : `작성 완료하고 +${reward.toLocaleString("ko-KR")}P 받기 💰`}
                </Button>
              </div>
            </motion.div>
          )}

          {step === "result" && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center justify-center gap-6 relative">
              {showConfetti && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {[...Array(30)].map((_, i) => <ConfettiPiece key={i} index={i} />)}
                </div>
              )}

              {allCorrect ? (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.3, 1] }}
                    transition={{ duration: 0.6, ease: "backOut" }}
                    className="w-28 h-28 rounded-full bg-gradient-to-br from-yellow-300 to-primary flex items-center justify-center shadow-lg"
                  >
                    <Sparkles className="w-14 h-14 text-white" />
                  </motion.div>
                  <div className="text-center">
                    <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-2xl font-black text-gray-900 mb-2">
                      참 잘했어요! 🎉
                    </motion.h2>
                    <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="text-gray-600 mb-1">
                      2문제 모두 맞혔어요!
                    </motion.p>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.7 }}
                      className="inline-block bg-gradient-to-r from-yellow-400 to-accent px-6 py-3 rounded-full mt-2 shadow-md"
                    >
                      <p className="text-white font-black text-lg">+{reward.toLocaleString("ko-KR")}P 지급! 💰</p>
                    </motion.div>
                  </div>
                  {finalBalance !== null && (
                    <div className="flex items-center gap-2 bg-white rounded-[20px] px-5 py-4 shadow-sm border border-gray-100 w-full">
                      <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                      <p className="text-sm font-bold text-gray-700">
                        현재 잔액:{" "}
                        <span className="text-primary-foreground font-black">{finalBalance.toLocaleString("ko-KR")}P</span>
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-200 to-red-100 flex items-center justify-center">
                    <span className="text-5xl">😅</span>
                  </div>
                  <div className="text-center">
                    <h2 className="text-2xl font-black text-gray-900 mb-2">아쉬워요!</h2>
                    <p className="text-gray-500">{answeredCorrectly.filter(Boolean).length}문제 맞혔어요.<br />다시 한번 도전해볼까요?</p>
                  </div>
                </>
              )}

              <div className="flex flex-col gap-3 w-full mt-4">
                {!allCorrect && (
                  <Button onClick={fetchQuiz} className="w-full h-[52px] rounded-[14px] font-bold bg-primary hover:bg-primary/90 text-white" data-testid="btn-retry">
                    다시 도전하기! (새 문제)
                  </Button>
                )}
                {allCorrect && bibleBook && (
                  <Button onClick={() => setLocation(`/child/bible/${missionId}`)} variant="outline" className="w-full h-[52px] rounded-[14px] font-bold border-gray-200" data-testid="btn-another-chapter">
                    다른 장도 읽기 📖
                  </Button>
                )}
                <Button onClick={() => setLocation("/child/home")} variant="outline" className="w-full h-[52px] rounded-[14px] font-bold border-gray-200" data-testid="btn-go-home">
                  홈으로 돌아가기
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
