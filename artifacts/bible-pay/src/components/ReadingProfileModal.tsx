import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { api } from "@/lib/api";
import { ChildData } from "@/context/AppContext";
import { useToast } from "@/hooks/use-toast";

export function ReadingProfileModal({ child, onClose, onSaved }: { child: ChildData; onClose: () => void; onSaved: () => Promise<void> }) {
  const [grade, setGrade] = useState(child.grade?.toString() ?? "");
  const [readingLevel, setReadingLevel] = useState(child.readingLevel ?? "normal");
  const [aiAnswerLength, setAiAnswerLength] = useState(child.aiAnswerLength ?? "normal");
  const [explainDifficultWords, setExplainDifficultWords] = useState(child.explainDifficultWords ?? true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/children/${child.id}/reading-profile`, {
        grade: grade ? Number(grade) : null,
        readingLevel,
        aiAnswerLength,
        explainDifficultWords,
      });
      await onSaved();
      toast({ title: `${child.name}의 독서 AI 설정을 저장했어요.` });
      onClose();
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6" onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-between items-start mb-5"><div><h2 className="font-black text-xl">독서 AI 설정</h2><p className="text-sm text-gray-500">{child.name} · {child.age}세</p></div><button onClick={onClose} className="p-2 rounded-full bg-gray-100"><X className="w-4 h-4" /></button></div>
        <div className="space-y-4">
          <label className="block text-sm font-bold">학년 (선택)<select value={grade} onChange={(event) => setGrade(event.target.value)} className="mt-1.5 w-full border rounded-xl p-3 font-normal"><option value="">학년 미설정</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}학년</option>)}</select></label>
          <label className="block text-sm font-bold">읽기 수준<select value={readingLevel} onChange={(event) => setReadingLevel(event.target.value as typeof readingLevel)} className="mt-1.5 w-full border rounded-xl p-3 font-normal"><option value="easy">쉬운 설명</option><option value="normal">보통</option><option value="advanced">깊이 있는 설명</option></select></label>
          <label className="block text-sm font-bold">AI 답변 길이<select value={aiAnswerLength} onChange={(event) => setAiAnswerLength(event.target.value as typeof aiAnswerLength)} className="mt-1.5 w-full border rounded-xl p-3 font-normal"><option value="short">짧게</option><option value="normal">보통</option><option value="long">길게</option></select></label>
          <label className="flex items-center justify-between rounded-xl bg-gray-50 p-3 text-sm font-bold">어려운 단어도 설명하기<input type="checkbox" checked={explainDifficultWords} onChange={(event) => setExplainDifficultWords(event.target.checked)} className="w-5 h-5" /></label>
        </div>
        <button onClick={save} disabled={saving} className="mt-6 w-full h-12 rounded-xl bg-gray-900 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">{saving && <Loader2 className="w-4 h-4 animate-spin" />}저장하기</button>
      </div>
    </div>
  );
}
