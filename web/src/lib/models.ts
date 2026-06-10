import { listingPhotosBucket, supabase } from "./supabase";
import type { Database } from "./database";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
export type ListingPhotoRow = Database["public"]["Tables"]["listing_photos"]["Row"];
export type DeletedListingRow = Database["public"]["Tables"]["deleted_listings"]["Row"];

export type ListingWithPhotos = ListingRow & {
  listing_photos?: ListingPhotoRow[] | null;
};

export type ListingCardSummary = Pick<
  ListingRow,
  | "id"
  | "name"
  | "address"
  | "accommodation_type"
  | "exclusivity"
  | "monthly_rental_label"
  | "monthly_rent_min"
  | "monthly_rent_max"
  | "rooms_available"
  | "has_wifi"
  | "has_study_area"
  | "has_laundry_area"
  | "has_parking_area"
  | "pets_allowed"
  | "visitors_allowed"
  | "created_at"
> & {
  cover_photo?: ListingPhotoRow | null;
};

export function toPublicPhotoUrl(photo: Pick<ListingPhotoRow, "storage_bucket" | "storage_path">) {
  if (!supabase || !photo.storage_path) {
    return "";
  }

  const bucket = photo.storage_bucket || listingPhotosBucket;
  return supabase.storage.from(bucket).getPublicUrl(photo.storage_path).data.publicUrl;
}

export function getListingCover(listing: ListingWithPhotos) {
  const photos = [...(listing.listing_photos ?? [])].sort((left, right) => {
    if (left.is_cover !== right.is_cover) {
      return left.is_cover ? -1 : 1;
    }

    return left.sort_order - right.sort_order;
  });

  const cover = photos[0];
  return cover ? toPublicPhotoUrl(cover) : "";
}

export function getListingCardCover(listing: ListingCardSummary) {
  return listing.cover_photo ? toPublicPhotoUrl(listing.cover_photo) : "";
}

export function formatSignals(signals: string[] | null | undefined, raw: string | null | undefined) {
  if (signals && signals.length > 0) {
    return signals.join(", ");
  }

  return raw || "Not specified";
}

export function fallbackDescription(
  listing: Pick<ListingRow, "accommodation_type" | "address" | "exclusivity" | "monthly_rental_label"> & {
    description?: string | null;
  }
) {
  if (listing.description?.trim()) {
    return listing.description;
  }

  return `${listing.accommodation_type} in ${listing.address} with ${listing.monthly_rental_label.toLowerCase()} rental range and ${listing.exclusivity?.toLowerCase() || "open"} setup.`;
}

export function labelBoolean(value: boolean | null | undefined, positive = "Available", negative = "Not available") {
  return value ? positive : negative;
}
