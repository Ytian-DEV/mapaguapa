import type { Views } from "../../lib/database";
import { LISTING_STATUSES, PRICE_BANDS, type ListingStatus, type PriceBand } from "../../lib/domain";
import { downloadCsv, toCsv } from "../../lib/csv";
import { supabase } from "../../lib/supabase";

export type AdminTableRow = { id: string } & Pick<
  Views<"listing_rows">,
  | "name"
  | "area"
  | "address"
  | "accommodation_type"
  | "price_band"
  | "monthly_rental_label"
  | "status"
  | "added_by"
  | "owner_name"
  | "photo_count"
  | "updated_at"
  | "archived_at"
  | "cover_bucket"
  | "cover_path"
>;

const COLUMNS =
  "id, name, area, address, accommodation_type, price_band, monthly_rental_label, status, added_by, owner_name, photo_count, updated_at, archived_at, cover_bucket, cover_path";

export type AdminListingFilters = {
  tab: ListingStatus;
  q: string;
  area: string;
  type: string;
  band: PriceBand | "";
  addedBy: "" | "owner" | "admin";
  noPhotos: boolean;
  page: number;
};

export const ADMIN_PAGE_SIZE = 20;

const pick = <T extends string>(values: readonly T[], value: string | null, fallback: T | "" = ""): T | "" =>
  value && (values as readonly string[]).includes(value) ? (value as T) : fallback;

export function adminFiltersFromParams(params: URLSearchParams): AdminListingFilters {
  return {
    tab: (pick(LISTING_STATUSES, params.get("tab"), "published") || "published") as ListingStatus,
    q: params.get("q") ?? "",
    area: params.get("area") ?? "",
    type: params.get("type") ?? "",
    band: pick(PRICE_BANDS, params.get("price")),
    addedBy: pick(["owner", "admin"] as const, params.get("added")),
    noPhotos: params.get("photos") === "none",
    page: Math.max(0, Number.parseInt(params.get("page") ?? "1", 10) - 1 || 0),
  };
}

export function adminFiltersToParams(filters: AdminListingFilters) {
  const params = new URLSearchParams();
  if (filters.tab !== "published") params.set("tab", filters.tab);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.area) params.set("area", filters.area);
  if (filters.type) params.set("type", filters.type);
  if (filters.band) params.set("price", filters.band);
  if (filters.addedBy) params.set("added", filters.addedBy);
  if (filters.noPhotos) params.set("photos", "none");
  if (filters.page > 0) params.set("page", String(filters.page + 1));
  return params;
}

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

const clean = (value: string) => value.replace(/[,()*%\\]/g, " ").replace(/\s+/g, " ").trim();

/** The subset of the PostgREST builder used here (method syntax keeps it assignable). */
type FilterableQuery<Q> = {
  eq(column: string, value: unknown): Q;
  or(filters: string): Q;
};

function applyFilters<Q extends FilterableQuery<Q>>(query: Q, filters: Omit<AdminListingFilters, "page" | "tab">): Q {
  let next = query;
  const search = clean(filters.q);
  if (search) {
    const pattern = `%${search}%`;
    next = next.or(`name.ilike.${pattern},address.ilike.${pattern},area.ilike.${pattern},owner_name.ilike.${pattern}`);
  }
  if (filters.area) next = next.eq("area", filters.area);
  if (filters.type) next = next.eq("accommodation_type", filters.type);
  if (filters.band) next = next.eq("price_band", filters.band);
  if (filters.addedBy) next = next.eq("added_by", filters.addedBy);
  if (filters.noPhotos) next = next.eq("photo_count", 0);
  return next;
}

export async function fetchAdminListings(filters: AdminListingFilters) {
  const from = filters.page * ADMIN_PAGE_SIZE;
  const { data, error, count } = await applyFilters(
    client().from("listing_rows").select(COLUMNS, { count: "exact" }).eq("status", filters.tab),
    filters
  )
    .order(filters.tab === "archived" ? "archived_at" : "updated_at", { ascending: false, nullsFirst: false })
    .order("name")
    .range(from, from + ADMIN_PAGE_SIZE - 1);
  if (error) throw error;
  return { rows: (data ?? []).filter((row): row is AdminTableRow => Boolean(row.id)), total: count ?? 0 };
}

/** Count per status tab for the current search / filters (head requests, no rows). */
export async function fetchTabCounts(filters: AdminListingFilters): Promise<Record<ListingStatus, number>> {
  const entries = await Promise.all(
    LISTING_STATUSES.map(async (status) => {
      const { count } = await applyFilters(client().from("listing_rows").select("id", { count: "exact", head: true }).eq("status", status), filters);
      return [status, count ?? 0] as const;
    })
  );
  return Object.fromEntries(entries) as Record<ListingStatus, number>;
}

export async function fetchListingFacets() {
  const { data, error } = await client().from("listing_rows").select("area, accommodation_type");
  if (error) throw error;
  const unique = (values: Array<string | null>) => Array.from(new Set(values.filter((v): v is string => Boolean(v?.trim())))).sort((a, b) => a.localeCompare(b));
  return { areas: unique((data ?? []).map((row) => row.area)), types: unique((data ?? []).map((row) => row.accommodation_type)) };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Archiving needs the admin's password again (same rule as v1). */
export async function confirmPassword(email: string, password: string) {
  const { error } = await client().auth.signInWithPassword({ email, password });
  if (error) throw new Error("That password isn’t right.");
}

export async function archiveListings(ids: string[], reason: string) {
  const failures: string[] = [];
  for (const id of ids) {
    const { error } = await client().rpc("archive_listing", { p_listing_id: id, p_delete_reason: reason.trim() || undefined });
    if (error) failures.push(error.message);
  }
  return { archived: ids.length - failures.length, failures };
}

export async function restoreListing(id: string) {
  const { error } = await client().rpc("restore_listing", { p_listing_id: id });
  if (error) throw error;
}

export function exportRows(rows: AdminTableRow[], label: string) {
  const csv = toCsv(rows as unknown as Array<Record<string, unknown>>, [
    { key: "name", label: "Name" },
    { key: "status", label: "Status" },
    { key: "area", label: "Area" },
    { key: "address", label: "Address" },
    { key: "accommodation_type", label: "Type" },
    { key: "monthly_rental_label", label: "Price" },
    { key: "added_by", label: "Added by" },
    { key: "owner_name", label: "Owner" },
    { key: "photo_count", label: "Photos" },
    { key: "updated_at", label: "Updated" },
  ]);
  downloadCsv(`mapaguapa-${label}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
