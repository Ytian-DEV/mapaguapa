import { useState } from "react";
import { Route, Routes } from "react-router-dom";
import { ConfirmDialog, useToast } from "../ui";
import { AdminShell } from "../features/admin/AdminShell";
import { AdminReportsView } from "../features/admin/AdminReportsView";
import { ReportDetailView } from "../features/admin/ReportDetailView";
import type { Person, ReportFilters, ReportMessage, ReportRow } from "../features/admin/reportsApi";

// Dev-only fixtures (not bundled in production). /dev/admin-reports and /dev/admin-reports/detail.
const iso = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
const student: Person = { id: "s1", full_name: "Fixture Student", email: "student@example.test", is_active: true };
const owner: Person = { id: "o1", full_name: "Fixture Owner", email: "owner@example.test", is_active: true };
const base = {
  reporter_id: student.id,
  reporter: student,
  status: "open",
  resolved_by: null,
  resolved_at: null,
  resolution_note: null,
  listing: { id: "l1", name: "Fixture Boarding House", status: "published" },
  listing_id: "l1",
  conversation_id: null,
  message_id: null,
};

const rows: ReportRow[] = [
  { ...base, id: "r1", target_type: "message", message_id: "m3", conversation_id: "c1", reported_user_id: owner.id, reported: owner, reason: "scam", details: "Asked me to send ₱5,000 by GCash before I could see the room.", created_at: iso(3) },
  { ...base, id: "r2", target_type: "listing", reported_user_id: owner.id, reported: owner, reason: "wrong_info", details: "The photos are from a different house.", created_at: iso(30) },
  { ...base, id: "r3", target_type: "listing", reported_user_id: null, reported: null, reason: "unavailable", details: null, created_at: iso(80), listing: { id: "l2", name: "Fixture Annex", status: "published" }, listing_id: "l2" },
];

const context: ReportMessage[] = [
  { id: "m1", sender_id: student.id, kind: "text", body: "Hi! Is the room near VSU still available?", created_at: iso(5) },
  { id: "m2", sender_id: owner.id, kind: "text", body: "Yes, one slot left.", created_at: iso(4) },
  { id: "m3", sender_id: owner.id, kind: "text", body: "Send ₱5,000 by GCash first to reserve. No viewing until paid.", created_at: iso(3.5) },
];

function List() {
  const [filters, setFilters] = useState<ReportFilters>({ status: "open", page: 0 });
  return (
    <AdminReportsView
      counts={{ open: 3, resolved: 12, dismissed: 4 }}
      filters={filters}
      onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
      onRetry={() => undefined}
      rows={filters.status === "open" ? rows : []}
      status="ready"
      total={filters.status === "open" ? rows.length : 0}
    />
  );
}

function Detail() {
  const toast = useToast();
  const [report, setReport] = useState(rows[0]);
  const [deactivating, setDeactivating] = useState<Person | null>(null);
  return (
    <>
      <ReportDetailView
        context={context}
        onDeactivate={setDeactivating}
        onDecide={async (status, note) => {
          setReport((current) => ({ ...current, status, resolution_note: note || null, resolved_at: status === "open" ? null : new Date().toISOString() }));
          toast.success(`Would mark ${status}`);
        }}
        related={1}
        report={report}
      />
      <ConfirmDialog
        confirmLabel="Deactivate"
        destructive
        onCancel={() => setDeactivating(null)}
        onConfirm={() => setDeactivating(null)}
        open={deactivating !== null}
        title={`Deactivate ${deactivating?.full_name}?`}
      />
    </>
  );
}

export default function AdminReportsPreview() {
  return (
    <AdminShell overview={null}>
      <Routes>
        <Route element={<List />} index />
        <Route element={<Detail />} path="detail" />
      </Routes>
    </AdminShell>
  );
}
