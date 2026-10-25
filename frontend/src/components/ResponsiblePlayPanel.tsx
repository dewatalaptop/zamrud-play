import { useEffect, useState } from "react";
import { Coffee, HeartPulse, Timer } from "lucide-react";
import { api } from "../lib/api";
import { useI18n } from "../i18n";
import { useApi } from "../lib/hooks";
import { useToast } from "./Toast";
import { usePlaySession, fmtDuration } from "./SessionReminder";
import { LoadingSkeleton } from "./LoadingSkeleton";

interface Settings { reminderMinutes: number; dailyLimitMinutes: number | null; cooldownSeconds: number; breakUntil: string | null; todaySeconds: number; }

/** Pengaturan bermain sehat: pengingat (tidak bisa dimatikan), batas harian opsional, cooldown, jeda sukarela. */
export function ResponsiblePlayPanel() {
  const { t, date } = useI18n();
  const { toast, toastError } = useToast();
  const { refresh } = usePlaySession();
  const { data, loading, reload } = useApi(() => api.get<Settings>("/me/responsible-play"));
  const [form, setForm] = useState({ reminderMinutes: 30, dailyLimitMinutes: "" as number | "", cooldownSeconds: 0 });
  useEffect(() => {
    if (data) setForm({ reminderMinutes: data.reminderMinutes, dailyLimitMinutes: data.dailyLimitMinutes ?? "", cooldownSeconds: data.cooldownSeconds });
  }, [data]);

  if (loading || !data) return <LoadingSkeleton rows={2} />;

  const save = async () => {
    try {
      await api.put("/me/responsible-play", {
        reminderMinutes: Number(form.reminderMinutes), cooldownSeconds: Number(form.cooldownSeconds),
        dailyLimitMinutes: form.dailyLimitMinutes === "" ? null : Number(form.dailyLimitMinutes),
      });
      toast(t("common.saved"));
      await reload(); refresh();
    } catch (e) { toastError(e); }
  };
  const takeBreak = async (minutes: number) => {
    try { await api.post("/me/responsible-play/break", { minutes }); toast(t("responsible.breakStarted")); await reload(); refresh(); } catch (e) { toastError(e); }
  };
  const endBreak = async () => { try { await api.del("/me/responsible-play/break"); await reload(); refresh(); } catch (e) { toastError(e); } };
  const labelCls = "grid gap-1.5 text-sm font-semibold";

  return (
    <section className="grid gap-5" aria-labelledby="rp-title">
      <div className="flex items-center gap-2"><HeartPulse className="text-brand-400" aria-hidden="true" /><h2 id="rp-title" className="text-lg font-bold">{t("responsible.panelTitle")}</h2></div>
      <p className="text-sm text-muted">{t("responsible.panelIntro")}</p>
      <p className="chip w-fit"><Timer size={14} />{t("responsible.today")}: {fmtDuration(data.todaySeconds)}</p>

      {data.breakUntil && (
        <div className="rounded-2xl border border-line bg-[var(--warning-bg)] p-4 text-sm text-warn" role="status">
          <p className="font-semibold">{t("responsible.onBreak", { until: date(data.breakUntil) })}</p>
          <button className="btn btn-secondary btn-sm mt-3" onClick={endBreak}>{t("responsible.endBreak")}</button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <label className={labelCls}>{t("responsible.reminder")}
          <select className="select" value={form.reminderMinutes} onChange={(e) => setForm({ ...form, reminderMinutes: Number(e.target.value) })}>
            {[15, 20, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{t("responsible.minutes", { n: m })}</option>)}
          </select>
          <span className="text-xs font-normal text-faint">{t("responsible.reminderHint")}</span>
        </label>
        <label className={labelCls}>{t("responsible.dailyLimit")}
          <select className="select" value={form.dailyLimitMinutes} onChange={(e) => setForm({ ...form, dailyLimitMinutes: e.target.value === "" ? "" : Number(e.target.value) })}>
            <option value="">{t("responsible.noLimit")}</option>
            {[30, 60, 90, 120, 180, 240].map((m) => <option key={m} value={m}>{t("responsible.minutes", { n: m })}</option>)}
          </select>
          <span className="text-xs font-normal text-faint">{t("responsible.dailyLimitHint")}</span>
        </label>
        <label className={labelCls}>{t("responsible.cooldown")}
          <select className="select" value={form.cooldownSeconds} onChange={(e) => setForm({ ...form, cooldownSeconds: Number(e.target.value) })}>
            {[0, 5, 10, 30, 60, 120].map((s) => <option key={s} value={s}>{s === 0 ? t("responsible.off") : t("responsible.seconds", { n: s })}</option>)}
          </select>
          <span className="text-xs font-normal text-faint">{t("responsible.cooldownHint")}</span>
        </label>
      </div>
      <div><button className="btn btn-primary" onClick={save}>{t("common.save")}</button></div>

      <div className="rounded-2xl border border-line bg-surface-2 p-4">
        <h3 className="flex items-center gap-2 font-bold"><Coffee size={18} className="text-brand-400" />{t("responsible.breakTitle")}</h3>
        <p className="mt-1 text-sm text-muted">{t("responsible.breakHint")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[15, 30, 60, 240, 1440].map((m) => <button key={m} className="btn btn-secondary btn-sm" onClick={() => takeBreak(m)}>{t(`responsible.d${m}`)}</button>)}
        </div>
      </div>
    </section>
  );
}
