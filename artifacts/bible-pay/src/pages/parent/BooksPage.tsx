import { useState } from "react";
import { useLocation } from "wouter";
import { BookOpen, Camera, ChevronLeft, Loader2, Search } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from "@/context/AppContext";

type BookDraft = { isbn: string; title: string; author: string | null; publisher: string | null; coverUrl: string | null; description: string | null; metadataSource: string; units?: string[] };

export default function BooksPage() {
  const [, setLocation] = useLocation();
  const { parent, refreshMissions } = useAppContext();
  const { toast } = useToast();
  const [isbn, setIsbn] = useState("");
  const [book, setBook] = useState<BookDraft | null>(null);
  const [unitsText, setUnitsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  if (!parent) { setLocation("/"); return null; }

  const lookup = async () => {
    setLoading(true);
    try {
      const found = await api.get<BookDraft>(`/books/lookup?isbn=${encodeURIComponent(isbn)}`);
      setBook(found);
      setIsbn(found.isbn);
      setUnitsText(found.units?.join("\n") ?? "");
    } catch (error: any) { toast({ title: error.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const extractToc = async (file: File) => {
    if (file.size > 6_000_000 || !/^image\/(jpeg|png|webp)$/i.test(file.type)) { toast({ title: "6MB 이하의 JPG, PNG 또는 WebP 사진을 선택해 주세요.", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const imageDataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      const result = await api.post<{ units: string[] }>("/books/extract-toc", { imageDataUrl });
      setUnitsText(result.units.join("\n"));
      toast({ title: `목차 ${result.units.length}개를 읽었어요. 내용을 확인해 주세요.` });
    } catch (error: any) { toast({ title: error.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const save = async () => {
    if (!book) return;
    const units = unitsText.split("\n").map((line) => line.trim()).filter(Boolean).map((title) => ({ title }));
    if (!units.length) { toast({ title: "목차를 한 줄에 하나씩 입력해 주세요.", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const saved = await api.post<{ id: number }>("/books", { ...book, isbn, units });
      await api.post("/missions", { title: `${book.title} 읽기`, description: "읽은 목차를 선택하고 AI와 질문을 나눠보세요.", type: "book", bookId: saved.id, reward: 0, minRewardPoints: 500, maxRewardPoints: 2000, scheduleType: "daily", requiresPhoto: false, assignToAll: true, isActive: true });
      await refreshMissions();
      toast({ title: "책과 독서 미션을 등록했어요." });
      setLocation("/parent/missions");
    } catch (error: any) { toast({ title: error.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-10">
      <header className="bg-white px-4 py-4 border-b flex items-center gap-3 sticky top-0 z-20"><button onClick={() => setLocation("/parent/dashboard")} className="p-2 rounded-full hover:bg-gray-100"><ChevronLeft /></button><div><h1 className="font-black text-xl">일반도서 등록</h1><p className="text-xs text-gray-500">ISBN 조회 후 부모님이 목차를 확인해 주세요</p></div></header>
      <main className="p-5 max-w-xl mx-auto space-y-5">
        <section className="bg-white rounded-3xl p-5 border shadow-sm">
          <label className="text-sm font-bold">ISBN 10자리 또는 13자리</label>
          <div className="flex gap-2 mt-2"><input value={isbn} onChange={(event) => setIsbn(event.target.value)} placeholder="하이픈 포함 가능" className="flex-1 min-w-0 border rounded-xl px-4 py-3" /><button onClick={lookup} disabled={loading || isbn.trim().length < 10} className="px-4 rounded-xl bg-gray-900 text-white font-bold flex items-center gap-1 disabled:opacity-40">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}조회</button></div>
        </section>
        {book && <section className="bg-white rounded-3xl p-5 border shadow-sm space-y-4">
          <div className="flex gap-4">{book.coverUrl ? <img src={book.coverUrl} alt="책 표지" className="w-20 h-28 object-cover rounded-xl" /> : <div className="w-20 h-28 bg-violet-50 rounded-xl flex items-center justify-center"><BookOpen className="text-violet-400" /></div>}<div className="flex-1"><input value={book.title} onChange={(event) => setBook({ ...book, title: event.target.value })} className="font-black text-lg w-full border-b py-1" /><input value={book.author ?? ""} onChange={(event) => setBook({ ...book, author: event.target.value })} placeholder="저자" className="text-sm text-gray-500 w-full border-b py-2" /><input value={book.publisher ?? ""} onChange={(event) => setBook({ ...book, publisher: event.target.value })} placeholder="출판사" className="text-sm text-gray-500 w-full border-b py-2" /></div></div>
          <div><div className="flex items-center justify-between gap-3"><label className="text-sm font-bold">목차 확인 <span className="text-rose-500">필수</span></label><label className="shrink-0 cursor-pointer rounded-xl bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 flex items-center gap-1"><Camera className="w-4 h-4" />목차 사진 읽기<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={loading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void extractToc(file); event.target.value = ""; }} /></label></div><p className="text-xs text-gray-500 mt-1">자동 조회된 목차를 확인하거나, 목차 페이지 사진을 올려 주세요. 한 줄에 하나씩 수정할 수 있어요.</p><textarea value={unitsText} onChange={(event) => setUnitsText(event.target.value)} rows={9} placeholder={"1장 주인공을 만나다\n2장 새로운 모험\n3장 중요한 선택"} className="mt-2 w-full border rounded-xl p-3 text-sm" /></div>
          <label className="flex gap-2 items-start text-xs text-gray-600 bg-amber-50 p-3 rounded-xl"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5" />책 정보와 목차가 실제 책과 맞는지 부모가 확인했습니다.</label>
          <button onClick={save} disabled={loading || !unitsText.trim() || !confirmed} className="w-full h-12 rounded-xl bg-violet-500 text-white font-bold disabled:opacity-40">책 등록하고 미션 만들기</button>
        </section>}
      </main>
    </div>
  );
}
