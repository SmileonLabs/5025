import { ChevronRight } from "lucide-react";
import type { MissionLog } from "@/context/AppContext";

const STATUS_BADGE: Record<MissionLog["status"], { label: string; cls: string }> = {
  completed: { label: "완료", cls: "bg-green-100 text-green-700" },
  approved: { label: "승인 완료", cls: "bg-green-100 text-green-700" },
  requested: { label: "승인 대기", cls: "bg-orange-100 text-orange-700" },
  rejected: { label: "반려", cls: "bg-red-100 text-red-600" },
};

const TYPE_EMOJI: Record<string, string> = { bible: "📖", activity: "🔍" };

function dayKey(dateStr: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(dateStr));
}

function dayLabel(key: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
  const today = fmt.format(new Date());
  const yesterday = fmt.format(new Date(Date.now() - 86_400_000));
  if (key === today) return "오늘";
  if (key === yesterday) return "어제";
  const [, m, d] = key.split("-");
  return `${parseInt(m, 10)}월 ${parseInt(d, 10)}일`;
}

function timeLabel(dateStr: string): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric", minute: "2-digit" }).format(new Date(dateStr));
}

export function MissionLogList({ logs, showChild = false, onSelect }: {
  logs: MissionLog[];
  showChild?: boolean;
  onSelect: (log: MissionLog) => void;
}) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">🗒️</div>
        <p className="font-bold text-gray-700">아직 수행한 미션이 없어요</p>
        <p className="text-sm text-gray-400 mt-1">미션을 완료하면 여기에 기록돼요</p>
      </div>
    );
  }

  // 서버가 createdAt desc로 정렬해 보내므로 순서를 유지하며 날짜별로 묶는다 (Asia/Seoul).
  const groups: { key: string; items: MissionLog[] }[] = [];
  for (const log of logs) {
    const k = dayKey(log.createdAt);
    const g = groups.find(x => x.key === k);
    if (g) g.items.push(log);
    else groups.push({ key: k, items: [log] });
  }

  return (
    <div className="space-y-5">
      {groups.map(group => (
        <div key={group.key}>
          <p className="text-xs font-bold text-gray-400 mb-2 px-1">{dayLabel(group.key)}</p>
          <div className="space-y-2">
            {group.items.map(log => {
              const badge = STATUS_BADGE[log.status];
              return (
                <button
                  key={log.id}
                  onClick={() => onSelect(log)}
                  className="w-full bg-white rounded-[18px] p-3.5 border border-gray-100 shadow-sm flex items-center gap-3 text-left hover:border-primary/30 transition-colors"
                  data-testid={`log-row-${log.id}`}
                >
                  <div className="w-10 h-10 rounded-[12px] bg-gray-50 flex items-center justify-center text-xl shrink-0">
                    {showChild && log.child ? log.child.avatar : (TYPE_EMOJI[log.mission.type] ?? "✅")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-gray-900 text-sm truncate">{log.mission.title}</p>
                      <span className={`shrink-0 text-[10px] font-bold rounded-full px-1.5 py-0.5 ${badge.cls}`}>{badge.label}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {showChild && log.child ? `${log.child.name} · ` : ""}{timeLabel(log.createdAt)}
                    </p>
                  </div>
                  {log.status !== "rejected" && (
                    <span className="text-sm font-black text-emerald-500 shrink-0 tabular-nums">+{log.rewardAmount.toLocaleString("ko-KR")}P</span>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
