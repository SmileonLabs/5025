import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { ChevronLeft, BookOpen, Star, Loader2, CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

type FlowStep = "select" | "loading" | "quiz" | "result";

const BIBLE_BOOKS = [
  "창세기", "출애굽기", "레위기", "민수기", "신명기",
  "여호수아", "사사기", "룻기", "사무엘상", "사무엘하",
  "시편", "잠언", "전도서", "이사야", "예레미야",
  "마태복음", "마가복음", "누가복음", "요한복음",
  "사도행전", "로마서", "고린도전서", "갈라디아서",
  "에베소서", "빌립보서", "요한계시록"
];

const MOCK_QUIZZES: Record<string, QuizQuestion[]> = {
  default: [
    { question: "하나님께서 세상을 만드실 때 첫째 날 만드신 것은 무엇인가요?", options: ["🌊 바다", "💡 빛", "🌿 풀과 나무", "⭐ 별"], correctIndex: 1 },
    { question: "하나님이 세상을 다 만드시고 마지막 날에 하신 일은 무엇인가요?", options: ["🐟 물고기를 만드셨어요", "🌈 무지개를 만드셨어요", "😴 쉬셨어요", "🏔️ 산을 만드셨어요"], correctIndex: 2 },
  ],
  "시편 23편": [
    { question: "시편 23편에서 하나님을 무엇에 비유하나요?", options: ["👑 왕", "🐑 목자", "🌊 강", "🦅 독수리"], correctIndex: 1 },
    { question: "시편 23편에서 목자는 나를 어디로 인도하나요?", options: ["🏔️ 높은 산으로", "🌲 푸른 초장으로", "🌊 깊은 바다로", "🌆 큰 도시로"], correctIndex: 1 },
  ],
  "요한복음 3:16": [
    { question: "요한복음 3장 16절에서 하나님은 세상을 어떻게 하셨나요?", options: ["만드셨어요", "사랑하셨어요", "심판하셨어요", "잊으셨어요"], correctIndex: 1 },
    { question: "하나님이 독생자를 주신 이유는 무엇인가요?", options: ["세상을 아름답게 하려고", "우리가 멸망하지 않고 영생을 얻게 하려고", "천사들을 보내려고", "성전을 짓게 하려고"], correctIndex: 1 },
  ],
};

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
  const { currentChild, missions, completeMission } = useAppContext();
  const { toast } = useToast();

  const mission = missions.find(m => m.id === params.missionId);

  const [step, setStep] = useState<FlowStep>("select");
  const [selectedBook, setSelectedBook] = useState(mission?.title ?? "");
  const [customPassage, setCustomPassage] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answeredCorrectly, setAnsweredCorrectly] = useState<boolean[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [rewardGranted, setRewardGranted] = useState(false);

  const passage = customPassage || selectedBook;
  const reward = mission?.reward ?? 500;

  if (!currentChild) {
    setLocation("/login");
    return null;
  }

  const fetchQuiz = async () => {
    if (!passage.trim()) {
      toast({ title: "성경 구절을 선택하거나 입력해주세요!", variant: "destructive" });
      return;
    }
    setStep("loading");
    try {
      const res = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passage, bookName: selectedBook || passage }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json() as { questions: QuizQuestion[] };
      if (data.questions && data.questions.length >= 2) {
        setQuestions(data.questions.slice(0, 2));
      } else throw new Error("Invalid quiz data");
    } catch {
      const mockKey = Object.keys(MOCK_QUIZZES).find(k => passage.includes(k)) ?? "default";
      setQuestions(MOCK_QUIZZES[mockKey]);
      toast({ title: "🔌 오프라인 퀴즈로 진행합니다!", description: "연결이 안 될 때도 퀴즈를 풀 수 있어요." });
    } finally {
      setStep("quiz");
      setCurrentQ(0);
      setAnsweredCorrectly([]);
      setSelectedAnswer(null);
      setShowFeedback(false);
    }
  };

  const handleSelectAnswer = (idx: number) => {
    if (showFeedback) return;
    setSelectedAnswer(idx);
    setShowFeedback(true);
    const isCorrect = idx === questions[currentQ].correctIndex;
    const newAnswers = [...answeredCorrectly, isCorrect];

    setTimeout(async () => {
      if (currentQ + 1 < questions.length) {
        setCurrentQ(prev => prev + 1);
        setSelectedAnswer(null);
        setShowFeedback(false);
        setAnsweredCorrectly(newAnswers);
      } else {
        setAnsweredCorrectly(newAnswers);
        setStep("result");
        const allCorrect = newAnswers.every(Boolean);
        if (allCorrect && !rewardGranted && mission) {
          setShowConfetti(true);
          setRewardGranted(true);
          try {
            await completeMission(mission.id, currentChild.id);
          } catch {
            toast({ title: "부모님이 용돈을 충전해 주셔야 해요!", variant: "destructive" });
          }
        }
      }
    }, 1200);
  };

  const allCorrect = answeredCorrectly.length > 0 && answeredCorrectly.every(Boolean);

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col">
      <div className="bg-white px-4 py-4 flex items-center border-b border-gray-100 sticky top-0 z-40">
        <button
          onClick={() => step === "quiz" || step === "result" ? setStep("select") : setLocation("/child/home")}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-full mr-2"
          data-testid="btn-back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">성경 읽기 확인</h1>
      </div>

      <div className="flex-1 px-6 py-6 flex flex-col">
        <AnimatePresence mode="wait">
          {step === "select" && (
            <motion.div key="select" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col gap-6 flex-1">
              <div className="bg-gradient-to-br from-mint/30 to-purple/20 rounded-[24px] p-6 text-center">
                <div className="text-5xl mb-3">📖</div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">오늘 어떤 성경을 읽었나요?</h2>
                <p className="text-gray-500 text-sm">읽은 구절을 선택하면 퀴즈를 낼게요!</p>
              </div>

              {mission && (
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">오늘의 미션</p>
                  <button
                    onClick={() => { setSelectedBook(mission.title); setCustomPassage(""); }}
                    className={`w-full p-4 rounded-[20px] border-2 text-left transition-all flex items-center gap-3 ${
                      selectedBook === mission.title && !customPassage ? "border-primary bg-primary/5" : "border-gray-100 bg-white"
                    }`}
                    data-testid="btn-select-mission"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{mission.title}</p>
                      <p className="text-xs text-gray-500 italic">"{mission.verse.slice(0, 30)}..."</p>
                    </div>
                    <div className="ml-auto bg-accent/20 text-accent-foreground px-3 py-1 rounded-full text-sm font-bold">
                      +{mission.reward}원
                    </div>
                  </button>
                </div>
              )}

              <div>
                <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">다른 성경 구절</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {BIBLE_BOOKS.slice(0, 12).map(book => (
                    <button
                      key={book}
                      onClick={() => { setSelectedBook(book); setCustomPassage(""); }}
                      className={`px-3 py-2 rounded-full text-sm font-bold transition-all ${
                        selectedBook === book && !customPassage ? "bg-primary text-white" : "bg-white border border-gray-200 text-gray-600"
                      }`}
                      data-testid={`book-${book}`}
                    >
                      {book}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="직접 입력 (예: 잠언 3장 5절)"
                  value={customPassage}
                  onChange={e => { setCustomPassage(e.target.value); setSelectedBook(""); }}
                  className="w-full px-4 py-3 rounded-[16px] border border-gray-200 bg-white text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  data-testid="input-custom-passage"
                />
              </div>

              <div className="mt-auto">
                <Button
                  onClick={fetchQuiz}
                  disabled={!passage.trim()}
                  className="w-full h-[56px] rounded-[16px] font-bold text-base bg-primary hover:bg-primary/90 text-white"
                  data-testid="btn-start-quiz"
                >
                  ✅ 퀴즈 풀러 가기!
                </Button>
              </div>
            </motion.div>
          )}

          {step === "loading" && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col items-center justify-center gap-6">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 rounded-full bg-gradient-to-tr from-primary/40 to-accent/40 flex items-center justify-center">
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

              <div className="bg-gradient-to-br from-mint/20 to-purple/10 rounded-[24px] p-6">
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
                    <motion.button key={idx} onClick={() => handleSelectAnswer(idx)} whileTap={{ scale: 0.98 }}
                      className={`w-full p-4 rounded-[16px] text-left font-medium text-sm transition-all flex items-center gap-3 ${btnStyle}`}
                      data-testid={`answer-option-${idx}`}>
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

          {step === "result" && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center justify-center gap-6 relative">
              {showConfetti && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {[...Array(30)].map((_, i) => <ConfettiPiece key={i} index={i} />)}
                </div>
              )}

              {allCorrect ? (
                <>
                  <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} transition={{ duration: 0.6, ease: "backOut" }}
                    className="w-28 h-28 rounded-full bg-gradient-to-br from-yellow-300 to-primary flex items-center justify-center shadow-lg">
                    <Sparkles className="w-14 h-14 text-white" />
                  </motion.div>
                  <div className="text-center">
                    <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-2xl font-black text-gray-900 mb-2">
                      참 잘했어요! 🎉
                    </motion.h2>
                    <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="text-gray-600 mb-1">
                      2문제 모두 맞혔어요!
                    </motion.p>
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7 }}
                      className="inline-block bg-gradient-to-r from-yellow-400 to-accent px-6 py-3 rounded-full mt-2 shadow-md">
                      <p className="text-white font-black text-lg">용돈이 쏙 들어왔어요! +{reward.toLocaleString("ko-KR")}원 💰</p>
                    </motion.div>
                  </div>
                  <div className="flex items-center gap-2 bg-white rounded-[20px] px-5 py-4 shadow-sm border border-gray-100 w-full">
                    <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                    <p className="text-sm font-bold text-gray-700">
                      {currentChild.name}의 잔액:{" "}
                      <span className="text-primary-foreground font-black">₩{currentChild.balance.toLocaleString("ko-KR")}</span>
                    </p>
                  </div>
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
                  <Button onClick={() => { setStep("select"); setSelectedAnswer(null); setShowFeedback(false); setAnsweredCorrectly([]); setCurrentQ(0); setRewardGranted(false); }}
                    className="w-full h-[52px] rounded-[14px] font-bold bg-primary hover:bg-primary/90 text-white" data-testid="btn-retry">
                    다시 도전하기!
                  </Button>
                )}
                <Button onClick={() => setLocation("/child/home")} variant="outline"
                  className="w-full h-[52px] rounded-[14px] font-bold border-gray-200" data-testid="btn-go-home">
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
