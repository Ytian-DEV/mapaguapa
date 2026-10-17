import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, Download, Eye, ImageOff, Pencil, Plus, RotateCcw, Search } from "lucide-react";
import { PRICE_BAND_LABELS, PRICE_BANDS, type ListingStatus, type PriceBand } from "../../lib/domain";
import { publicPhotoUrl } from "../../lib/photos";
import {
  Badge,
  BulkBar,
  Button,
  ButtonLink,
  DataTable,
  EmptyState,
  FilterSelect,
  Input,
  Menu,
  PageHeader,
  Pagination,
  StatusBadge,
  Tabs,
  type Column,
  type MenuItem,
} from "../../ui";
import { ADMIN_PAGE_SIZE, type AdminListingFilters, type AdminTableRow } from "./adminListingsApi";
import "./admin.css";

const TAB_LABELS: Record<ListingStatus, string> = {
  published: "Published",
  in_review: "In review",
  changes_requested: "Changes requested",
  draft: "Drafts",
  archived: "Archived",
};
const TAB_ORDER: ListingStatus[] = ["published", "in_review", "changes_requested", "draft", "archived"];

const dateFmt = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" });

function updatedLabel(iso: string | null) {
  if (!iso) return "—";
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (hours < 1) return "Just now";
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  return dateFmt.format(new Date(iso));
}

export type AdminListingsViewProps = {
  filters: AdminListingFilters;
  onChange: (patch: Partial<AdminListingFilters>) => void;
  rows: AdminTableRow[];
  total: number;
  counts: Record<ListingStatus, number> | null;
  facets: { areas: string[]; types: string[] };
  status: "loading" | "ready" | "error";
  onRetry: () => void;
  selected: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onArchive: (rows: AdminTableRow[]) => void;
  onRestore: (row: AdminTableRow) => void;
  onExport: (rows: AdminTableRow[] | null) => void;
};

