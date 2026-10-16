import type { Tables, TablesUpdate } from "../../lib/database";
import { STORAGE } from "../../lib/domain";
import { compressImageForUpload } from "../../lib/imageCompression";
import { supabase } from "../../lib/supabase";
import type { WizardForm, WizardListing } from "./wizardModel";

export type WizardPhoto = Tables<"listing_photos">;
export type WizardMode = "owner" | "admin";

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function fetchForEdit(listingId: string): Promise<{ listing: WizardListing; photos: WizardPhoto[] } | null> {
  const [listing, photos] = await Promise.all([
    client().from("listings").select("*").eq("id", listingId).maybeSingle(),
    client().from("listing_photos").select("*").eq("listing_id", listingId).order("is_cover", { ascending: false }).order("sort_order"),
  ]);
  if (listing.error) throw listing.error;
  if (photos.error) throw photos.error;
  if (!listing.data) return null;
  return { listing: listing.data, photos: photos.data ?? [] };
}

/** First save of a new listing; the database fills owner, band and label. */
export async function createDraft(form: WizardForm, step: number): Promise<WizardListing> {
  const { data, error } = await client()
    .from("listings")
    .insert({ ...form, monthly_rental_label: "", status: "draft", draft_step: step })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function saveListing(listingId: string, patch: TablesUpdate<"listings">): Promise<WizardListing> {
  const { data, error } = await client().from("listings").update(patch).eq("id", listingId).select("*").single();
  if (error) throw error;
  return data;
}

/** Owners: draft / changes requested -> in review. Admins: publish directly. */
export async function submitListing(listingId: string, mode: WizardMode) {
  return saveListing(listingId, { status: mode === "admin" ? "published" : "in_review" });
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------
export const MAX_PHOTOS = 20;
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

export async function uploadPhoto(listingId: string, mode: WizardMode, file: File, sortOrder: number, isCover: boolean): Promise<WizardPhoto> {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} isn’t an image.`);
  if (file.size > MAX_PHOTO_BYTES) throw new Error(`${file.name} is larger than 15 MB.`);
  const optimized = await compressImageForUpload(file);
  const extension = (optimized.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const path = mode === "admin" ? STORAGE.adminListingPhotoPath(listingId, fileName) : STORAGE.ownerListingPhotoPath(listingId, fileName);

  const upload = await client().storage.from(STORAGE.listingPhotos).upload(path, optimized, { contentType: optimized.type, upsert: false });
  if (upload.error) throw upload.error;

  const { data, error } = await client()
    .from("listing_photos")
    .insert({ listing_id: listingId, storage_bucket: STORAGE.listingPhotos, storage_path: path, sort_order: sortOrder, is_cover: isCover })
    .select("*")
    .single();
  if (error) {
    await client().storage.from(STORAGE.listingPhotos).remove([path]);
    throw error;
  }
  return data;
}

/** Persists order and cover in one pass (cover is always first). */
export async function savePhotoOrder(photos: WizardPhoto[]) {
  const updates = photos.map((photo, index) =>
    client()
      .from("listing_photos")
      .update({ sort_order: index, is_cover: index === 0 })
      .eq("id", photo.id)
  );
  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
}

export async function updatePhotoAlt(photoId: string, altText: string) {
  const { error } = await client().from("listing_photos").update({ alt_text: altText.trim() || null }).eq("id", photoId);
  if (error) throw error;
}

export async function deletePhoto(photo: WizardPhoto) {
  const { error } = await client().from("listing_photos").delete().eq("id", photo.id);
  if (error) throw error;
  // Best effort: a stray file is harmless, a stray row is not.
  await client().storage.from(photo.storage_bucket || STORAGE.listingPhotos).remove([photo.storage_path]);
}
