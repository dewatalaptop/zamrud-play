import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { useI18n } from "../../i18n";
import { LoadingSkeleton } from "../../components/LoadingSkeleton";
import { useToast } from "../../components/Toast";
import { Modal, PageHeader } from "../../components/ui";

interface Version { version: number; status: string; createdAt: string; publishedAt: string | null; config: any; preview: any; }
interface AGame { id: string; slug: string; category: string; enabled: boolean; activeConfigVersion: number; nameId: string; nameEn: string; descId: string; descEn: string; versions: Version[]; }

function Preview({ slug, p }: { slug: string; p: any }) {
  const { t } = useI18n();
  if (!p) return null;
  if (slug === "virtual-slots") return <p className="text-xs text-muted">{t("slots.rtpNote", { rtp: p.rtp.percent })} · {p.symbols.length} {t("slots.symbol").toLowerCase()}</p>;
  if (slug === "zamrud-slots-5") return <p className="text-xs text-muted">{t("slots5.rtpNote", { rtp: p.rtp.percent, lines: p.rtp.lines, scatter: p.rtp.scatter })}</p>;
  if (slug === "euro-roulette") return <p className="text-xs text-muted">RTP: {p.kinds.map((k: any) => `${k.kind} ${k.rtpPercent}%`).join(" · ")}</p>;
  if (slug === "dice-duel") return <p className="text-xs text-muted">{t("admin.games.maxRtp", { n: p.maxRtpPercent })}</p>;
  return <p className="text-xs text-muted">{t("blackjack.payoutRules", { bj: p.blackjackPays, decks: p.decks })}</p>;
}

