import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useT } from "../i18n";
import { Disclosure } from "../components/Layout";
import { PageHeader } from "../components/ui";
import { ResponsiblePlayPanel } from "../components/ResponsiblePlayPanel";

/** Halaman teks hukum/informasi: bagian s1..sN dibaca dari berkas terjemahan. */
function Doc({ ns, sections, updated }: { ns: string; sections: number; updated?: boolean }) {
  const t = useT();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={t(`${ns}.eyebrow`)} title={t(`${ns}.title`)} subtitle={t(`${ns}.subtitle`)} />
      <div className="grid gap-6">
        {Array.from({ length: sections }, (_, i) => (
          <section key={i} className="card" aria-labelledby={`${ns}-s${i + 1}`}>
            <h2 id={`${ns}-s${i + 1}`} className="text-lg font-bold">{t(`${ns}.s${i + 1}.title`)}</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">{t(`${ns}.s${i + 1}.body`)}</p>
          </section>
        ))}
      </div>
      {updated && <p className="mt-6 text-xs text-faint">{t("legal.updated")}</p>}
      <div className="mt-8 rounded-2xl border border-line bg-surface p-4"><Disclosure /></div>
    </div>
  );
}

export const About = () => <Doc ns="about" sections={5} />;
export const Privacy = () => <Doc ns="privacy" sections={7} updated />;
export const Terms = () => <Doc ns="terms" sections={8} updated />;

export function ResponsiblePlayPage() {
  const t = useT();
  const { me } = useAuth();
  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <Doc ns="rp" sections={6} />
      <div className="card card-glow">
        {me ? <ResponsiblePlayPanel /> : (
          <div className="grid gap-3"><h2 className="text-lg font-bold">{t("rp.guestTitle")}</h2><p className="text-sm text-muted">{t("rp.guestBody")}</p>
            <div className="flex gap-2"><Link to="/login" className="btn btn-secondary btn-sm">{t("nav.login")}</Link><Link to="/register" className="btn btn-primary btn-sm">{t("nav.register")}</Link></div></div>
        )}
      </div>
    </div>
  );
}
