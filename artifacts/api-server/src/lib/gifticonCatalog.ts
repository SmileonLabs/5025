/**
 * Server-side gifticon catalog. The price is authoritative here — clients only
 * ever send a `catalogItemId`, never a price, so the deduction can't be tampered
 * with. `price` includes the operator's margin over `faceValue` (Stripe fees +
 * the cost of buying the real gifticon), so price >= faceValue.
 *
 * MVP uses generic, non-trademarked categories with emoji art to avoid brand
 * logo/copyright issues. Swap to real branded items once a B2B issuance契약
 * exists.
 */
export interface GifticonCatalogItem {
  id: string;
  brand: string;
  productName: string;
  faceValue: number;
  price: number;
  emoji: string;
}

export const GIFTICON_CATALOG: readonly GifticonCatalogItem[] = [
  { id: "icecream-3000", brand: "아이스크림 가게", productName: "3천원 교환권", faceValue: 3000, price: 3200, emoji: "🍦" },
  { id: "cvs-5000", brand: "편의점", productName: "5천원 금액권", faceValue: 5000, price: 5300, emoji: "🏪" },
  { id: "cafe-5000", brand: "카페", productName: "음료 교환권", faceValue: 5000, price: 5300, emoji: "☕" },
  { id: "stationery-5000", brand: "문구점", productName: "5천원 금액권", faceValue: 5000, price: 5300, emoji: "✏️" },
  { id: "burger-8000", brand: "햄버거 가게", productName: "버거 세트", faceValue: 8000, price: 8400, emoji: "🍔" },
  { id: "bakery-10000", brand: "베이커리", productName: "1만원 금액권", faceValue: 10000, price: 10500, emoji: "🥐" },
  { id: "book-10000", brand: "서점", productName: "도서 상품권", faceValue: 10000, price: 10500, emoji: "📚" },
  { id: "movie-12000", brand: "영화관", productName: "영화 관람권", faceValue: 12000, price: 12600, emoji: "🎬" },
  { id: "pizza-15000", brand: "피자 가게", productName: "라지 피자", faceValue: 15000, price: 15700, emoji: "🍕" },
  { id: "chicken-20000", brand: "치킨", productName: "치킨 1마리", faceValue: 20000, price: 21000, emoji: "🍗" },
];

export function getCatalogItem(id: string): GifticonCatalogItem | undefined {
  return GIFTICON_CATALOG.find((item) => item.id === id);
}
