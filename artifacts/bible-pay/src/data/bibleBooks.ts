export interface BibleBook {
  name: string;
  chapters: number;
  testament: "old" | "new";
  abbr: string;
}

export const BIBLE_BOOKS: BibleBook[] = [
  { name: "창세기", chapters: 50, testament: "old", abbr: "창" },
  { name: "출애굽기", chapters: 40, testament: "old", abbr: "출" },
  { name: "레위기", chapters: 27, testament: "old", abbr: "레" },
  { name: "민수기", chapters: 36, testament: "old", abbr: "민" },
  { name: "신명기", chapters: 34, testament: "old", abbr: "신" },
  { name: "여호수아", chapters: 24, testament: "old", abbr: "수" },
  { name: "사사기", chapters: 21, testament: "old", abbr: "삿" },
  { name: "룻기", chapters: 4, testament: "old", abbr: "룻" },
  { name: "사무엘상", chapters: 31, testament: "old", abbr: "삼상" },
  { name: "사무엘하", chapters: 24, testament: "old", abbr: "삼하" },
  { name: "열왕기상", chapters: 22, testament: "old", abbr: "왕상" },
  { name: "열왕기하", chapters: 25, testament: "old", abbr: "왕하" },
  { name: "역대상", chapters: 29, testament: "old", abbr: "대상" },
  { name: "역대하", chapters: 36, testament: "old", abbr: "대하" },
  { name: "에스라", chapters: 10, testament: "old", abbr: "스" },
  { name: "느헤미야", chapters: 13, testament: "old", abbr: "느" },
  { name: "에스더", chapters: 10, testament: "old", abbr: "에" },
  { name: "욥기", chapters: 42, testament: "old", abbr: "욥" },
  { name: "시편", chapters: 150, testament: "old", abbr: "시" },
  { name: "잠언", chapters: 31, testament: "old", abbr: "잠" },
  { name: "전도서", chapters: 12, testament: "old", abbr: "전" },
  { name: "아가", chapters: 8, testament: "old", abbr: "아" },
  { name: "이사야", chapters: 66, testament: "old", abbr: "사" },
  { name: "예레미야", chapters: 52, testament: "old", abbr: "렘" },
  { name: "예레미야애가", chapters: 5, testament: "old", abbr: "애" },
  { name: "에스겔", chapters: 48, testament: "old", abbr: "겔" },
  { name: "다니엘", chapters: 12, testament: "old", abbr: "단" },
  { name: "호세아", chapters: 14, testament: "old", abbr: "호" },
  { name: "요엘", chapters: 3, testament: "old", abbr: "욜" },
  { name: "아모스", chapters: 9, testament: "old", abbr: "암" },
  { name: "오바댜", chapters: 1, testament: "old", abbr: "옵" },
  { name: "요나", chapters: 4, testament: "old", abbr: "욘" },
  { name: "미가", chapters: 7, testament: "old", abbr: "미" },
  { name: "나훔", chapters: 3, testament: "old", abbr: "나" },
  { name: "하박국", chapters: 3, testament: "old", abbr: "합" },
  { name: "스바냐", chapters: 3, testament: "old", abbr: "습" },
  { name: "학개", chapters: 2, testament: "old", abbr: "학" },
  { name: "스가랴", chapters: 14, testament: "old", abbr: "슥" },
  { name: "말라기", chapters: 4, testament: "old", abbr: "말" },
  { name: "마태복음", chapters: 28, testament: "new", abbr: "마" },
  { name: "마가복음", chapters: 16, testament: "new", abbr: "막" },
  { name: "누가복음", chapters: 24, testament: "new", abbr: "눅" },
  { name: "요한복음", chapters: 21, testament: "new", abbr: "요" },
  { name: "사도행전", chapters: 28, testament: "new", abbr: "행" },
  { name: "로마서", chapters: 16, testament: "new", abbr: "롬" },
  { name: "고린도전서", chapters: 16, testament: "new", abbr: "고전" },
  { name: "고린도후서", chapters: 13, testament: "new", abbr: "고후" },
  { name: "갈라디아서", chapters: 6, testament: "new", abbr: "갈" },
  { name: "에베소서", chapters: 6, testament: "new", abbr: "엡" },
  { name: "빌립보서", chapters: 4, testament: "new", abbr: "빌" },
  { name: "골로새서", chapters: 4, testament: "new", abbr: "골" },
  { name: "데살로니가전서", chapters: 5, testament: "new", abbr: "살전" },
  { name: "데살로니가후서", chapters: 3, testament: "new", abbr: "살후" },
  { name: "디모데전서", chapters: 6, testament: "new", abbr: "딤전" },
  { name: "디모데후서", chapters: 4, testament: "new", abbr: "딤후" },
  { name: "디도서", chapters: 3, testament: "new", abbr: "딛" },
  { name: "빌레몬서", chapters: 1, testament: "new", abbr: "몬" },
  { name: "히브리서", chapters: 13, testament: "new", abbr: "히" },
  { name: "야고보서", chapters: 5, testament: "new", abbr: "약" },
  { name: "베드로전서", chapters: 5, testament: "new", abbr: "벧전" },
  { name: "베드로후서", chapters: 3, testament: "new", abbr: "벧후" },
  { name: "요한일서", chapters: 5, testament: "new", abbr: "요일" },
  { name: "요한이서", chapters: 1, testament: "new", abbr: "요이" },
  { name: "요한삼서", chapters: 1, testament: "new", abbr: "요삼" },
  { name: "유다서", chapters: 1, testament: "new", abbr: "유" },
  { name: "요한계시록", chapters: 22, testament: "new", abbr: "계" },
];

export const OLD_TESTAMENT = BIBLE_BOOKS.filter(b => b.testament === "old");
export const NEW_TESTAMENT = BIBLE_BOOKS.filter(b => b.testament === "new");

export function getBook(name: string): BibleBook | undefined {
  return BIBLE_BOOKS.find(b => b.name === name);
}
