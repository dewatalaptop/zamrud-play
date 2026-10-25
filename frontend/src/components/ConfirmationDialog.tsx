import type { ReactNode } from "react";
import { Modal } from "./ui";
import { useT } from "../i18n";

export function ConfirmationDialog({ open, title, children, confirmLabel, danger, busy, onConfirm, onCancel }: {
  open: boolean; title: string; children?: ReactNode; confirmLabel?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const t = useT();
  return (
    <Modal open={open} onClose={onCancel} title={title}
      footer={<>
        <button className="btn btn-secondary" onClick={onCancel}>{t("common.cancel")}</button>
        <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} disabled={busy} onClick={onConfirm}>{confirmLabel ?? t("common.confirm")}</button>
      </>}>
      <div className="text-sm text-muted">{children}</div>
    </Modal>
  );
}
