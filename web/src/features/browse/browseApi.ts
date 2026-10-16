import type { Views } from "../../lib/database";
import { PRICE_BANDS, type PriceBand } from "../../lib/domain";
import { supabase } from "../../lib/supabase";

export type ListingCardRow = Pick<
  Views<"listing_rows">,
  | "id"
  | "name"
  | "area"
  | "address"
  | "accommodation_type"
  | "exclusivity_group"
  | "price_band"
  | "rent_exact"
  | "monthly_rental_label"
  | "rooms_available"
  | "has_wifi"
  | "has_study_area"
  | "has_laundry_area"
  | "has_parking_area"
  | "has_common_kitchen"
  | "has_aircon"
  | "has_curfew"
  | "curfew"
  | "distance_km"
  | "location_lat"
  | "location_lng"
  | "cover_bucket"
  | "cover_path"
>;

const CARD_COLUMNS =
  "id, name, area, address, accommodation_type, exclusivity_group, price_band, rent_exact, monthly_rental_label, rooms_available, has_wifi, has_study_area, has_laundry_area, has_parking_area, has_common_kitchen, has_aircon, has_curfew, curfew, distance_km, location_lat, location_lng, cover_bucket, cover_path";

export const EXCLUSIVITY_GROUPS = ["ladies", "men", "mixed"] as const;
export type ExclusivityGroup = (typeof EXCLUSIVITY_GROUPS)[number];

export const EXCLUSIVITY_LABELS: Record<ExclusivityGroup, string> = {
  ladies: "Ladies only",
  men: "Men only",
  mixed: "Mixed",
};

export const AMENITIES = ["wifi", "study", "laundry", "parking", "kitchen", "aircon"] as const;
export type Amenity = (typeof AMENITIES)[number];

export const AMENITY_LABELS: Record<Amenity, string> = {
  wifi: "Wi‑Fi",
  study: "Study area",
  laundry: "Laundry",
  parking: "Parking",
  kitchen: "Kitchen",
  aircon: "Air-con",
};

const AMENITY_COLUMNS: Record<Amenity, keyof ListingCardRow> = {
  wifi: "has_wifi",
  study: "has_study_area",
  laundry: "has_laundry_area",
  parking: "has_parking_area",
  kitchen: "has_common_kitchen",
  aircon: "has_aircon",
};

export const SORTS = ["nearest", "newest", "price"] as const;
export type BrowseSort = (typeof SORTS)[number];

export const SORT_LABELS: Record<BrowseSort, string> = {
  nearest: "Nearest to campus",
  newest: "Newest",
  price: "Lowest price",
};

export type BrowseFilters = {
  q: string;
  area: string;
  band: PriceBand | "";
  type: string;
  who: ExclusivityGroup | "";
  noCurfew: boolean;
  amenities: Amenity[];
  sort: BrowseSort;
};

export const EMPTY_FILTERS: BrowseFilters = {
  q: "",
  area: "",
  band: "",
  type: "",
  who: "",
  noCurfew: false,
  amenities: [],
  sort: "nearest",
};

const oneOf = <T extends string>(values: readonly T[], value: string | null): T | "" =>
  value && (values as readonly string[]).includes(value) ? (value as T) : "";

/** Filters live in the URL so results can be shared and the back button works. */
export function filtersFromParams(params: URLSearchParams): BrowseFilters {
  return {
    q: params.get("q") ?? "",
    area: params.get("area") ?? "",
    band: oneOf(PRICE_BANDS, params.get("budget")),
    type: params.get("type") ?? "",
    who: oneOf(EXCLUSIVITY_GROUPS, params.get("who")),
    noCurfew: params.get("curfew") === "none",
    amenities: (params.get("amenities") ?? "")
      .split(",")
      .filter((value): value is Amenity => (AMENITIES as readonly string[]).includes(value)),
    sort: oneOf(SORTS, params.get("sort")) || "nearest",
  };
}

export function filtersToParams(filters: BrowseFilters) {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.area) params.set("area", filters.area);
  if (filters.band) params.set("budget", filters.band);
  if (filters.type) params.set("type", filters.type);
  if (filters.who) params.set("who", filters.who);
  if (filters.noCurfew) params.set("curfew", "none");
  if (filters.amenities.length) params.set("amenities", filters.amenities.join(","));
  if (filters.sort !== "nearest") params.set("sort", filters.sort);
  return params;
}

