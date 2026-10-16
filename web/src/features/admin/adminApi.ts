import type { Tables } from "../../lib/database";
import type { PriceBand } from "../../lib/domain";
import { downloadCsv, toCsv } from "../../lib/csv";
import { supabase } from "../../lib/supabase";
import type { OwnerListing } from "../owner/ownerApi";

export type AdminOverview = {
  listings: {
    published: number;
    in_review: number;
    changes_requested: number;
    drafts: number;
    archived: number;
    oldest_in_review_at: string | null;
    published_without_photos: number;
  };
  photos: number;
  price_bands: Record<PriceBand, number>;
  users: { total: number; students: number; owners: number; admins: number; deactivated: number; possible_duplicates: number };
  reports: { open: number; latest_open_reason: string | null };
  verifications: { pending: number };
};

export type ActivityRow = Tables<"activity_log">;
export type ActivityWithActor = ActivityRow & { actor_name: string | null };

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const { data, error } = await client().rpc("admin_overview");
  if (error) throw error;
  return data as unknown as AdminOverview;
}

export async function fetchRecentActivity(limit = 6): Promise<ActivityWithActor[]> {
  const { data, error } = await client().from("activity_log").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  const rows = data ?? [];
  const actorIds = Array.from(new Set(rows.map((row) => row.actor_id).filter((id): id is string => Boolean(id))));
  const names = new Map<string, string | null>();
  if (actorIds.length > 0) {
    const { data: people } = await client().from("profiles").select("id, full_name, email").in("id", actorIds);
    (people ?? []).forEach((person) => names.set(person.id, person.full_name || person.email));
  }
  return rows.map((row) => ({ ...row, actor_name: row.actor_id ? names.get(row.actor_id) ?? null : null }));
}

export type AdminListingRow = OwnerListing & { added_by: string | null; owner_name: string | null };

export async function fetchRecentlyUpdatedListings(limit = 4): Promise<AdminListingRow[]> {
  const { data, error } = await client()
    .from("listing_rows")
    .select(
      "id, name, area, exclusivity_group, price_band, monthly_rental_label, status, review_note, rooms_total, rooms_available, updated_at, submitted_at, published_at, draft_step, cover_bucket, cover_path, photo_count, added_by, owner_name"
    )
    .neq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).filter((row): row is AdminListingRow => Boolean(row.id));
}

const EXPORT_COLUMNS = [
  { key: "name", label: "Name" },
  { key: "status", label: "Status" },
  { key: "area", label: "Area" },
  { key: "address", label: "Address" },
  { key: "accommodation_type", label: "Type" },
  { key: "exclusivity_group", label: "Who can stay" },
  { key: "monthly_rental_label", label: "Price" },
  { key: "rent_exact", label: "Rent per person" },
  { key: "rooms_total", label: "Rooms" },
  { key: "rooms_available", label: "Available" },
  { key: "photo_count", label: "Photos" },
  { key: "added_by", label: "Added by" },
  { key: "owner_name", label: "Owner" },
  { key: "updated_at", label: "Updated" },
] as const;

/** Export every listing the admin can see (all statuses) as CSV. */
export async function exportAllListings() {
  const { data, error } = await client()
    .from("listing_rows")
    .select(EXPORT_COLUMNS.map((column) => column.key).join(", "))
    .order("name");
  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  downloadCsv(`mapaguapa-listings-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows, EXPORT_COLUMNS.map((column) => ({ ...column }))));
}
