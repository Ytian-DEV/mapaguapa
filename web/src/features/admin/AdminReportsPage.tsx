import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { ReportStatus } from "../../lib/domain";
import { Button, ButtonLink, ConfirmDialog, EmptyState, Skeleton, useToast } from "../../ui";
import { useAdminData } from "./AdminDataContext";
import { AdminReportsView } from "./AdminReportsView";
import { ReportDetailView } from "./ReportDetailView";
import {
  fetchRelatedCount,
  fetchReport,
  fetchReportContext,
  fetchReportCounts,
  fetchReports,
  reportFiltersFromParams,
  reportFiltersToParams,
  setReportStatus,
  type Person,
  type ReportFilters,
  type ReportMessage,
  type ReportRow,
} from "./reportsApi";
import { setUserActive } from "./usersApi";

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

/** /admin/reports and /admin/reports/:reportId. */
export default function AdminReportsPage() {
  const { reportId } = useParams();
  return reportId ? <ReportDetailPage reportId={reportId} /> : <ReportListPage />;
}

function ReportListPage() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => reportFiltersFromParams(params), [params]);
  const key = reportFiltersToParams(filters).toString();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<ReportStatus, number> | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reload, setReload] = useState(0);
  const request = useRef(0);

  useEffect(() => {
    document.title = "Reports · Admin · mapaguapa";
  }, []);

  useEffect(() => {
    const id = ++request.current;
    setStatus("loading");
    Promise.all([fetchReports(reportFiltersFromParams(new URLSearchParams(key))), fetchReportCounts()])
      .then(([page, tabCounts]) => {
        if (id !== request.current) return;
        setRows(page.rows);
        setTotal(page.total);
        setCounts(tabCounts);
        setStatus("ready");
      })
      .catch(() => {
        if (id === request.current) setStatus("error");
      });
  }, [key, reload]);

  const onChange = useCallback(
    (patch: Partial<ReportFilters>) => setParams((current) => reportFiltersToParams({ ...reportFiltersFromParams(current), ...patch })),
    [setParams]
  );

  return (
    <AdminReportsView
      counts={counts}
      filters={filters}
      onChange={onChange}
      onRetry={() => setReload((value) => value + 1)}
      rows={rows}
      status={status}
      total={total}
    />
  );
}

function ReportDetailPage({ reportId }: { reportId: string }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { refresh: refreshCounts } = useAdminData();
  const [report, setReport] = useState<ReportRow | null>(null);
  const [context, setContext] = useState<ReportMessage[]>([]);
  const [related, setRelated] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [deactivating, setDeactivating] = useState<Person | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await fetchReport(reportId);
      if (!next) {
        setStatus("missing");
        return;
      }
      const [messages, others] = await Promise.all([fetchReportContext(next).catch(() => []), fetchRelatedCount(next).catch(() => 0)]);
      setReport(next);
      setContext(messages);
      setRelated(others);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [reportId]);

  useEffect(() => {
    setStatus("loading");
    void load();
  }, [load]);

  useEffect(() => {
    document.title = "Report · Admin · mapaguapa";
  }, []);

  const decide = async (next: "resolved" | "dismissed" | "open", note: string) => {
    if (!report) return;
    try {
      await setReportStatus(report.id, next, note);
      void refreshCounts();
      if (next === "open") {
        toast.success("Report reopened.");
        await load();
      } else {
        toast.success(next === "resolved" ? "Report resolved." : "Report dismissed.");
        navigate("/admin/reports");
      }
    } catch (error) {
      toast.error(`Couldn’t save: ${errorText(error)}`);
    }
  };

  const deactivate = async () => {
    if (!deactivating) return;
    setBusy(true);
    try {
      await setUserActive(deactivating.id, false);
      toast.success(`${deactivating.full_name ?? "Account"} deactivated.`);
      setDeactivating(null);
      void refreshCounts();
      await load();
    } catch (error) {
      toast.error(`Couldn’t deactivate: ${errorText(error)}`);
    } finally {
      setBusy(false);
    }
  };

  if (status === "loading") return <Skeleton height={420} />;
  if (status === "error")
    return (
      <EmptyState
        action={
          <Button onClick={() => void load()} variant="secondary">
            Try again
          </Button>
        }
        title="Couldn’t load this report"
        tone="error"
      />
    );
  if (status === "missing" || !report)
    return (
      <EmptyState
        action={
          <ButtonLink to="/admin/reports" variant="secondary">
            Back to reports
          </ButtonLink>
        }
        title="Report not found"
      />
    );

  return (
    <>
      <ReportDetailView context={context} onDeactivate={setDeactivating} onDecide={decide} related={related} report={report} />
      <ConfirmDialog
        busy={busy}
        confirmLabel="Deactivate"
        description="They’re signed out the next time they open the app and can’t sign back in. You can reactivate them from Users."
        destructive
        onCancel={() => setDeactivating(null)}
        onConfirm={() => void deactivate()}
        open={deactivating !== null}
        title={`Deactivate ${deactivating?.full_name ?? "this account"}?`}
      />
    </>
  );
}
