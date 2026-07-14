import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, BookOpen, Loader2, Sparkles, Star } from "lucide-react";
import { api } from "@/lib/api";
import { useAppContext } from "@/context/AppContext";
import { useToast } from "@/hooks/use-toast";

type Note = {
  id: number;
  sessionDate: string;
  domainLabel: string;
  scenario: string;
  questionTitle: string;
  finalQuestion: string;
  rewardPoints: number;
  reason: string;
  completedAt: string | null;
};

export default function GreatQuestionNotebookPage() {
  const [, navigate] = useLocation();
  const { currentChild, loading: authLoading } = useAppContext();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!currentChild) { navigate("/login"); return; }
    void api.get<Note[]>("/great-questions/notebook")
      .then(setNotes)
      .catch((error) => toast({ title: error.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [authLoading, currentChild?.id]);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-violet-50 to-slate-50 pb-10">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-white/95 px-4 py-3 backdrop-blur">
        <button onClick={() => navigate("/child/home")} className="rounded-full p-2" aria-label="홈으로 돌아가기"><ArrowLeft /></button>
        <div className="flex-1">
          <h1 className="font-black">나의 위대한 질문 노트</h1>
          <p className="text-xs font-bold text-violet-600">세상을 바꾸는 생각을 모아 봐요</p>
        </div>
        <BookOpen className="text-violet-500" />
      </header>

      <main className="mx-auto max-w-2xl space-y-4 p-4">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-500 p-5 text-white shadow-lg">
          <Sparkles className="mb-3 h-8 w-8 text-amber-300" />
          <p className="text-sm text-violet-100">작은 궁금증 하나가 비행기와 우주선의 시작이었어요.</p>
          <h2 className="mt-1 text-xl font-black">내 질문도 새로운 세상을 열 수 있어요!</h2>
          <p className="mt-3 text-sm font-bold">지금까지 {notes.length}개의 위대한 질문</p>
        </section>

        {loading ? (
          <div className="grid place-items-center py-20"><Loader2 className="animate-spin text-violet-500" /></div>
        ) : notes.length === 0 ? (
          <section className="rounded-3xl bg-white p-8 text-center shadow-sm">
            <div className="text-5xl">🌱</div>
            <h2 className="mt-3 text-lg font-black">첫 번째 질문을 기다리고 있어요</h2>
            <p className="mt-2 text-sm text-gray-500">오늘 궁금한 것을 이야기하고 나만의 위대한 질문을 만들어 봐요.</p>
            <button onClick={() => navigate("/child/great-question")} className="mt-5 w-full rounded-2xl bg-violet-600 py-3 font-bold text-white">위대한 질문 시작하기</button>
          </section>
        ) : notes.map((note) => (
          <article key={note.id} className="rounded-3xl border border-violet-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-violet-500">{new Date(`${note.sessionDate}T00:00:00`).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</p>
                <h2 className="mt-1 text-lg font-black text-gray-900">{note.questionTitle}</h2>
              </div>
              <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-sm font-black text-amber-600">+{note.rewardPoints.toLocaleString("ko-KR")}P</span>
            </div>
            <div className="mt-4 rounded-2xl bg-violet-50 p-4">
              <p className="text-lg font-black leading-relaxed text-violet-950">“{note.finalQuestion}”</p>
            </div>
            <details className="mt-3 rounded-2xl bg-gray-50 p-3 text-sm text-gray-600">
              <summary className="cursor-pointer font-bold text-gray-700">이 질문이 태어난 이야기</summary>
              <p className="mt-3 leading-relaxed"><strong>오늘의 상황:</strong> {note.scenario}</p>
              <p className="mt-2 leading-relaxed"><Star className="mr-1 inline h-4 w-4 fill-amber-400 text-amber-400" />{note.reason}</p>
            </details>
          </article>
        ))}
      </main>
    </div>
  );
}

