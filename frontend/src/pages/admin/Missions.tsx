import { useState } from "react";
import { api } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { useI18n } from "../../i18n";
import { AdminDataTable } from "../../components/admin/AdminDataTable";
import { useToast } from "../../components/Toast";
import { Modal, PageHeader } from "../../components/ui";

interface AM { id: string; key: string; period: string; metric: string; target: number; rewardCoins: number; active: boolean; sortOrder: number; titleId: string; titleEn: string; descId: string; descEn: string; completions: number; }
const METRICS = ["COMPLETE_SESSION", "DISTINCT_GAMES", "DISTINCT_CATEGORIES", "REVIEW_RULES", "COMPLETE_TUTORIAL", "UPDATE_PREFERENCES", "UPDATE_PROFILE", "CLAIM_DAILY"];
const blank = { key: "", period: "DAILY", metric: "COMPLETE_SESSION", target: 1, rewardCoins: 200, titleId: "", titleEn: "", descId: "", descEn: "", active: true, sortOrder: 50 };

export default function AdminMissions() {
  const { t, tl, n } = useI18n();
  const { toast, toastError } = useToast();
  const { data, loading, reload } = useApi(() => api.get<AM[]>("/admin/missions"));
  const [edit, setEdit] = useState<(typeof blank & { id?: string }) | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      const { id, key, ...rest } = edit;
      if (id) await api.patch(`/admin/missions/${id}`, rest); else await api.post("/admin/missions", { key, ...rest });
      toast(t("common.saved")); setEdit(null); await reload();
    } catch (e) { toastError(e); } finally { setBusy(false); }
  };
  const toggle = async (m: AM) => { try { await api.patch(`/admin/missions/${m.id}`, { active: !m.active }); await reload(); } catch (e) { toastError(e); } };
  const set = (k: string, v: unknown) => setEdit((e) => (e ? { ...e, [k]: v } : e));

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={t("admin.title")} title={t("admin.missions.title")} subtitle={t("admin.missions.subtitle")} actions={<button className="btn btn-primary" onClick={() => setEdit({ ...blank })}>{t("admin.missions.new")}</button>} />
      <div className="card">
        <AdminDataTable<AM> caption={t("admin.missions.title")} loading={loading} rows={data ?? []} emptyTitle={t("missions.emptyTitle")}
          cols={[
            { key: "title", header: t("admin.missions.titleCol"), render: (m) => <div><p className="font-semibold">{tl({ id: m.titleId, en: m.titleEn })}</p><p className="font-mono text-xs text-faint">{m.key}</p></div> },
            { key: "period", header: t("admin.missions.period"), render: (m) => t(`missions.period.${m.period}`) },
            { key: "metric", header: t("admin.missions.metric"), render: (m) => <span className="text-xs">{t(`admin.missions.metrics.${m.metric}`)} ×{m.target}</span> },
            { key: "reward", header: t("admin.economy.reward"), align: "right", render: (m) => n(m.rewardCoins) },
            { key: "done", header: t("admin.missions.completions"), align: "right", render: (m) => n(m.completions) },
            { key: "active", header: t("common.status"), render: (m) => <button className={`btn btn-sm ${m.active ? "btn-secondary" : "btn-primary"}`} onClick={() => toggle(m)}>{m.active ? t("common.active") : t("common.inactive")}</button> },
            { key: "edit", header: "", render: (m) => <button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...m })}>{t("common.edit")}</button> },
          ]} />
      </div>
      <p className="text-xs text-muted">{t("missions.policy")}</p>

      <Modal open={!!edit} onClose={() => setEdit(null)} wide title={edit?.id ? t("admin.missions.edit") : t("admin.missions.new")}
        footer={<><button className="btn btn-secondary" onClick={() => setEdit(null)}>{t("common.cancel")}</button><button className="btn btn-primary" disabled={busy} onClick={save}>{t("common.save")}</button></>}>
        {edit && (
          <div className="grid gap-3 text-sm font-semibold sm:grid-cols-2">
            <label className="grid gap-1.5">{t("admin.missions.key")}<input className="input" disabled={!!edit.id} value={edit.key} onChange={(e) => set("key", e.target.value)} placeholder="my-mission" /></label>
            <label className="grid gap-1.5">{t("admin.missions.period")}<select className="select" value={edit.period} onChange={(e) => set("period", e.target.value)}>{["DAILY", "WEEKLY", "ONCE"].map((p) => <option key={p} value={p}>{t(`missions.period.${p}`)}</option>)}</select></label>
            <label className="grid gap-1.5">{t("admin.missions.metric")}<select className="select" value={edit.metric} onChange={(e) => set("metric", e.target.value)}>{METRICS.map((m) => <option key={m} value={m}>{t(`admin.missions.metrics.${m}`)}</option>)}</select></label>
            <label className="grid gap-1.5">{t("admin.missions.target")}<input className="input" type="number" min={1} max={20} value={edit.target} onChange={(e) => set("target", Number(e.target.value))} /></label>
            <label className="grid gap-1.5">{t("admin.economy.reward")}<input className="input" type="number" min={0} max={10000} value={edit.rewardCoins} onChange={(e) => set("rewardCoins", Number(e.target.value))} /></label>
            <label className="flex items-end gap-2 pb-2"><input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={edit.active} onChange={(e) => set("active", e.target.checked)} />{t("common.active")}</label>
            <label className="grid gap-1.5">{t("admin.missions.titleId")}<input className="input" value={edit.titleId} onChange={(e) => set("titleId", e.target.value)} /></label>
            <label className="grid gap-1.5">{t("admin.missions.titleEn")}<input className="input" value={edit.titleEn} onChange={(e) => set("titleEn", e.target.value)} /></label>
            <label className="grid gap-1.5">{t("admin.missions.descId")}<textarea className="textarea" rows={2} value={edit.descId} onChange={(e) => set("descId", e.target.value)} /></label>
            <label className="grid gap-1.5">{t("admin.missions.descEn")}<textarea className="textarea" rows={2} value={edit.descEn} onChange={(e) => set("descEn", e.target.value)} /></label>
            <p className="text-xs font-normal text-muted sm:col-span-2">{t("admin.missions.guard")}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
