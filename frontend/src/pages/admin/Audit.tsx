import { useState } from "react";
import { api } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { useI18n } from "../../i18n";
import { AdminDataTable } from "../../components/admin/AdminDataTable";
import { PageHeader } from "../../components/ui";

interface Log { id: string; actor: string; action: string; targetType: string; targetId: string | null; reason: string | null; meta: Record<string, unknown>; createdAt: string; }

export default function AuditLogs() {
  const { t, date } = useI18n();
  const [page, setPage] = useState(1);
  const { data, loading } = useApi(() => api.get<{ items: Log[]; total: number; pageSize: number }>(`/admin/audit-logs?page=${page}&pageSize=25`), [page]);
  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={t("admin.title")} title={t("admin.audit.title")} subtitle={t("admin.audit.subtitle")} />
      <div className="card">
        <AdminDataTable<Log> caption={t("admin.audit.title")} loading={loading} rows={data?.items ?? []} emptyTitle={t("admin.audit.empty")} page={page} pageSize={data?.pageSize} total={data?.total} onPage={setPage}
          cols={[
            { key: "time", header: t("common.date"), render: (l) => <span className="whitespace-nowrap text-muted">{date(l.createdAt)}</span> },
            { key: "actor", header: t("admin.audit.actor"), render: (l) => <span className="font-semibold">@{l.actor}</span> },
            { key: "action", header: t("admin.audit.action"), render: (l) => <span className="badge badge-neutral font-mono">{l.action}</span> },
            { key: "target", header: t("admin.audit.target"), render: (l) => <span className="font-mono text-xs text-muted">{l.targetType}{l.targetId ? `:${l.targetId.slice(0, 8)}` : ""}</span> },
            { key: "reason", header: t("common.reason"), render: (l) => <span className="text-muted">{l.reason ?? "—"}</span> },
          ]} />
      </div>
    </div>
  );
}
