/** Ringkasan satu baris hasil ronde (netral, tanpa bahasa "untung/rugi"). */
export function summarizeOutcome(slug: string, o: any, t: (k: string, p?: Record<string, string | number>) => string): string {
  if (!o) return "";
  switch (slug) {
    case "virtual-slots":
      return (o.reels as string[]).map((r) => t(`slots.symbols.${r}`)).join(" · ") + (o.multiplier ? ` — ${o.multiplier}×` : "");
    case "euro-roulette":
      return `${o.number} (${t(`roulette.colors.${o.color}`)}) · ${o.bets?.length ?? 0} ${t("roulette.betsCount")}`;
    case "dice-duel":
      return `${t("dice.roll")} ${o.roll} · ${t(`dice.${o.mode}`)} ${o.target} · ${o.win ? t("dice.hit") : t("dice.miss")}`;
    case "blackjack-21":
      return `${t(`blackjack.results.${o.result}`)} · ${o.playerTotal} vs ${o.dealerTotal}${o.doubled ? ` · ${t("blackjack.doubled")}` : ""}`;
    default:
      return "";
  }
}

export const signed = (n: number, fmt: (v: number) => string) => (n > 0 ? "+" : n < 0 ? "−" : "") + fmt(Math.abs(n));
