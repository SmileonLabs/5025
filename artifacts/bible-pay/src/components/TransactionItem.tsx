import { Book, Coins } from "lucide-react";
import { formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { ko } from "date-fns/locale";

interface TransactionItemProps {
  description: string;
  amount: number;
  date: string;
  type: "mission" | "charge";
}

export function TransactionItem({ description, amount, date, type }: TransactionItemProps) {
  const isPositive = amount > 0;
  
  const formattedDate = () => {
    const d = new Date(date);
    if (isToday(d)) return "오늘";
    if (isYesterday(d)) return "어제";
    return formatDistanceToNow(d, { addSuffix: true, locale: ko });
  };

  return (
    <div className="flex items-center gap-4 py-4 border-b border-gray-50 last:border-0" data-testid="transaction-item">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
        type === 'mission' ? 'bg-secondary/30 text-secondary-foreground' : 'bg-accent/30 text-accent-foreground'
      }`}>
        {type === 'mission' ? <Book className="w-6 h-6" /> : <Coins className="w-6 h-6" />}
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-gray-900 truncate">{description}</h4>
        <p className="text-xs text-gray-500">{formattedDate()}</p>
      </div>
      
      <div className={`font-bold text-lg whitespace-nowrap ${isPositive ? 'text-primary-foreground' : 'text-gray-900'}`}>
        {isPositive ? '+' : ''}{amount.toLocaleString('ko-KR')}원
      </div>
    </div>
  );
}