/** Admin Listings (frame A2). Presentational; the page owns data and actions. */
export function AdminListingsView(props: AdminListingsViewProps) {
  const { filters, onChange, rows, total, counts, facets, status, selected } = props;
  const navigate = useNavigate();
  const [search, setSearch] = useState(filters.q);
  useEffect(() => setSearch(filters.q), [filters.q]);
  useEffect(() => {
    if (search === filters.q) return undefined;
    const timer = window.setTimeout(() => onChange({ q: search, page: 0 }), 300);
    return () => window.clearTimeout(timer);
  }, [search, filters.q, onChange]);

  const archivedTab = filters.tab === "archived";
  const selectedRows = rows.filter((row) => selected.has(row.id));

  const rowMenu = (row: AdminTableRow): MenuItem[] => {
    const items: MenuItem[] = [];
    if (row.status !== "archived") {
      items.push({ key: "view", label: "View", icon: <Eye />, onSelect: () => navigate(`/admin/listings/${row.id}/preview`) });
      items.push({ key: "edit", label: "Edit", icon: <Pencil />, onSelect: () => navigate(`/admin/listings/${row.id}/edit/basics`) });
      items.push({ key: "archive", label: "Archive", icon: <Archive />, destructive: true, onSelect: () => props.onArchive([row]) });
    } else {
      items.push({ key: "restore", label: "Restore", icon: <RotateCcw />, onSelect: () => props.onRestore(row) });
    }
    return items;
  };

  const columns: Column<AdminTableRow>[] = [
    {
      key: "listing",
      header: "Listing",
      primary: true,
      cell: (row) => {
        const photo = publicPhotoUrl(row.cover_bucket, row.cover_path);
        return (
          <span className="admin-cell-listing">
            <span className="admin-thumb">{photo ? <img alt="" loading="lazy" src={photo} /> : <ImageOff aria-hidden="true" />}</span>
            <span className="admin-cell-listing__text">
              <strong>{row.name || "Untitled draft"}</strong>
              <span>{row.area}</span>
            </span>
          </span>
        );
      },
    },
    { key: "type", header: "Type", hideOnMobile: true, cell: (row) => row.accommodation_type },
    { key: "price", header: "Price", cell: (row) => (row.price_band ? PRICE_BAND_LABELS[row.price_band as PriceBand] : row.monthly_rental_label || "—") },
    {
      key: "added",
      header: "Added by",
      hideOnMobile: true,
      cell: (row) => <Badge tone={row.added_by === "owner" ? "clay" : "gray"}>{row.added_by === "owner" ? "Owner" : "Admin"}</Badge>,
    },
    {
      key: "photos",
      header: "Photos",
      cell: (row) => <span className={(row.photo_count ?? 0) === 0 ? "admin-cell-zero" : undefined}>{row.photo_count ?? 0}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (row) =>
        row.status === "published" && (row.photo_count ?? 0) === 0 ? (
          <Badge dot tone="amber">
            Needs photos
          </Badge>
        ) : (
          <StatusBadge status={(row.status ?? "draft") as ListingStatus} />
        ),
    },
    { key: "updated", header: archivedTab ? "Archived" : "Updated", cell: (row) => updatedLabel(archivedTab ? row.archived_at : row.updated_at) },
  ];

  const subtitle = counts
    ? `${counts.published} published · ${counts.in_review} in review · archived listings can be restored anytime.`
    : "Everything students can see, plus drafts and the archive.";

  const hasFilters = Boolean(filters.q || filters.area || filters.type || filters.band || filters.addedBy || filters.noPhotos);

  return (
    <div className="admin-listings">
      <PageHeader
        actions={
          <>
            <Button leadingIcon={<Download />} onClick={() => props.onExport(null)} variant="secondary">
              Export
            </Button>
            <ButtonLink leadingIcon={<Plus />} to="/admin/listings/new/edit/basics">
              Add listing
            </ButtonLink>
          </>
        }
        eyebrow="Catalog"
        subtitle={subtitle}
        title="Listings"
      />

      <Tabs
        idPrefix="admin-listings"
        items={TAB_ORDER.map((value) => ({ value, label: TAB_LABELS[value], count: counts?.[value] }))}
        label="Listing status"
        onChange={(tab) => onChange({ tab, page: 0 })}
        value={filters.tab}
      />

      <div className="admin-toolbar">
        <Input
          aria-label="Search listings"
          className="admin-toolbar__search"
          leadingIcon={<Search />}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, barangay, or owner"
          type="search"
          value={search}
        />
        <FilterSelect anyLabel="All" label="Area" layout="inline" onChange={(event) => onChange({ area: event.target.value, page: 0 })} options={facets.areas.map((value) => ({ value, label: value }))} value={filters.area} />
        <FilterSelect anyLabel="All" label="Type" layout="inline" onChange={(event) => onChange({ type: event.target.value, page: 0 })} options={facets.types.map((value) => ({ value, label: value }))} value={filters.type} />
        <FilterSelect
          anyLabel="All"
          label="Price"
          layout="inline"
          onChange={(event) => onChange({ band: event.target.value as PriceBand | "", page: 0 })}
          options={PRICE_BANDS.map((value) => ({ value, label: PRICE_BAND_LABELS[value] }))}
          value={filters.band}
        />
        <FilterSelect
          anyLabel="All"
          label="Added by"
          layout="inline"
          onChange={(event) => onChange({ addedBy: event.target.value as AdminListingFilters["addedBy"], page: 0 })}
          options={[
            { value: "owner", label: "Owner" },
            { value: "admin", label: "Admin" },
          ]}
          value={filters.addedBy}
        />
        {filters.noPhotos && (
          <Button onClick={() => onChange({ noPhotos: false, page: 0 })} size="sm" variant="secondary">
            Without photos ✕
          </Button>
        )}
      </div>

      <BulkBar count={selectedRows.length} onClear={() => props.onSelectionChange(new Set())}>
        {!archivedTab && (
          <Button leadingIcon={<Archive />} onClick={() => props.onArchive(selectedRows)}>
            Archive
          </Button>
        )}
        <Button leadingIcon={<Download />} onClick={() => props.onExport(selectedRows)}>
          Export
        </Button>
      </BulkBar>

      {status === "error" ? (
        <EmptyState
          action={
            <Button onClick={props.onRetry} variant="secondary">
              Try again
            </Button>
          }
          title="Couldn’t load listings"
          tone="error"
        />
      ) : (
        <DataTable
          caption={`${TAB_LABELS[filters.tab]} listings`}
          columns={columns}
          empty={
            <EmptyState
              compact
              description={hasFilters ? "Try clearing the search or filters." : undefined}
              title={hasFilters ? "No listings match" : `No ${TAB_LABELS[filters.tab].toLowerCase()} listings`}
            />
          }
          getRowId={(row) => row.id}
          loading={status === "loading"}
          onSelectionChange={props.onSelectionChange}
          rowActions={(row) =>
            row.status === "archived" ? (
              <Button leadingIcon={<RotateCcw />} onClick={() => props.onRestore(row)} size="sm" variant="secondary">
                Restore
              </Button>
            ) : (
              <Menu items={rowMenu(row)} label={`Actions for ${row.name}`} />
            )
          }
          rows={rows}
          selectable
          selectedIds={selected}
        />
      )}

      {status === "ready" && total > 0 && (
        <Pagination itemLabel="listings" onPageChange={(page) => onChange({ page })} page={filters.page} pageSize={ADMIN_PAGE_SIZE} total={total} />
      )}
    </div>
  );
}
