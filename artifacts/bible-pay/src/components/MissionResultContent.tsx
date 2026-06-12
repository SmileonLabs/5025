import { CheckCircle2, PenLine, Camera } from "lucide-react";
import type { QuizQuestion } from "@/context/AppContext";
import { apiUrl } from "@/lib/api";

// 미션 수행 "증거"(성경 구절·퀴즈·묵상·인증샷)만 담는 프레젠테이션 컴포넌트.
// 상태/금액/일시 등 메타는 이를 감싸는 모달이 담당한다.
export interface MissionResultView {
  missionType: string | null;
  bibleBook: string | null;
  bibleChapter: number | null;
  reflection: string | null;
  quiz: QuizQuestion[] | null;
  photoUrl: string | null;
}

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const hours = d.getHours();
  const ampm = hours < 12 ? "오전" : "오후";
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${ampm} ${h12}:${mm}`;
}

const OPTION_MARK = ["①", "②", "③", "④", "⑤", "⑥"];

export function MissionResultContent({ data }: { data: MissionResultView }) {
  const passage = data.bibleBook && data.bibleChapter ? `${data.bibleBook} ${data.bibleChapter}장` : null;
  const quiz = data.quiz ?? [];
  const hasQuiz = quiz.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {passage && (
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-[18px] p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-[12px] bg-white/70 flex items-center justify-center shrink-0">
            <span className="text-xl">📖</span>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400">읽은 성경</p>
            <p className="font-black text-gray-900">{passage}</p>
          </div>
        </div>
      )}

      {hasQuiz ? (
        <div className="flex flex-col gap-2">
          <div className="inline-flex items-center gap-1.5 self-start bg-green-50 text-green-700 rounded-full px-3 py-1 text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            성경 퀴즈 {quiz.length}문제 통과
          </div>
          {quiz.map((q, qi) => (
            <div key={qi} className="bg-white rounded-[18px] p-4 border-2 border-gray-100" data-testid={`quiz-item-${qi}`}>
              <p className="text-sm font-bold text-gray-800 mb-2.5 leading-snug">
                <span className="text-primary-foreground">Q{qi + 1}.</span> {q.question}
              </p>
              <div className="flex flex-col gap-1.5">
                {q.options.map((opt, oi) => {
                  const correct = oi === q.correctIndex;
                  return (
                    <div
                      key={oi}
                      className={`flex items-center gap-2 rounded-[12px] px-3 py-2 text-sm ${
                        correct ? "bg-green-50 text-green-800 font-bold" : "bg-gray-50 text-gray-500"
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${correct ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"}`}>
                        {OPTION_MARK[oi] ?? oi + 1}
                      </span>
                      <span className="flex-1">{opt}</span>
                      {correct && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        data.missionType === "bible" && data.reflection && (
          // 구버전 로그(quiz 미저장)는 통과 배지로 폴백
          <div className="inline-flex items-center gap-1.5 self-start bg-green-50 text-green-700 rounded-full px-3 py-1 text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            성경 퀴즈 통과
          </div>
        )
      )}

      {data.reflection && (
        <div className="bg-white rounded-[18px] p-4 border-2 border-gray-100">
          <div className="flex items-center gap-1.5 mb-2">
            <PenLine className="w-4 h-4 text-primary-foreground" />
            <span className="text-sm font-bold text-gray-800">묵상 노트</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{data.reflection}</p>
        </div>
      )}

      {data.photoUrl && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-primary-foreground" />
            <span className="text-sm font-bold text-gray-800">인증샷</span>
          </div>
          <img
            src={apiUrl(`/storage${data.photoUrl}`)}
            alt="인증샷"
            className="w-full max-h-72 object-cover rounded-[16px] border border-gray-100"
            data-testid="result-photo"
          />
        </div>
      )}
    </div>
  );
}
