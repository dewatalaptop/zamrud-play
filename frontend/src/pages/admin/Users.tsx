import { useState } from "react";
import { Search } from "lucide-react";
import { api } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { useI18n } from "../../i18n";
import { AdminDataTable } from "../../components/admin/AdminDataTable";
import { useToast } from "../../components/Toast";
import { Modal, PageHeader } from "../../components/ui";
import { signed } from "../../lib/outcome";

interface UserRow { id: string; email: string; username: string; displayName: string; role: string; status: string; xp: number; balance: number; rounds: number; createdAt: string; lastLoginAt: string | null; }
interface Detail { id: string; email: string; username: string; displayName: string; role: string; status: string; balance: number; createdAt: string; lastLoginAt: string | null;
  activity: { rounds: number; coinsStaked: number; grossPayouts: number }; recentTransactions: { type: string; amount: number; balanceAfter: number; note: string | null; createdAt: string }[]; }
interface Support { id: string; username: string; subject: string; message: string; status: string; adminNote: string | null; createdAt: string; }

export default function Users() {
  const { t, n, date } = useI18n();
  const { toast, toastError } = useToast();
  const [tab, setTab] = useState<"users" | "support">("users");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const users = useApi(() => api.get<{ items: UserRow[]; total: number; pageSize: number }>(`/admin/users?q=${encodeURIComponent(query)}&page=${page}`), [query, page]);
  const support = useApi(() => api.get<Support[]>("/admin/support"), []);
  const [sel, setSel] = useState<Detail | null>(null);
  const [form, setForm] = useState({ amount: "", reason: "" });
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const open = async (id: string) => { try { setSel(await api.get<Detail>(`/admin/users/${id}`)); setForm({ amount: "", reason: "" }); } catch (e) { toastError(e); } };
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); toast(t("common.saved")); if (sel) setSel(await api.get<Detail>(`/admin/users/${sel.id}`)); await users.reload(); } catch (e) { toastError(e); } finally { setBusy(false); }
  };
  const reasonOk = form.reason.trim().length >= 5;

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={t("admin.title")} title={t("admin.users.title")} subtitle={t("admin.users.subtitle")}
        actions={<div role="tablist" className="flex gap-2">{(["users", "support"] as const).map((x) => <button key={x} role="tab" aria-selected={tab === x} className="bet-btn" aria-pressed={tab === x} onClick={() => setTab(x)}>{t(`admin.users.tab_${x}`)}</button>)}</div>} />
      {tab === "users" ? (
        <div className="card">
          <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(q); }}>
            <label className="relative flex-1"><span className="sr-only">{t("common.search")}</span><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" /><input className="input !pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("admin.users.search")} /></label>
            <button className="btn btn-primary">{t("common.search")}</button>
          </form>
          <AdminDataTable<UserRow> caption={t("admin.users.title")} loading={users.loading} rows={users.data?.items ?? []} emptyTitle={t("admin.users.empty")} page={page} pageSize={users.data?.pageSize} total={users.data?.total} onPage={setPage}
            cols={[
              { key: "user", header: t("admin.users.user"), render: (u) => <button className="text-left hover:underline" onClick={() => open(u.id)}><span className="font-semibold">{u.displayName}</span><span className="block text-xs text-faint">@{u.username} · {u.email}</span></button> },
              { key: "role", header: t("admin.users.role"), render: (u) => <span className={`badge ${u.role === "ADMIN" ? "badge-warning" : "badge-neutral"}`}>{u.role}</span> },
              { key: "status", header: t("common.status"), render: (u) => <span className={`badge ${u.status === "ACTIVE" ? "badge-success" : "badge-error"}`}>{t(`admin.users.st_${u.status}`)}</span> },
              { key: "balance", header: t("wallet.balance"), align: "right", render: (u) => n(u.balance) },
              { key: "rounds", header: t("stats.gamesPlayed"), align: "right", render: (u) => n(u.rounds) },
              { key: "created", header: t("admin.users.joined"), render: (u) => date(u.createdAt, false) },
            ]} />
        </div>
      ) : (
        <div className="grid gap-4">
          {support.loading ? null : !support.data?.length ? <div className="card text-sm text-muted">{t("admin.users.noSupport")}</div> : support.data.map((s) => (
            <article key={s.id} className="card grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">{s.subject}</p><span className={`badge ${s.status === "OPEN" ? "badge-warning" : "badge-success"}`}>{s.status}</span></div>
              <p className="text-xs text-faint">@{s.username} · {date(s.createdAt)}</p>
              <p className="whitespace-pre-line text-sm text-muted">{s.message}</p>
              {s.status === "OPEN" ? (
                <div className="flex gap-2"><input className="input" placeholder={t("admin.users.resolveNote")} value={note[s.id] ?? ""} onChange={(e) => setNote({ ...note, [s.id]: e.target.value })} />
                  <button className="btn btn-primary btn-sm" disabled={(note[s.id] ?? "").trim().length < 2} onClick={async () => { try { await api.post(`/admin/support/${s.id}/resolve`, { note: note[s.id] }); toast(t("common.saved")); await support.reload(); } catch (e) { toastError(e); } }}>{t("admin.users.resolve")}</button></div>
              ) : <p className="text-sm text-muted">{s.adminNote}</p>}
            </article>
          ))}
        </div>
      )}

      <Modal open={!!sel} onClose={() => setSel(null)} wide title={sel ? `${sel.displayName} (@${sel.username})` : ""}>
        {sel && (
          <div className="grid gap-5">
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><dt className="text-faint">{t("wallet.balance")}</dt><dd className="num font-bold">{n(sel.balance)}</dd></div>
              <div><dt className="text-faint">{t("stats.gamesPlayed")}</dt><dd className="num font-bold">{n(sel.activity.rounds)}</dd></div>
              <div><dt className="text-faint">{t("common.status")}</dt><dd className="font-bold">{t(`admin.users.st_${sel.status}`)}</dd></div>
              <div><dt className="text-faint">{t("admin.users.lastLogin")}</dt><dd className="font-bold">{sel.lastLoginAt ? date(sel.lastLoginAt) : "—"}</dd></div>
            </dl>
            <p className="text-xs text-muted">{t("admin.users.aggregateNote")}</p>
            <label className="grid gap-1.5 text-sm font-semibold">{t("admin.users.reasonRequired")}<input className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder={t("admin.users.reasonPlaceholder")} /></label>
            <div className="grid gap-3 rounded-2xl border border-line bg-surface-2 p-4">
              <p className="text-sm font-bold">{t("admin.users.adjust")}</p>
              <div className="flex gap-2"><input className="input" inputMode="numeric" placeholder="+500 / -200" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                <button className="btn btn-primary" disabled={busy || !reasonOk || !/^[+-]?\d+$/.test(form.amount) || Number(form.amount) === 0} onClick={() => run(() => api.post(`/admin/users/${sel.id}/adjust-balance`, { amount: Number(form.amount), reason: form.reason }))}>{t("admin.users.apply")}</button></div>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-secondary btn-sm" disabled={busy || !reasonOk} onClick={() => run(() => api.post(`/admin/users/${sel.id}/demo-reset`, { reason: form.reason }))}>{t("admin.users.demoReset")}</button>
                {sel.role !== "ADMIN" && (sel.status === "ACTIVE"
                  ? <button className="btn btn-danger btn-sm" disabled={busy || !reasonOk} onClick={() => run(() => api.post(`/admin/users/${sel.id}/status`, { status: "SUSPENDED", reason: form.reason }))}>{t("admin.users.suspend")}</button>
                  : sel.status === "SUSPENDED" && <button className="btn btn-primary btn-sm" disabled={busy || !reasonOk} onClick={() => run(() => api.post(`/admin/users/${sel.id}/status`, { status: "ACTIVE", reason: form.reason }))}>{t("admin.users.reactivate")}</button>)}
              </div>
            </div>
            <div><p className="mb-2 text-sm font-bold">{t("admin.users.recentTx")}</p>
              <ul className="grid gap-1.5 text-sm">{sel.recentTransactions.map((x, i) => <li key={i} className="flex justify-between rounded-xl bg-surface-2 px-3 py-2"><span>{t(`tx.${x.type}`)}{x.note ? ` — ${x.note}` : ""}</span><span className="num font-semibold">{signed(x.amount, n)}</span></li>)}</ul></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
