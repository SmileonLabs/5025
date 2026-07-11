import { FormEvent, useEffect, useRef, useState } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { ChevronLeft, Loader2, Send, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useAppContext } from "@/context/AppContext";
import { useToast } from "@/hooks/use-toast";

type ChatMessage = { role: "child" | "assistant"; content: string };
type AttemptResponse = { attempt: { id: number }; message: ChatMessage };
type MessageResponse = {
  message: string;
  status: "in_progress" | "failed";
  relevant?: boolean;
  shouldEnd?: boolean;
};
type CompleteResponse = {
  status: "completed" | "failed";
  rewardPoints: number;
  childBalance?: number;
  canRetry?: boolean;
  evaluation: { reason: string };
};

export default function ReadingConversationPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ missionId: string }>();
  const search = new URLSearchParams(useSearch());
  const { currentChild, missions, loading: appLoading } = useAppContext();
  const { toast } = useToast();
  const missionId = Number(params.missionId);
  const mission = missions.find((item) => item.id === missionId);
  const sourceType = search.get("type") === "book" ? "book" : "bible";
  const book = search.get("book") ?? "";
  const chapter = Number(search.get("chapter"));
  const bookId = Number(search.get("bookId"));
  const unitId = Number(search.get("unitId"));
  const unitTitle = search.get("title") ?? "";
  const validSource = sourceType === "book" ? Number.isInteger(bookId) && bookId > 0 && Number.isInteger(unitId) && unitId > 0 && !!unitTitle : !!book && Number.isInteger(chapter) && chapter > 0;
  const sourceLabel = sourceType === "book" ? unitTitle : `${book} ${chapter}장`;
  const backPath = sourceType === "book" ? `/child/book/${missionId}` : `/child/bible/${missionId}`;
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [canComplete, setCanComplete] = useState(false);
  const [result, setResult] = useState<CompleteResponse | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const started = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentChild || !mission || !validSource || started.current) return;
    started.current = true;
    api.post<AttemptResponse>("/reading/attempts", {
      missionId,
      readingUnitKey: sourceType === "book" ? `book:${bookId}:${unitId}` : `bible:${book}:${chapter}`,
      sourceLabel,
    }).then((data) => {
      setAttemptId(data.attempt.id);
      setMessages([data.message]);
    }).catch((error) => {
      setStartError(error.message ?? "독서 대화를 시작하지 못했어요.");
      toast({ title: error.message, variant: "destructive" });
    }).finally(() => setLoading(false));
  }, [book, bookId, chapter, currentChild, mission, missionId, sourceLabel, sourceType, toast, unitId, validSource]);

  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), [messages, sending]);

  useEffect(() => {
    if (!appLoading && !currentChild) setLocation("/login");
  }, [appLoading, currentChild, setLocation]);

  if (appLoading) {
    return <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-violet-500" /></div>;
  }
  if (!currentChild) return null;
  if (!mission || !validSource) {
    return <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center p-6"><section className="bg-white rounded-3xl border p-6 text-center max-w-sm w-full"><p className="text-3xl mb-3">📖</p><h1 className="font-black text-lg">읽기 정보를 찾지 못했어요</h1><p className="text-sm text-gray-500 mt-2">미션 목록으로 돌아가 다시 선택해 주세요.</p><button onClick={() => setLocation("/child/missions")} className="mt-5 w-full rounded-xl bg-gray-900 text-white py-3 font-bold">미션으로 돌아가기</button></section></div>;
  }

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (!attemptId || content.length < 2 || sending || result) return;
    setInput("");
    setMessages((current) => [...current, { role: "child", content }]);
    setSending(true);
    try {
      const response = await api.post<MessageResponse>(`/reading/attempts/${attemptId}/messages`, { content });
      setMessages((current) => [...current, { role: "assistant", content: response.message }]);
      if (response.status === "failed") {
        setResult({ status: "failed", rewardPoints: 0, canRetry: true, evaluation: { reason: "읽은 내용과 관련된 질문이 없어 이번 미션은 완료되지 않았어요." } });
      } else {
        const previousChildMessages = messages.filter((item) => item.role === "child").length;
        if (response.shouldEnd || previousChildMessages >= 1) setCanComplete(true);
      }
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
      setMessages((current) => current.slice(0, -1));
      setInput(content);
    } finally {
      setSending(false);
    }
  };

  const complete = async () => {
    if (!attemptId || sending) return;
    setSending(true);
    try {
      setResult(await api.post<CompleteResponse>(`/reading/attempts/${attemptId}/complete`, {}));
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <button onClick={() => setLocation(backPath)} className="p-2 rounded-full hover:bg-gray-100" aria-label="뒤로 가기"><ChevronLeft className="w-5 h-5" /></button>
        <div className="flex-1"><h1 className="font-bold text-gray-900">AI와 독서 대화</h1><p className="text-xs text-gray-500">{sourceLabel} · 좋은 질문은 500~2,000P</p></div>
        <Sparkles className="w-5 h-5 text-violet-500" />
      </header>

      <main className="flex-1 px-4 py-5 space-y-3 overflow-y-auto pb-40">
        <div className="bg-amber-50 text-amber-800 rounded-2xl px-4 py-3 text-xs leading-relaxed">읽은 내용에서 궁금한 점을 질문해 보세요. 관련 없는 질문만 하면 0P이며 읽기 완료로 표시되지 않아요.</div>
        {loading && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-500" /></div>}
        {startError && (
          <section className="bg-white border border-rose-200 rounded-3xl p-6 text-center">
            <p className="text-3xl mb-3">😥</p>
            <h2 className="font-black text-lg">대화를 시작하지 못했어요</h2>
            <p className="text-sm text-gray-600 mt-2">{startError}</p>
            <button onClick={() => window.location.reload()} className="mt-5 w-full rounded-xl bg-violet-500 text-white py-3 font-bold">다시 시도하기</button>
            <button onClick={() => setLocation(backPath)} className="mt-2 w-full rounded-xl bg-gray-100 text-gray-700 py-3 font-bold">읽은 범위 다시 선택</button>
          </section>
        )}
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.role === "child" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[84%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${message.role === "child" ? "bg-violet-500 text-white rounded-br-md" : "bg-white border shadow-sm text-gray-800 rounded-bl-md"}`}>{message.content}</div>
          </div>
        ))}
        {sending && <div className="flex justify-start"><div className="bg-white border rounded-2xl px-4 py-3"><Loader2 className="w-4 h-4 animate-spin text-violet-500" /></div></div>}
        {result && (
          <section className={`rounded-3xl p-5 text-center border ${result.status === "completed" ? "bg-green-50 border-green-200" : "bg-rose-50 border-rose-200"}`}>
            <p className="text-3xl mb-2">{result.status === "completed" ? "🎉" : "🌱"}</p>
            <h2 className="font-black text-lg">{result.status === "completed" ? `+${result.rewardPoints.toLocaleString("ko-KR")}P 받았어요!` : "아직 미션 완료가 아니에요"}</h2>
            <p className="text-sm text-gray-600 mt-2">{result.evaluation.reason}</p>
            <button onClick={() => setLocation(result.status === "completed" ? "/child/missions" : backPath)} className="mt-4 w-full rounded-xl bg-gray-900 text-white py-3 font-bold">{result.status === "completed" ? "미션으로 돌아가기" : "다시 읽고 도전하기"}</button>
          </section>
        )}
        <div ref={bottomRef} />
      </main>

      {!result && attemptId && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {canComplete && <button onClick={complete} disabled={sending} className="w-full mb-3 py-2.5 rounded-xl bg-green-500 text-white text-sm font-bold disabled:opacity-50">질문을 마치고 포인트 받기</button>}
          <form onSubmit={send} className="flex gap-2 max-w-2xl mx-auto">
            <input value={input} onChange={(event) => setInput(event.target.value)} maxLength={800} placeholder="읽은 내용에서 궁금한 점을 물어보세요" className="flex-1 min-w-0 rounded-2xl border px-4 py-3 text-sm focus:outline-none focus:border-violet-400" />
            <button type="submit" disabled={sending || input.trim().length < 2} className="w-12 rounded-2xl bg-violet-500 text-white flex items-center justify-center disabled:opacity-40" aria-label="질문 보내기"><Send className="w-5 h-5" /></button>
          </form>
        </div>
      )}
    </div>
  );
}
