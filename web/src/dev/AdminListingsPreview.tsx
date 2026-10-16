import { useMemo, useState } from "react";
import type { ListingStatus } from "../lib/domain";
import { useToast } from "../ui";
import { AdminShell } from "../features/admin/AdminShell";
import type { AdminListingFilters, AdminTableRow } from "../features/admin/adminListingsApi";
import { AdminListingsView } from "../features/admin/AdminListingsView";
import { ArchiveDialog } from "../features/admin/ArchiveDialog";

// Dev-only fixtures (not bundled in production).
const iso = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
const row = (id: string, name: string, status: ListingStatus, extra: Partial<AdminTableRow> = {}): AdminTableRow => ({
  id,
  name,
  area: "Guadalupe",
  address: "Guadalupe, Baybay City",
  accommodation_type: "Boarding House",
  price_band: "3000_plus",
  monthly_rental_label: "₱3,000+",
  status,
  added_by: "admin",
  owner_name: null,
  photo_count: 3,
  updated_at: iso(30),
  archived_at: status === "archived" ? iso(90) : null,
  cover_bucket: null,
  cover_path: null,
  ...extra,
});

const all: AdminTableRow[] = [
  row("a1", "Fixture Boarding House", "published", { added_by: "owner", owner_name: "Fixture Owner" }),
  row("a2", "Fixture Annex", "in_review", { added_by: "owner", price_band: "2000_2999", updated_at: iso(2), photo_count: 6 }),
  row("a3", "Fixture Lodge", "published", { area: "Marcos", photo_count: 4, price_band: "1000_1999" }),
  row("a4", "Fixture Dormitory", "published", { area: "Pangasugan", accommodation_type: "Dormitory", photo_count: 0 }),
  row("a5", "Fixture Ladies Dorm", "changes_requested", { added_by: "owner", photo_count: 5 }),
  row("a6", "Old Fixture Place", "archived"),
];

export default function AdminListingsPreview() {
  const toast = useToast();
  const [filters, setFilters] = useState<AdminListingFilters>({ tab: "published", q: "", area: "", type: "", band: "", addedBy: "", noPhotos: false, page: 0 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [archive, setArchive] = useState<AdminTableRow[] | null>(null);

  const rows = useMemo(
    () =>
      all.filter(
        (item) =>
          item.status === filters.tab &&
          (!filters.q || item.name?.toLowerCase().includes(filters.q.toLowerCase())) &&
          (!filters.area || item.area === filters.area) &&
          (!filters.addedBy || item.added_by === filters.addedBy)
      ),
    [filters]
  );
  const counts = all.reduce(
    (acc, item) => ({ ...acc, [item.status as ListingStatus]: (acc[item.status as ListingStatus] ?? 0) + 1 }),
    { published: 0, in_review: 0, changes_requested: 0, draft: 0, archived: 0 } as Record<ListingStatus, number>
  );

  return (
    <AdminShell overview={null}>
      <AdminListingsView
        counts={counts}
        facets={{ areas: ["Guadalupe", "Marcos", "Pangasugan"], types: ["Boarding House", "Dormitory"] }}
        filters={filters}
        onArchive={setArchive}
        onChange={(patch) => {
          setFilters((current) => ({ ...current, ...patch }));
          setSelected(new Set());
        }}
        onExport={(selection) => toast.show(`Would export ${selection ? selection.length : "all"} rows`)}
        onRestore={(item) => toast.success(`Would restore ${item.name}`)}
        onRetry={() => undefined}
        onSelectionChange={setSelected}
        rows={rows}
        selected={selected}
        status="ready"
        total={rows.length}
      />
      <ArchiveDialog
        count={archive?.length ?? 0}
        hasPassword
        name={archive?.[0]?.name ?? undefined}
        onCancel={() => setArchive(null)}
        onConfirm={async (password) => (password === "test" ? (setArchive(null), null) : "That password isn’t right.")}
        open={archive !== null}
      />
    </AdminShell>
  );
}
