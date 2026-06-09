import { useState, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { ChevronLeft, Search, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "@/context/AppContext";
import { BIBLE_BOOKS, OLD_TESTAMENT, NEW_TESTAMENT, type BibleBook } from "@/data/bibleBooks";
import { Button } from "@/components/ui/button";

type Step = "book" | "chapter";

export default function BibleChapterPage() {
  const [_, setLocation] = useLocation();
  const params = useParams<{ missionId: string }>();
  const { currentChild, missions } = useAppContext();

  const missionId = parseInt(params.missionId, 10);
  const mission = missions.find(m => m.id === missionId);

  const [testament, setTestament] = useState<"old" | "new">("new");
  const [search, setSearch] = useState("");
  const [step, setStep] = useState<Step>("book");
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);

  if (!currentChild) { setLocation("/login"); return null; }
  if (!mission) { setLocation("/child/missions"); return null; }

  const books = testament === "old" ? OLD_TESTAMENT : NEW_TESTAMENT;

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return books;
    return BIBLE_BOOKS.filter(b => b.name.includes(q) || b.abbr.includes(q));
  }, [search, books]);

  const handleBookSelect = (book: BibleBook) => {
    setSelectedBook(book);
    setStep("chapter");
  };

  const handleChapterSelect = (chapter: number) => {
    if (!selectedBook) return;
    setLocation(`/child/quiz/${missionId}?book=${encodeURIComponent(selectedBook.name)}&chapter=${chapter}`);
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col">
      <div className="bg-white px-4 py-4 flex items-center border-b border-gray-100 sticky top-0 z-40">
        <button
          onClick={() => step === "chapter" ? setStep("book") : setLocation("/child/missions")}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-full mr-2"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">
            {step === "book" ? "성경 책 선택" : `${selectedBook?.name} — 장 선택`}
          </h1>
          <p className="text-xs text-gray-400">{mission.title} · +{mission.reward.toLocaleString("ko-KR")}원</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {step === "book" && (
            <motion.div key="book" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <div className="px-4 pt-4 pb-2 sticky top-0 bg-gray-50 z-10">
                <div className="relative mb-3">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="책 이름으로 검색..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-[14px] border border-gray-200 bg-white text-sm font-medium focus:outline-none focus:border-primary"
                  />
                </div>

                {!search && (
                  <div className="flex bg-gray-100 p-1 rounded-full mb-2">
                    <button
                      onClick={() => setTestament("new")}
                      className={`flex-1 py-1.5 text-sm font-bold rounded-full transition-all ${testament === "new" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
                    >
                      신약 ({NEW_TESTAMENT.length})
                    </button>
                    <button
                      onClick={() => setTestament("old")}
                      className={`flex-1 py-1.5 text-sm font-bold rounded-full transition-all ${testament === "old" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
                    >
                      구약 ({OLD_TESTAMENT.length})
                    </button>
                  </div>
                )}
              </div>

              <div className="px-4 pb-8 grid grid-cols-2 gap-2.5">
                {filtered.map(book => (
                  <button
                    key={book.name}
                    onClick={() => handleBookSelect(book)}
                    className="bg-white rounded-[16px] p-4 border border-gray-100 shadow-sm flex items-center justify-between hover:border-primary/40 hover:bg-primary/5 transition-all active:scale-95 text-left"
                  >
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{book.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{book.chapters}장</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === "chapter" && selectedBook && (
            <motion.div key="chapter" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="px-4 py-4 pb-8">
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-[20px] p-4 mb-5 text-center">
                <p className="text-3xl mb-1">📖</p>
                <p className="font-bold text-gray-800">{selectedBook.name}</p>
                <p className="text-sm text-gray-500">읽은 장을 선택해주세요</p>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: selectedBook.chapters }, (_, i) => i + 1).map(ch => (
                  <button
                    key={ch}
                    onClick={() => handleChapterSelect(ch)}
                    className="aspect-square rounded-[12px] bg-white border border-gray-100 shadow-sm font-bold text-gray-800 text-sm hover:border-primary hover:bg-primary/5 hover:text-primary-foreground transition-all active:scale-95"
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
