import { FormEvent, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  BookOpen,
  Loader2,
  Send,
  Sparkles,
  Star,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAppContext } from "@/context/AppContext";
import { useToast } from "@/hooks/use-toast";

type Domain = { key: string; label: string; emoji: string };
type Message = { id?: number; role: "child" | "assistant"; content: string };
type Session = {
  id: number;
  scenario: string;
  domainLabel: string;
  status: "in_progress" | "completed";
  rewardPoints: number;
  finalQuestion?: string | null;
  questionTitle?: string | null;
};
type State = {
  domains: Domain[];
  profile: { domainKey: string; domainLabel: string } | null;
  session: Session | null;
  messages: Message[];
};
type Result = {
  status: "in_progress" | "completed";
  rewardPoints: number;
  message?: string;
  evaluation: {
    reason: string;
    greatQuestion?: string;
    questionTitle?: string;
  };
};

export default function GreatQuestionPage() {
  const [, navigate] = useLocation();
  const { currentChild, loading: authLoading } = useAppContext();
  const { toast } = useToast();
  const [state, setState] = useState<State | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [loadError, setLoadError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoadError("");
    try {
      const data = await api.get<State>("/great-questions");
      const safeMessages = Array.isArray(data.messages)
        ? data.messages.filter(
            (message) =>
              message &&
              (message.role === "child" || message.role === "assistant") &&
              typeof message.content === "string",
          )
        : [];
      setState({ ...data, messages: safeMessages });
      setSession(data.session ?? null);
      setMessages(safeMessages);
      setResult(
        data.session?.status === "completed"
          ? {
              status: "completed",
              rewardPoints: Number(data.session.rewardPoints) || 0,
              evaluation: {
                reason: "오늘의 위대한 질문을 이미 완성했어요!",
                greatQuestion: data.session.finalQuestion ?? undefined,
                questionTitle: data.session.questionTitle ?? undefined,
              },
            }
          : null,
      );
    } catch (e: any) {
      if (e?.status === 401) {
        navigate("/login");
        return;
      }
      const message = e?.message ?? "대화 기록을 불러오지 못했어요.";
      setLoadError(message);
      toast({ title: message, variant: "destructive" });
    }
  };
  useEffect(() => {
    if (authLoading) return;
    if (!currentChild) navigate("/login");
    else void load();
  }, [authLoading, currentChild?.id]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const target = bottom.current;
      if (!target) return;
      if (typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ behavior: "smooth", block: "end" });
      } else {
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "smooth",
        });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, busy, result]);
  const choose = async (domainKey: string) => {
    setBusy(true);
    try {
      await api.put("/great-questions/profile", { domainKey });
      await load();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  const start = async () => {
    setBusy(true);
    try {
      const data = await api.post<{ session: Session; messages: Message[] }>(
        "/great-questions/sessions",
        {},
      );
      setSession(data.session);
      setMessages(data.messages);
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  const send = async (event: FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (!session || content.length < 2 || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "child", content }]);
    setBusy(true);
    try {
      const data = await api.post<{
        reply: string;
        questionKind: "exploring" | "change" | "off_topic";
        readyToEvaluate: boolean;
      }>(`/great-questions/sessions/${session.id}/messages`, { content });
      if (
        !data ||
        typeof data.reply !== "string" ||
        data.reply.trim().length === 0
      )
        throw new Error("AI 답변을 불러오지 못했어요. 다시 보내 주세요.");
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e: any) {
      setMessages((m) => m.slice(0, -1));
      setInput(content);
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  const complete = async () => {
    if (!session || busy) return;
    setBusy(true);
    try {
      const data = await api.post<Result>(
        `/great-questions/sessions/${session.id}/complete`,
        {},
      );
      if (data.status === "completed") {
        setResult(data);
        window.dispatchEvent(new Event("focus"));
      } else {
        toast({ title: data.message ?? "조금 더 이야기해 보세요." });
      }
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  const resetChallenge = async () => {
    if (!session || busy) return;
    const willReturnPoints = result && result.rewardPoints > 0;
    const message = willReturnPoints
      ? `받은 ${result.rewardPoints.toLocaleString()}P는 돌아가고, 처음부터 다시 도전하게 돼요. 다시 시작할까?`
      : "지금까지의 대화를 지우고 처음부터 다시 시작할까?";
    if (!window.confirm(message)) return;
    setBusy(true);
    try {
      await api.post<{ status: "reset" }>(`/great-questions/sessions/${session.id}/reset`, {});
      setSession(null);
      setMessages([]);
      setResult(null);
      await load();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const hasChildQuestion = messages.some((message) => message.role === "child");

  if (authLoading || (!state && !loadError))
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-violet-50">
        <Loader2 className="animate-spin text-violet-600" />
      </div>
    );
  if (loadError)
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-violet-50 p-6">
        <section className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-sm">
          <p className="font-bold text-gray-800">
            대화 기록을 불러오지 못했어요.
          </p>
          <p className="mt-2 text-sm text-gray-500">{loadError}</p>
          <button
            onClick={() => void load()}
            className="mt-5 w-full rounded-2xl bg-violet-600 py-3 font-bold text-white"
          >
            다시 불러오기
          </button>
          <button
            onClick={() => navigate("/child/home")}
            className="mt-3 text-sm text-gray-500 underline"
          >
            홈으로 돌아가기
          </button>
        </section>
      </div>
    );
  if (!state) return null;
  if (!state.profile)
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-violet-100 to-white p-5">
        <header className="flex items-center gap-3 py-3">
          <button
            onClick={() => navigate("/child/home")}
            className="p-2 bg-white rounded-full"
          >
            <ArrowLeft />
          </button>
          <div>
            <h1 className="text-xl font-black">위대한 질문</h1>
            <p className="text-sm text-gray-500">
              내가 궁금한 세상을 골라 봐요
            </p>
          </div>
        </header>
        <section className="mt-5 bg-white rounded-3xl p-5 shadow-sm">
          <div className="text-center mb-5">
            <span className="text-5xl">🦸</span>
            <h2 className="font-black text-xl mt-2">어떤 세상이 더 궁금해?</h2>
            <p className="text-sm text-gray-500 mt-1">
              직업을 고르는 게 아니에요. 언제든 바꿀 수 있어요!
            </p>
          </div>
          <div className="grid gap-3">
            {state.domains.map((d) => (
              <button
                key={d.key}
                disabled={busy}
                onClick={() => choose(d.key)}
                className="flex items-center gap-3 rounded-2xl border-2 border-violet-100 p-4 text-left active:scale-[.98]"
              >
                <span className="text-3xl">{d.emoji}</span>
                <span className="font-bold text-gray-800">{d.label}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    );

  if (!session)
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-indigo-100 to-white p-5">
        <header className="flex items-center gap-3 py-3">
          <button
            onClick={() => navigate("/child/home")}
            className="p-2 bg-white rounded-full"
          >
            <ArrowLeft />
          </button>
          <h1 className="text-xl font-black">위대한 질문</h1>
        </header>
        <section className="mt-10 bg-white rounded-[32px] p-7 text-center shadow-sm">
          <div className="text-6xl">✨</div>
          <h2 className="text-2xl font-black mt-4">오늘의 질문 모험</h2>
          <p className="text-gray-600 mt-3 leading-relaxed">
            {state.profile.domainLabel}에 관한
            <br />
            새로운 상황을 만나 볼까요?
          </p>
          <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-amber-900 font-bold">
            깊이 생각한 멋진 질문은
            <br />
            <strong className="text-xl">최대 2,000P</strong>를 받을 수 있어요!
          </div>
          <button
            onClick={start}
            disabled={busy}
            className="mt-6 w-full rounded-2xl bg-violet-600 py-4 text-white font-black"
          >
            {busy ? "오늘의 상황을 만들고 있어요..." : "질문 모험 시작하기"}
          </button>
          <button
            onClick={() => setState({ ...state, profile: null })}
            className="mt-3 text-sm text-gray-500 underline"
          >
            다른 세상이 궁금해
          </button>
        </section>
      </div>
    );

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex gap-3 items-center">
        <button onClick={() => navigate("/child/home")} className="p-2">
          <ArrowLeft />
        </button>
        <div className="flex-1">
          <h1 className="font-black">위대한 질문</h1>
          <p className="text-xs text-violet-600 font-bold">
            좋은 질문일수록 최대 2,000P!
          </p>
        </div>
        <button
          onClick={() => navigate("/child/great-question/notebook")}
          className="p-2 rounded-full bg-violet-50 text-violet-600"
          aria-label="위대한 질문 노트"
        >
          <BookOpen />
        </button>
      </header>
      <main className="flex-1 p-4 pb-48 space-y-3">
        <div className="rounded-2xl bg-violet-100 p-4">
          <p className="text-xs font-bold text-violet-600">오늘의 상황</p>
          <p className="mt-1 text-sm font-bold text-violet-950">
            {session.scenario}
          </p>
        </div>
        {messages.map((m, i) => (
          <div
            key={m.id ?? i}
            className={`flex ${m.role === "child" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === "child" ? "bg-violet-600 text-white rounded-br-sm" : "bg-white border shadow-sm rounded-bl-sm"}`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && <Loader2 className="animate-spin text-violet-500 mx-auto" />}
        {result && (
          <section className="rounded-3xl bg-amber-50 border border-amber-200 p-6 text-center">
            <Star className="mx-auto fill-amber-400 text-amber-400 w-12 h-12" />
            <h2 className="font-black text-xl mt-2">
              +{result.rewardPoints.toLocaleString()}P 받았어요!
            </h2>
            {result.evaluation.greatQuestion && (
              <div className="mt-4 rounded-2xl bg-white p-4 text-left shadow-sm">
                <p className="text-xs font-bold text-violet-500">
                  {result.evaluation.questionTitle ?? "오늘의 위대한 질문"}
                </p>
                <p className="mt-2 font-black leading-relaxed text-gray-900">
                  “{result.evaluation.greatQuestion}”
                </p>
              </div>
            )}
            <p className="mt-3 text-sm leading-relaxed text-gray-700">
              {result.evaluation.reason}
            </p>
            {result.rewardPoints < 2000 && (
              <button
                onClick={resetChallenge}
                className="mt-5 w-full py-3 rounded-xl border border-violet-200 text-violet-700 font-bold"
              >
                처음부터 다시 도전하기
              </button>
            )}
            <button
              onClick={() => navigate("/child/great-question/notebook")}
              className="mt-2 w-full py-3 rounded-xl bg-violet-600 text-white font-bold"
            >
              위대한 질문 노트에 담기
            </button>
            <button
              onClick={() => navigate("/child/home")}
              className="mt-2 w-full py-3 rounded-xl bg-gray-900 text-white font-bold"
            >
              홈으로 돌아가기
            </button>
          </section>
        )}
        <div ref={bottom} />
      </main>
      {!result && (
        <footer className="fixed bottom-0 inset-x-0 bg-white border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="max-w-2xl mx-auto space-y-2">
            {hasChildQuestion && (
              <button
                onClick={complete}
                disabled={busy}
                className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold disabled:opacity-50"
              >
                내 질문 평가받기
              </button>
            )}
            <button
              type="button"
              onClick={resetChallenge}
              disabled={busy}
              className="w-full py-2 text-sm text-gray-500 underline disabled:opacity-50"
            >
              처음부터 다시 하기
            </button>
            <form onSubmit={send} className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={800}
                placeholder="떠오르는 질문을 자유롭게 써 봐"
                className="flex-1 min-w-0 border rounded-2xl px-4 py-3 text-sm"
              />
              <button
                disabled={busy || input.trim().length < 2}
                className="w-12 rounded-2xl bg-violet-600 text-white grid place-items-center disabled:opacity-40"
              >
                <Send />
              </button>
            </form>
            {hasChildQuestion && (
              <p className="text-center text-xs text-gray-500">
                상황과 이어지는 좋은 질문을 만들면 포인트를 받을 수 있어요.
              </p>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
