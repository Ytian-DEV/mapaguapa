import type { Tables, Views } from "../../lib/database";
import { STORAGE, type VerificationDocumentType } from "../../lib/domain";
import { supabase } from "../../lib/supabase";
import { compressImageForUpload } from "../../lib/imageCompression";

export type OwnerListing = { id: string } & Pick<
  Views<"listing_rows">,
  | "name"
  | "area"
  | "exclusivity_group"
  | "price_band"
  | "monthly_rental_label"
  | "status"
  | "review_note"
  | "rooms_total"
  | "rooms_available"
  | "updated_at"
  | "submitted_at"
  | "published_at"
  | "draft_step"
  | "cover_bucket"
  | "cover_path"
  | "photo_count"
>;

export type OwnerOverview = {
  views_30d: number;
  views_prev_30d: number;
  new_inquiries: number;
  unread: number;
  avg_reply_minutes: number | null;
  listings: Array<{ id: string; views_30d: number; inquiries: number }>;
};

export type Verification = Tables<"owner_verifications">;
export type UpcomingVisit = Tables<"visit_requests">;

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function fetchOwnerListings(ownerId: string): Promise<OwnerListing[]> {
  const { data, error } = await client()
    .from("listing_rows")
    .select(
      "id, name, area, exclusivity_group, price_band, monthly_rental_label, status, review_note, rooms_total, rooms_available, updated_at, submitted_at, published_at, draft_step, cover_bucket, cover_path, photo_count"
    )
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).filter((row): row is OwnerListing => Boolean(row.id));
}

export async function fetchOwnerOverview(): Promise<OwnerOverview> {
  const { data, error } = await client().rpc("owner_overview");
  if (error) throw error;
  return data as unknown as OwnerOverview;
}

/** Pending or confirmed visits from now on, soonest first (RLS: own conversations only). */
export async function fetchUpcomingVisits(limit = 5): Promise<UpcomingVisit[]> {
  const { data, error } = await client()
    .from("visit_requests")
    .select("*")
    .in("status", ["pending", "confirmed"])
    .gte("proposed_at", new Date().toISOString())
    .order("proposed_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------
export async function fetchMyVerifications(): Promise<Verification[]> {
  const { data, error } = await client().from("owner_verifications").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

const MAX_DOC_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_DOC_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

export async function submitVerification(ownerId: string, input: { documentType: VerificationDocumentType; files: File[]; note: string }) {
  if (input.files.length === 0 || input.files.length > 5) throw new Error("Attach 1 to 5 files.");
  for (const file of input.files) {
    if (file.size > MAX_DOC_BYTES) throw new Error(`${file.name} is larger than 10 MB.`);
    if (file.type && !ACCEPTED_DOC_TYPES.includes(file.type)) throw new Error(`${file.name} isn’t a photo or PDF.`);
  }

  const paths: string[] = [];
  for (const original of input.files) {
    // Photos of documents are resized like listing photos; PDFs (and HEIC, which browsers can't decode) upload as-is.
    const file = await compressImageForUpload(original);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const path = STORAGE.verificationPath(ownerId, `${crypto.randomUUID()}-${safeName}`);
    const { error } = await client().storage.from(STORAGE.ownerVerifications).upload(path, file, { contentType: file.type || undefined });
    if (error) throw error;
    paths.push(path);
  }

  const { error } = await client()
    .from("owner_verifications")
    .insert({ document_type: input.documentType, document_paths: paths, note: input.note.trim() || null });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
export async function updateMyProfile(userId: string, input: { fullName: string; phone: string }) {
  const { error } = await client()
    .from("profiles")
    .update({ full_name: input.fullName.trim() || null, phone: input.phone.trim() || null })
    .eq("id", userId);
  if (error) throw error;
}
