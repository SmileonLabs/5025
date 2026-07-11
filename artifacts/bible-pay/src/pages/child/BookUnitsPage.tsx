import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { BookOpen, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAppContext } from "@/context/AppContext";
import { useToast } from "@/hooks/use-toast";

type ReadingUnit = { id: number; title: string; unitOrder: number; pageFrom: number | null; pageTo: number | null };
type Book = { id: number; title: string; author: string | null; coverUrl: string | null; units: ReadingUnit[] };

export default function BookUnitsPage() {
  const [, setLocation] = useLocation();
  const { missionId: missionIdParam } = useParams<{ missionId: string }>();
  const { currentChild, missions } = useAppContext();
  const { toast } = useToast();
  const missionId = Number(missionIdParam);
  const mission = missions.find((item) => item.id === missionId);
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentChild || !mission?.bookId) return;
    api.get<Book[]>("/books").then((books) => setBook(books.find((item) => item.id === mission.bookId) ?? null)).catch((error) => toast({ title: error.message, variant: "destructive" })).finally(() => setLoading(false));
  }, [currentChild, mission?.bookId, toast]);

  if (!currentChild) { setLocation("/login"); return null; }
  if (!mission?.bookId) { setLocation("/child/missions"); return null; }

  return <div className="min-h-[100dvh] bg-gray-50">
    <header className="bg-white px-4 py-4 border-b flex items-center gap-3 sticky top-0 z-20"><button onClick={() => setLocation("/child/missions")} className="p-2 rounded-full hover:bg-gray-100"><ChevronLeft /></button><div><h1 className="font-black text-lg">읽은 목차 선택</h1><p className="text-xs text-gray-500">선택한 뒤 AI와 질문을 나눠요</p></div></header>
    <main className="p-5 max-w-xl mx-auto">
      {loading ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-violet-500" /></div> : !book ? <div className="bg-white rounded-2xl p-6 text-center text-gray-500">등록된 책을 불러오지 못했어요.</div> : <>
        <section className="bg-gradient-to-br from-violet-50 to-blue-50 rounded-3xl p-5 flex gap-4 items-center mb-5">{book.coverUrl ? <img src={book.coverUrl} alt="책 표지" className="w-20 h-28 object-cover rounded-xl shadow" /> : <div className="w-20 h-28 bg-white rounded-xl flex items-center justify-center"><BookOpen className="text-violet-400" /></div>}<div><h2 className="font-black text-lg">{book.title}</h2>{book.author && <p className="text-sm text-gray-500 mt-1">{book.author}</p>}<p className="text-xs text-violet-600 font-bold mt-3">좋은 질문 500~2,000P</p></div></section>
        <div className="space-y-2">{book.units.map((unit) => <button key={unit.id} onClick={() => setLocation(`/child/reading/${missionId}?type=book&bookId=${book.id}&unitId=${unit.id}&title=${encodeURIComponent(unit.title)}`)} className="w-full bg-white border rounded-2xl p-4 flex items-center text-left shadow-sm active:scale-[0.98]"><span className="w-8 h-8 rounded-full bg-violet-50 text-violet-600 font-black text-sm flex items-center justify-center mr-3">{unit.unitOrder}</span><div className="flex-1"><p className="font-bold text-sm">{unit.title}</p>{unit.pageFrom && <p className="text-xs text-gray-400 mt-0.5">{unit.pageFrom}~{unit.pageTo ?? unit.pageFrom}쪽</p>}</div><ChevronRight className="w-4 h-4 text-gray-300" /></button>)}</div>
      </>}
    </main>
  </div>;
}