export function activeFilterCount(filters: BrowseFilters) {
  return (
    Number(Boolean(filters.area)) +
    Number(Boolean(filters.band)) +
    Number(Boolean(filters.type)) +
    Number(Boolean(filters.who)) +
    Number(filters.noCurfew) +
    filters.amenities.length
  );
}

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

/** Characters that would break a PostgREST `or=(...)` expression. */
function cleanSearch(value: string) {
  return value.replace(/[,()*%\\]/g, " ").replace(/\s+/g, " ").trim();
}

export type BrowsePage = { rows: ListingCardRow[]; total: number };

export async function fetchBrowsePage(filters: BrowseFilters, offset: number, limit: number): Promise<BrowsePage> {
  let query = client().from("listing_rows").select(CARD_COLUMNS, { count: "exact" }).eq("status", "published");

  const search = cleanSearch(filters.q);
  if (search) {
    const pattern = `%${search}%`;
    query = query.or(`name.ilike.${pattern},address.ilike.${pattern},area.ilike.${pattern},accommodation_type.ilike.${pattern}`);
  }
  if (filters.area) query = query.eq("area", filters.area);
  if (filters.band) query = query.eq("price_band", filters.band);
  if (filters.type) query = query.eq("accommodation_type", filters.type);
  if (filters.who) query = query.eq("exclusivity_group", filters.who);
  // Only listings that explicitly say there is no curfew (unknown doesn't count).
  if (filters.noCurfew) query = query.eq("has_curfew", false).not("curfew", "is", null).neq("curfew", "");
  filters.amenities.forEach((amenity) => {
    query = query.eq(AMENITY_COLUMNS[amenity], true);
  });

  if (filters.sort === "nearest") {
    query = query.order("distance_km", { ascending: true, nullsFirst: false });
  } else if (filters.sort === "price") {
    query = query.order("monthly_rent_min", { ascending: true, nullsFirst: false });
  } else {
    query = query.order("published_at", { ascending: false, nullsFirst: false });
  }
  query = query.order("name", { ascending: true }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as ListingCardRow[], total: count ?? 0 };
}

export type FilterOptions = { areas: string[]; types: string[] };

export async function fetchFilterOptions(): Promise<FilterOptions> {
  const { data, error } = await client().from("listing_rows").select("area, accommodation_type").eq("status", "published");
  if (error) throw error;
  const rows = (data ?? []) as Array<{ area: string | null; accommodation_type: string | null }>;
  const unique = (values: Array<string | null>) =>
    Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim())))).sort((a, b) => a.localeCompare(b));
  return { areas: unique(rows.map((row) => row.area)), types: unique(rows.map((row) => row.accommodation_type)) };
}

// ---------------------------------------------------------------------------
// Saved listings
// ---------------------------------------------------------------------------
export async function fetchSavedIds(userId: string): Promise<Set<string>> {
  const { data, error } = await client().from("saved_listings").select("accommodation_id").eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.accommodation_id));
}

export async function saveListing(userId: string, listingId: string) {
  const { error } = await client().from("saved_listings").upsert(
    { user_id: userId, accommodation_id: listingId },
    { onConflict: "user_id,accommodation_id", ignoreDuplicates: true }
  );
  if (error) throw error;
}

export async function unsaveListing(userId: string, listingId: string) {
  const { error } = await client().from("saved_listings").delete().eq("user_id", userId).eq("accommodation_id", listingId);
  if (error) throw error;
}

/** Saved listings that are still published, in the order they were saved (newest first). */
export async function fetchSavedListings(userId: string): Promise<ListingCardRow[]> {
  const { data: saved, error } = await client()
    .from("saved_listings")
    .select("accommodation_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const ids = (saved ?? []).map((row) => row.accommodation_id);
  if (ids.length === 0) return [];

  const { data, error: rowsError } = await client().from("listing_rows").select(CARD_COLUMNS).in("id", ids).eq("status", "published");
  if (rowsError) throw rowsError;
  const byId = new Map(((data ?? []) as ListingCardRow[]).map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter((row): row is ListingCardRow => Boolean(row));
}
