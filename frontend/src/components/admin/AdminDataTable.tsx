import type { ReactNode } from "react";
import { useT } from "../../i18n";
import { EmptyState } from "../EmptyState";
import { LoadingSkeleton } from "../LoadingSkeleton";

export interface Col<T> { key: string; header: string; render?: (row: T) => ReactNode; align?: "right"; }

/** Tabel admin generik dengan paginasi sisi server (halaman, bukan memuat semua data). */
export function AdminDataTable<T extends { id?: string }>({ caption, cols, rows, loading, emptyTitle, emptyText, page, pageSize, total, onPage }: {
  caption: string; cols: Col<T>[]; rows: T[]; loading?: boolean; emptyTitle: string; emptyText?: string;
  page?: number; pageSize?: number; total?: number; onPage?: (p: number) => void;
}) {
  const t = useT();
  if (loading) return <LoadingSkeleton rows={4} height={48} />;
  if (!rows.length) return <EmptyState title={emptyTitle} text={emptyText} />;
  const pages = page && pageSize && total ? Math.ceil(total / pageSize) : 1;
  return (
    <div>
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="text-xs uppercase tracking-wide text-faint"><tr>{cols.map((c) => <th key={c.key} scope="col" className={`py-2 pr-4 ${c.align === "right" ? "text-right" : ""}`}>{c.header}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id ?? i} className="border-t border-line align-top">
                {cols.map((c) => <td key={c.key} className={`py-3 pr-4 ${c.align === "right" ? "text-right num" : ""}`}>{c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? "")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && onPage && page && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-faint">{t("common.page", { n: page })} / {pages} · {total}</span>
          <div className="flex gap-2"><button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>{t("common.prev")}</button><button className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>{t("common.next")}</button></div>
        </div>
      )}
    </div>
  );
}
