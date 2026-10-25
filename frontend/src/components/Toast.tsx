import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { ApiError } from "../lib/api";
import { useT } from "../i18n";

type Kind = "success" | "error" | "info";
interface Toast { id: number; kind: Kind; text: string; }
interface Ctx { toast: (text: string, kind?: Kind) => void; toastError: (e: unknown) => void; }
const ToastCtx = createContext<Ctx>(null as unknown as Ctx);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const t = useT();
  const toast = useCallback((text: string, kind: Kind = "success") => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s.slice(-3), { id, kind, text }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 5000);
  }, []);
  const toastError = useCallback((e: unknown) => {
    const code = e instanceof ApiError ? e.code : "INTERNAL_ERROR";
    toast(t(`errors.${code}`) === `errors.${code}` ? t("errors.INTERNAL_ERROR") : t(`errors.${code}`), "error");
  }, [t, toast]);
  const icon = { success: <CheckCircle2 size={18} className="text-ok" />, error: <XCircle size={18} className="text-err" />, info: <Info size={18} className="text-brand-400" /> };
  return (
    <ToastCtx.Provider value={{ toast, toastError }}>
      {children}
      <div aria-live="polite" role="status" className="fixed bottom-20 right-3 left-3 sm:left-auto sm:bottom-6 sm:right-6 z-[60] flex flex-col gap-2 sm:w-96 pointer-events-none">
        {items.map((x) => (
          <div key={x.id} className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-card">
            {icon[x.kind]}
            <p className="flex-1 text-sm">{x.text}</p>
            <button aria-label={t("common.close")} className="text-faint hover:text-ink" onClick={() => setItems((s) => s.filter((y) => y.id !== x.id))}><X size={16} /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
