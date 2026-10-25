import { useI18n } from "../i18n";
import type { HistoryItem } from "../lib/types";
import { signed, summarizeOutcome } from "../lib/outcome";
import { CoinIcon } from "./ui";

/** Tabel riwayat; di layar kecil berubah menjadi daftar kartu. */
export function GameHistoryTable({ items }: { items: HistoryItem[] }) {
  const { t, tl, n, date } = useI18n();
  const net = (v: number) => <span className={`num font-bold ${v > 0 ? "text-ok" : v < 0 ? "text-muted" : ""}`}>{signed(v, n)}</span>;
  return (
    <>
      <div className="hidden overflow-x-auto md:block scroll-thin">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{t("history.title")}</caption>
          <thead className="text-xs uppercase tracking-wide text-faint">
            <tr><th scope="col" className="py-2 pr-3">{t("history.time")}</th><th scope="col" className="pr-3">{t("history.game")}</th><th scope="col" className="pr-3">{t("history.result")}</th>
              <th scope="col" className="pr-3 text-right">{t("history.stake")}</th><th scope="col" className="pr-3 text-right">{t("history.payout")}</th><th scope="col" className="text-right">{t("history.net")}</th></tr>
          </thead>
          <tbody>
            {items.map((h) => (
              <tr key={h.sessionId} className="border-t border-line">
                <td className="whitespace-nowrap py-3 pr-3 text-muted">{date(h.createdAt)}</td>
                <td className="pr-3 font-semibold">{tl(h.name)}<span className="ml-2 text-xs font-normal text-faint">v{h.configVersion}</span></td>
                <td className="pr-3 text-muted">{summarizeOutcome(h.game, h.outcome, t)}</td>
                <td className="num pr-3 text-right">{n(h.stake)}</td><td className="num pr-3 text-right">{n(h.payout)}</td><td className="text-right">{net(h.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="grid gap-3 md:hidden">
        {items.map((h) => (
          <li key={h.sessionId} className="rounded-2xl border border-line bg-surface-2 p-4">
            <div className="flex items-center justify-between gap-2"><p className="font-bold">{tl(h.name)}</p>{net(h.net)}</div>
            <p className="mt-1 text-xs text-faint">{date(h.createdAt)}</p>
            <p className="mt-2 text-sm text-muted">{summarizeOutcome(h.game, h.outcome, t)}</p>
            <p className="mt-2 flex items-center gap-1 text-xs text-faint"><CoinIcon size={13} />{t("history.stake")} {n(h.stake)} · {t("history.payout")} {n(h.payout)}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
