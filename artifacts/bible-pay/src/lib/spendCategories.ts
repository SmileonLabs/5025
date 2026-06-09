export interface SpendCategory {
  label: string;
  emoji: string;
}

export const SPEND_CATEGORIES: SpendCategory[] = [
  { label: "간식 사 먹기", emoji: "🍔" },
  { label: "학용품 사기", emoji: "✏️" },
  { label: "선물 사기", emoji: "🎁" },
  { label: "장난감 사기", emoji: "🎮" },
  { label: "친구한테 쓰기", emoji: "💛" },
  { label: "기타", emoji: "🛍️" },
];

export function categoryEmoji(category?: string | null): string {
  if (!category) return "🛍️";
  return SPEND_CATEGORIES.find(c => c.label === category)?.emoji ?? "🛍️";
}
