import { BookOpen, Coins, ShoppingBag, ChevronRight } from "lucide-react";
import { TransactionType } from "@/context/AppContext";
import { categoryEmoji } from "@/lib/spendCategories";

interface TransactionItemProps {
  description: string;
  amount: number;
  date: string;
  type: TransactionType;
  category?: string | null;
  onClick?: () => void;
}

const TYPE_CONFIG: Record<TransactionType, { icon: React.ComponentType<{ className?: string }>, bgClass: string, iconClass: string, emoji: string }> = {
  mission: { icon: BookOpen, bgClass: "bg-green-50", iconClass: "text-green-600", emoji: "📖" },
  charge:  { icon: Coins,    bgClass: "bg-blue-50",  iconClass: "text-blue-500",  emoji: "💰" },
  spend:   { icon: ShoppingBag, bgClass: "bg-red-50", iconClass: "text-red-400", emoji: "🛍️" },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function TransactionItem({ description, amount, date, type, category, onClick }: TransactionItemProps) {
  const isPositive = amount > 0;
  const config = TYPE_CONFIG[type];
  const Icon = config.icon;
  const showCategoryEmoji = type === "spend" && !!category;
  const clickable = !!onClick;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`w-full flex items-center gap-3 py-3.5 border-b border-gray-50 last:border-0 text-left ${clickable ? "active:bg-gray-50 transition-colors -mx-1 px-1 rounded-xl" : ""}`}
      data-testid="transaction-item"
    >
      <div className={`w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0 ${config.bgClass}`}>
        {showCategoryEmoji ? (
          <span className="text-xl">{categoryEmoji(category)}</span>
        ) : (
          <Icon className={`w-5 h-5 ${config.iconClass}`} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm truncate">{description}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {formatDate(date)}{showCategoryEmoji ? ` · ${category}` : ""}
        </p>
      </div>

      <div className={`font-black text-base whitespace-nowrap tabular-nums ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
        {isPositive ? "+" : ""}{amount.toLocaleString("ko-KR")}원
      </div>

      {clickable && <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />}
    </button>
  );
}
