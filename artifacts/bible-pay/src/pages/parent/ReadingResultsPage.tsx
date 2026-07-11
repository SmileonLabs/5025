import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, Loader2, MessageCircle, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAppContext } from "@/context/AppContext";
import { useToast } from "@/hooks/use-toast";

type Evaluation = { relevanceScore: number; specificityScore: number; reasoningScore: number; selfExpressionScore: number; followUpScore: number; reason: string };
type Result = { id: number; childId: number; childName: string; childAvatar: string; missionTitle: string; sourceLabel: string; status: "in_progress" | "failed" | "completed" | "abandoned"; rewardPoints: number; evaluationReason: string | null; evaluation: Evaluation | null; childMessageCount: number; offTopicCount: number; startedAt: string; completedAt: string | null };
type Detail = Result & { messages: { id: number; role: "child" | "assistant"; content: string; createdAt: string }[] };

const statusMeta = { completed: ["완료", "bg-green-50 text-green-700"], failed: ["미완료", "bg-rose-50 text-rose-700"], in_progress: ["진행 중", "bg-blue-50 text-blue-700"], abandoned: ["중단", "bg-gray-100 text-gray-600"] } as const;

export default function ReadingResultsPage() {
  const [, setLocation] = useLocation();
  const { parent, children } = useAppContext();
  const { toast } = useToast();
  const [childId, setChildId] = useState<number | "all">("all");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Detail | null>(null);
  if (!parent) { setLocation("/"); return null; }

  useEffect(() => {
    setLoading(true);
    api.get<Result[]>(`/reading/results${childId === "all" ? "" : `?childId=${childId}`}`).then(setResults).catch((error) => toast({ title: error.message, variant: "destructive" })).finally(() => setLoading(false));
  }, [childId, toast]);

  const openDetail = async (id: number) => {
    try { setDetail(await api.get<Detail>(`/reading/results/${id}`)); }
    catch (error: any) { toast({ title: error.message, variant: "destructive" }); }
  };

  return <div className="min-h-[100dvh] bg-gray-50 pb-10">
    <header className="bg-white px-4 py-4 border-b flex items-center gap-3 sticky top-0 z-20"><button onClick={() => setLocation("/parent/dashboard")} className="p-2 rounded-full hover:bg-gray-100"><ChevronLeft /></button><div><h1 className="font-black text-xl">AI 독서 결과</h1><p className="text-xs text-gray-500">질문 내용과 포인트 평가를 확인해요</p></div></header>
    <main className="p-5 max-w-xl mx-auto">
      <div className="flex gap-2 overflow-x-auto pb-4"><button onClick={() => setChildId("all")} className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold ${childId === "all" ? "bg-gray-900 text-white" : "bg-white border"}`}>전체</button>{children.map((child) => <button key={child.id} onClick={() => setChildId(child.id)} className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold ${childId === child.id ? "bg-gray-900 text-white" : "bg-white border"}`}>{child.avatar} {child.name}</button>)}</div>
      {loading ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin" /></div> : results.length === 0 ? <div className="bg-white rounded-3xl p-10 text-center text-gray-500"><MessageCircle className="mx-auto mb-3 text-gray-300" /><p className="font-bold">아직 독서 대화 결과가 없어요.</p></div> : <div className="space-y-3">{results.map((result) => { const meta = statusMeta[result.status]; return <button key={result.id} onClick={() => openDetail(result.id)} className="w-full bg-white rounded-2xl border p-4 text-left shadow-sm flex items-center gap-3"><div className="w-11 h-11 rounded-full bg-gray-50 flex items-center justify-center text-xl">{result.childAvatar}</div><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="font-bold text-sm">{result.childName}</span><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${meta[1]}`}>{meta[0]}</span></div><p className="font-bold truncate mt-1">{result.sourceLabel}</p><p className="text-xs text-gray-400 mt-1">{new Date(result.startedAt).toLocaleString("ko-KR")} · 질문 {result.childMessageCount}회</p></div><div className="text-right"><p className={`font-black ${result.rewardPoints ? "text-green-600" : "text-gray-400"}`}>{result.rewardPoints.toLocaleString("ko-KR")}P</p><ChevronRight className="ml-auto mt-2 w-4 h-4 text-gray-300" /></div></button>; })}</div>}
    </main>
    {detail && <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setDetail(null)}><section className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl max-h-[90dvh] overflow-y-auto p-5" onClick={(event) => event.stopPropagation()}><div className="flex justify-between"><div><h2 className="font-black text-lg">{detail.sourceLabel}</h2><p className="text-xs text-gray-500">{detail.childName} · {detail.missionTitle}</p></div><button onClick={() => setDetail(null)} className="p-2 bg-gray-100 rounded-full"><X className="w-4 h-4" /></button></div><div className={`mt-4 rounded-2xl p-4 ${detail.status === "completed" ? "bg-green-50" : "bg-rose-50"}`}><p className="font-black">{detail.status === "completed" ? `${detail.rewardPoints.toLocaleString("ko-KR")}P 지급` : "0P · 미션 미완료"}</p><p className="text-sm text-gray-600 mt-1">{detail.evaluationReason ?? detail.evaluation?.reason ?? "평가 전입니다."}</p>{detail.evaluation && <div className="grid grid-cols-5 gap-1 mt-3 text-center">{[["관련",detail.evaluation.relevanceScore],["구체",detail.evaluation.specificityScore],["생각",detail.evaluation.reasoningScore],["표현",detail.evaluation.selfExpressionScore],["후속",detail.evaluation.followUpScore]].map(([label, score]) => <div key={String(label)} className="bg-white/70 rounded-lg p-1.5"><p className="font-black">{score}/2</p><p className="text-[10px] text-gray-500">{label}</p></div>)}</div>}</div><h3 className="font-bold mt-5 mb-3">대화 내용</h3><div className="space-y-2">{detail.messages.map((message) => <div key={message.id} className={`flex ${message.role === "child" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${message.role === "child" ? "bg-violet-500 text-white" : "bg-gray-100"}`}>{message.content}</div></div>)}</div></section></div>}
  </div>;
}
