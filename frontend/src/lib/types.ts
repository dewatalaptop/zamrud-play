import type { Loc } from "./api";

export interface GameInfo {
  slug: string; category: "SLOTS" | "WHEEL" | "CARDS" | "DICE"; kind: "INSTANT" | "INTERACTIVE"; tags: string[]; difficulty: string;
  name: Loc; description: Loc; configVersion: number; rules: any;
}
export interface Recommendation { slug: string; score: number; reason: { key: string; params: Record<string, string> }; category: string; name: Loc; description: Loc; }
export interface RoundView<V = any> {
  sessionId: string; game: string; status: "ACTIVE" | "COMPLETED"; stake: number; payout: number; net: number | null; seq: number;
  configVersion: number; view: V; balance: number; replay?: boolean;
}
export interface HistoryItem {
  sessionId: string; game: string; name: Loc; stake: number; payout: number; net: number; outcome: any; configVersion: number; createdAt: string;
}
export interface Mission {
  id: string; key: string; period: "DAILY" | "WEEKLY" | "ONCE"; metric: string; target: number; rewardCoins: number;
  title: Loc; description: Loc; periodKey: string; progress: number; completed: boolean; claimed: boolean;
}
export interface Achievement {
  id: string; key: string; icon: string; metric: string; threshold: number; name: Loc; description: Loc; progress: number; unlockedAt: string | null;
}
export interface Tx { id: string; type: string; amount: number; balanceAfter: number; sessionId: string | null; meta: Record<string, any>; note: string | null; createdAt: string; }
export interface Paged<T> { items: T[]; nextCursor: string | null; }
export const CATEGORIES = ["SLOTS", "WHEEL", "CARDS", "DICE"] as const;
export const TAGS = ["luck", "quick", "visual", "classic", "strategy", "cards", "numbers"] as const;
