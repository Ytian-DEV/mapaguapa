import type { Tables, Views } from "../../lib/database";
import { STORAGE } from "../../lib/domain";
import { supabase } from "../../lib/supabase";

export type QueueItem = { id: string } & Pick<Views<"listing_rows">, "name" | "submitted_at" | "published_at" | "owner_id" | "owner_name">;
export type SimilarListing = { id: string | null; name: string | null; area: string | null; status: string | null; owner_id: string | null; reason: string | null; score: number | null };
export type Verification = Tables<"owner_verifications"> & { owner_name: string | null; owner_email: string | null };

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

/** Listings waiting for review, oldest submission first. */
export async function fetchQueue(): Promise<QueueItem[]> {
  const { data, error } = await client()
    .from("listing_rows")
    .select("id, name, submitted_at, published_at, owner_id, owner_name")
    .eq("status", "in_review")
    .order("submitted_at", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).filter((row): row is QueueItem => Boolean(row.id));
}

export async function fetchSimilar(listingId: string): Promise<SimilarListing[]> {
  const { data, error } = await client().rpc("similar_listings", { p_listing_id: listingId });
  if (error) throw error;
  return (data ?? []) as SimilarListing[];
}

export async function approveListing(listingId: string) {
  const { error } = await client().from("listings").update({ status: "published" }).eq("id", listingId);
  if (error) throw error;
}

export async function requestChanges(listingId: string, note: string) {
  const { error } = await client().from("listings").update({ status: "changes_requested", review_note: note.trim() }).eq("id", listingId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Owner verifications
// ---------------------------------------------------------------------------
export async function fetchPendingVerifications(): Promise<Verification[]> {
  const { data, error } = await client().from("owner_verifications").select("*").eq("status", "pending").order("created_at");
  if (error) throw error;
  const rows = data ?? [];
  const ids = Array.from(new Set(rows.map((row) => row.owner_id)));
  const people = new Map<string, { full_name: string | null; email: string | null }>();
  if (ids.length) {
    const { data: profiles } = await client().from("profiles").select("id, full_name, email").in("id", ids);
    (profiles ?? []).forEach((profile) => people.set(profile.id, profile));
  }
  return rows.map((row) => ({ ...row, owner_name: people.get(row.owner_id)?.full_name ?? null, owner_email: people.get(row.owner_id)?.email ?? null }));
}

/** Short-lived links to the private documents. */
export async function signDocuments(paths: string[]) {
  if (paths.length === 0) return new Map<string, string>();
  const { data, error } = await client().storage.from(STORAGE.ownerVerifications).createSignedUrls(paths, 10 * 60);
  if (error) throw error;
  return new Map((data ?? []).filter((item) => item.path && item.signedUrl).map((item) => [item.path as string, item.signedUrl]));
}

export async function decideVerification(id: string, decision: "approved" | "rejected", note: string) {
  const { error } = await client().from("owner_verifications").update({ status: decision, review_note: note.trim() || null }).eq("id", id);
  if (error) throw error;
}
