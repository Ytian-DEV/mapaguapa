import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import type { ListingStatus } from "../../lib/domain";
import { useToast } from "../../ui";
import { exportAllListings } from "./adminApi";
import { useAdminData } from "./AdminDataContext";
import {
  adminFiltersFromParams,
  adminFiltersToParams,
  archiveListings,
  confirmPassword,
  exportRows,
  fetchAdminListings,
  fetchListingFacets,
  fetchTabCounts,
  restoreListing,
  type AdminListingFilters,
  type AdminTableRow,
} from "./adminListingsApi";
import { AdminListingsView } from "./AdminListingsView";
import { ArchiveDialog } from "./ArchiveDialog";
import { reportError } from "../../lib/errors";

/** /admin/listings (and /admin/archive → Archived tab). Replaces the v1 listing and archive pages. */
export default function AdminListingsPage({ initialTab }: { initialTab?: ListingStatus }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const { refresh: refreshCounts } = useAdminData();
  const toast = useToast();
  const filters = useMemo(() => {
    const parsed = adminFiltersFromParams(params);
    return initialTab && !params.get("tab") ? { ...parsed, tab: initialTab } : parsed;
  }, [params, initialTab]);
  const key = adminFiltersToParams(filters).toString();

  const [rows, setRows] = useState<AdminTableRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<ListingStatus, number> | null>(null);
  const [facets, setFacets] = useState<{ areas: string[]; types: string[] }>({ areas: [], types: [] });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [archiveTarget, setArchiveTarget] = useState<AdminTableRow[] | null>(null);
  const [reload, setReload] = useState(0);
  const request = useRef(0);

  // Google-only accounts have no password to re-enter.
  const hasPassword = Boolean(session?.user?.identities?.some((identity) => identity.provider === "email"));

  useEffect(() => {
    document.title = `${filters.tab === "archived" ? "Archive" : "Listings"} · Admin · mapaguapa`;
  }, [filters.tab]);

  useEffect(() => {
    fetchListingFacets().then(setFacets, () => undefined);
  }, []);

  useEffect(() => {
    const id = ++request.current;
    const current = adminFiltersFromParams(new URLSearchParams(key));
    const effective = initialTab && !new URLSearchParams(key).get("tab") ? { ...current, tab: initialTab } : current;
    setStatus("loading");
    setSelected(new Set());
    Promise.all([fetchAdminListings(effective), fetchTabCounts(effective)])
      .then(([page, tabCounts]) => {
        if (id !== request.current) return;
        setRows(page.rows);
        setTotal(page.total);
        setCounts(tabCounts);
        setStatus("ready");
      })
      .catch((error) => {
        reportError(error);
        if (id === request.current) setStatus("error");
      });
  }, [key, initialTab, reload]);

  const onChange = useCallback(
    (patch: Partial<AdminListingFilters>) => {
      // /admin/archive is the Archived tab; other tabs live under /admin/listings.
      if (initialTab && patch.tab && patch.tab !== initialTab) {
        const next = adminFiltersToParams({ ...adminFiltersFromParams(new URLSearchParams()), ...patch });
        navigate(`/admin/listings${next.toString() ? `?${next.toString()}` : ""}`);
        return;
      }
      setParams(
        (current) => {
          const base = adminFiltersFromParams(current);
          const withTab = initialTab && !current.get("tab") ? { ...base, tab: initialTab } : base;
          return adminFiltersToParams({ ...withTab, ...patch });
        },
        { replace: "q" in patch }
      );
    },
    [initialTab, navigate, setParams]
  );

  const afterChange = () => {
    setReload((value) => value + 1);
    void refreshCounts();
  };

  const onArchiveConfirm = async (password: string, reason: string) => {
    if (!archiveTarget || !profile?.email) return "Your account has no email to confirm.";
    try {
      await confirmPassword(profile.email, password);
    } catch (error) {
      return error instanceof Error ? error.message : "That password isn’t right.";
    }
    const result = await archiveListings(
      archiveTarget.map((row) => row.id),
      reason
    );
    setArchiveTarget(null);
    if (result.failures.length) toast.error(`${result.archived} archived, ${result.failures.length} failed: ${result.failures[0]}`);
    else toast.success(`${result.archived} ${result.archived === 1 ? "listing" : "listings"} archived.`);
    afterChange();
    return null;
  };

  const onRestore = async (row: AdminTableRow) => {
    try {
      await restoreListing(row.id);
      toast.success(`${row.name} is published again.`);
      afterChange();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t restore the listing.");
    }
  };

  const onExport = async (selection: AdminTableRow[] | null) => {
    try {
      if (selection) exportRows(selection, `listings-selected`);
      else await exportAllListings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.");
    }
  };

  return (
    <>
      <AdminListingsView
        counts={counts}
        facets={facets}
        filters={filters}
        onArchive={setArchiveTarget}
        onChange={onChange}
        onExport={(selection) => void onExport(selection)}
        onRestore={(row) => void onRestore(row)}
        onRetry={() => setReload((value) => value + 1)}
        onSelectionChange={setSelected}
        rows={rows}
        selected={selected}
        status={status}
        total={total}
      />
      <ArchiveDialog
        count={archiveTarget?.length ?? 0}
        hasPassword={hasPassword}
        name={archiveTarget?.[0]?.name ?? undefined}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={onArchiveConfirm}
        open={archiveTarget !== null}
      />
    </>
  );
}