export default function AdminGames() {
  const { t, tl, date } = useI18n();
  const { toast, toastError } = useToast();
  const { data, loading, reload } = useApi(() => api.get<AGame[]>("/admin/games"));
  const [edit, setEdit] = useState<AGame | null>(null);
  const [meta, setMeta] = useState({ nameId: "", nameEn: "", descId: "", descEn: "" });
  const [cfgGame, setCfgGame] = useState<AGame | null>(null);
  const [json, setJson] = useState("");
  const [check, setCheck] = useState<{ ok: boolean; errors?: string[]; preview?: any } | null>(null);
  const [pub, setPub] = useState<{ game: AGame; version: number } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true);
    try { await fn(); toast(t("common.saved")); after?.(); await reload(); } catch (e) {
      if (e instanceof ApiError && e.code === "CONFIG_INVALID") setCheck({ ok: false, errors: (e.extra as any).errors });
      toastError(e);
    } finally { setBusy(false); }
  };
  const validate = async () => {
    try { setCheck(await api.post(`/admin/games/${cfgGame!.id}/validate`, { config: JSON.parse(json) })); } catch (e) { if (e instanceof SyntaxError) setCheck({ ok: false, errors: [e.message] }); else toastError(e); }
  };

  if (loading || !data) return <LoadingSkeleton rows={3} height={200} />;
  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={t("admin.title")} title={t("admin.games.title")} subtitle={t("admin.games.subtitle")} />
      {data.map((g) => (
        <section key={g.id} className="card grid gap-4" aria-labelledby={`g-${g.slug}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 id={`g-${g.slug}`} className="text-lg font-bold">{tl({ id: g.nameId, en: g.nameEn })} <span className="chip ml-2">{g.slug}</span></h2><p className="mt-1 text-sm text-muted">{tl({ id: g.descId, en: g.descEn })}</p></div>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-secondary btn-sm" onClick={() => { setEdit(g); setMeta({ nameId: g.nameId, nameEn: g.nameEn, descId: g.descId, descEn: g.descEn }); }}>{t("admin.games.editMeta")}</button>
              <button className={`btn btn-sm ${g.enabled ? "btn-secondary" : "btn-primary"}`} onClick={() => act(() => api.patch(`/admin/games/${g.id}`, { enabled: !g.enabled }))}>{g.enabled ? t("common.disabled") : t("common.enabled")}</button>
              <button className="btn btn-primary btn-sm" onClick={() => { setCfgGame(g); setJson(JSON.stringify(g.versions.find((v) => v.version === g.activeConfigVersion)?.config ?? g.versions[0].config, null, 2)); setCheck(null); }}>{t("admin.games.newVersion")}</button>
            </div>
          </div>
          <span className={`badge w-fit ${g.enabled ? "badge-success" : "badge-error"}`}>{g.enabled ? t("common.active") : t("common.inactive")}</span>
          <ul className="grid gap-2">
            {g.versions.map((v) => (
              <li key={v.version} className="rounded-2xl border border-line bg-surface-2 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold">v{v.version} <span className={`badge ml-2 ${v.status === "PUBLISHED" ? "badge-success" : v.status === "DRAFT" ? "badge-warning" : "badge-neutral"}`}>{v.status}</span></p>
                  <div className="flex items-center gap-2"><span className="text-xs text-faint">{date(v.publishedAt ?? v.createdAt)}</span>{v.status === "DRAFT" && <button className="btn btn-gold btn-sm" onClick={() => { setPub({ game: g, version: v.version }); setReason(""); }}>{t("admin.games.publish")}</button>}</div>
                </div>
                <Preview slug={g.slug} p={v.preview} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={t("admin.games.editMeta")} wide
        footer={<><button className="btn btn-secondary" onClick={() => setEdit(null)}>{t("common.cancel")}</button><button className="btn btn-primary" disabled={busy} onClick={() => act(() => api.patch(`/admin/games/${edit!.id}`, meta), () => setEdit(null))}>{t("common.save")}</button></>}>
        <div className="grid gap-3 text-sm font-semibold">
          {(["nameId", "nameEn", "descId", "descEn"] as const).map((k) => <label key={k} className="grid gap-1.5">{t(`admin.games.${k}`)}<input className="input" value={meta[k]} onChange={(e) => setMeta({ ...meta, [k]: e.target.value })} /></label>)}
        </div>
      </Modal>

      <Modal open={!!cfgGame} onClose={() => setCfgGame(null)} title={t("admin.games.newVersion")} wide
        footer={<><button className="btn btn-secondary" onClick={validate}>{t("admin.games.validate")}</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => { let cfg: unknown; try { cfg = JSON.parse(json); } catch { setCheck({ ok: false, errors: ["JSON"] }); return; } void act(() => api.post(`/admin/games/${cfgGame!.id}/configs`, { config: cfg }), () => setCfgGame(null)); }}>{t("admin.games.saveDraft")}</button></>}>
        <p className="mb-3 text-sm text-muted">{t("admin.games.versionHelp")}</p>
        <textarea className="textarea font-mono text-xs" rows={14} spellCheck={false} value={json} onChange={(e) => { setJson(e.target.value); setCheck(null); }} aria-label="JSON" />
        {check && (check.ok ? (
          <div className="mt-3 rounded-xl bg-[var(--success-bg)] p-3 text-sm text-ok"><p className="flex items-center gap-2 font-semibold"><CheckCircle2 size={16} />{t("admin.games.valid")}</p><Preview slug={cfgGame?.slug ?? ""} p={check.preview} /></div>
        ) : (
          <div className="mt-3 rounded-xl bg-[var(--error-bg)] p-3 text-sm text-err" role="alert"><p className="flex items-center gap-2 font-semibold"><XCircle size={16} />{t("admin.games.invalid")}</p><ul className="mt-1 list-disc pl-5 text-xs">{check.errors?.map((e, i) => <li key={i}>{e}</li>)}</ul></div>
        ))}
      </Modal>

      <Modal open={!!pub} onClose={() => setPub(null)} title={t("admin.games.publish")}
        footer={<><button className="btn btn-secondary" onClick={() => setPub(null)}>{t("common.cancel")}</button><button className="btn btn-gold" disabled={busy || reason.trim().length < 5} onClick={() => act(() => api.post(`/admin/games/${pub!.game.id}/configs/${pub!.version}/publish`, { reason }), () => setPub(null))}>{t("admin.games.publish")}</button></>}>
        <p className="mb-3 text-sm text-muted">{t("admin.games.publishWarn")}</p>
        <label className="grid gap-1.5 text-sm font-semibold">{t("admin.users.reasonRequired")}<input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      </Modal>
    </div>
  );
}
