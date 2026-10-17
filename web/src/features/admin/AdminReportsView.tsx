import { AlertTriangle, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ReportReason, ReportStatus } from "../../lib/domain";
import { Badge, Button, DataTable, EmptyState, PageHeader, Pagination, Tabs, type Column } from "../../ui";
import { listTime } from "../messaging/time";
import { reasonLabel, REPORTS_PAGE_SIZE, targetLabel, type ReportFilters, type ReportRow } from "./reportsApi";
import "./admin.css";
import "./reports.css";

const TAB_LABELS: Record<ReportStatus, string> = { open: "Open", resolved: "Resolved", dismissed: "Dismissed" };
const TAB_ORDER: ReportStatus[] = ["open", "resolved", "dismissed"];
const URGENT: ReportReason[] = ["scam", "harassment", "safety"];

export function ReasonBadge({ reason }: { reason: string }) {
  return (
    <Badge dot tone={URGENT.includes(reason as ReportReason) ? "red" : "amber"}>
      {reasonLabel(reason)}
    </Badge>
  );
}

export type AdminReportsViewProps = {
  filters: ReportFilters;
  onChange: (patch: Partial<ReportFilters>) => void;
  rows: ReportRow[];
  total: number;
  counts: Record<ReportStatus, number> | null;
  status: "loading" | "ready" | "error";
  onRetry: () => void;
};

/** Admin Reports list. Presentational; the page owns data. */
export function AdminReportsView({ filters, onChange, rows, total, counts, status, onRetry }: AdminReportsViewProps) {
  const navigate = useNavigate();

  const columns: Column<ReportRow>[] = [
    {
      key: "target",
      header: "Reported",
      primary: true,
      cell: (report) => (
        <span className="admin-cell-listing__text">
          <strong>{targetLabel(report)}</strong>
          <span>{report.target_type === "listing" ? "Listing" : report.target_type === "message" ? (report.listing?.name ?? "Conversation") : "Account"}</span>
        </span>
      ),
    },
    { key: "reason", header: "Reason", cell: (report) => <ReasonBadge reason={report.reason} /> },
    { key: "by", header: "Reported by", hideOnMobile: true, cell: (report) => report.reporter?.full_name ?? "Unknown" },
    {
      key: "when",
      header: filters.status === "open" ? "Received" : "Closed",
      cell: (report) => <span className="admin-nowrap">{listTime(filters.status === "open" ? report.created_at : (report.resolved_at ?? report.created_at))}</span>,
    },
  ];

  return (
    <div className="admin-listings">
      <PageHeader
        eyebrow="People"
        subtitle={counts ? `${counts.open} open · scams, harassment and safety reports first need a look today.` : "Reports from students about listings and messages."}
        title="Reports"
      />

      <Tabs
        idPrefix="admin-reports"
        items={TAB_ORDER.map((value) => ({ value, label: TAB_LABELS[value], count: counts?.[value] }))}
        label="Report status"
        onChange={(value) => onChange({ status: value, page: 0 })}
        value={filters.status}
      />

      {status === "error" ? (
        <EmptyState
          action={
            <Button onClick={onRetry} variant="secondary">
              Try again
            </Button>
          }
          title="Couldn’t load reports"
          tone="error"
        />
      ) : (
        <DataTable
          caption={`${TAB_LABELS[filters.status]} reports`}
          columns={columns}
          empty={
            <EmptyState
              compact
              description={filters.status === "open" ? "Students can report listings and messages; new reports show up here." : undefined}
              icon={<AlertTriangle />}
              title={filters.status === "open" ? "No open reports" : `No ${TAB_LABELS[filters.status].toLowerCase()} reports`}
            />
          }
          getRowId={(report) => report.id}
          loading={status === "loading"}
          onRowClick={(report) => navigate(`/admin/reports/${report.id}`)}
          rowActions={(report) => (
            <Button aria-label={`Open report about ${targetLabel(report)}`} onClick={() => navigate(`/admin/reports/${report.id}`)} size="sm" variant="ghost">
              <ChevronRight />
            </Button>
          )}
          rows={rows}
        />
      )}

      {status === "ready" && total > 0 && (
        <Pagination itemLabel="reports" onPageChange={(page) => onChange({ page })} page={filters.page} pageSize={REPORTS_PAGE_SIZE} total={total} />
      )}
    </div>
  );
}
