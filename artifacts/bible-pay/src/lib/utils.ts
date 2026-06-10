import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Points credited per KRW paid at top-up time (1,000원 → 10,000P). */
export const POINTS_PER_KRW = 10

/** Format a points amount for display, e.g. 10000 → "10,000P". */
export function formatPoints(n: number): string {
  return `${n.toLocaleString("ko-KR")}P`
}
