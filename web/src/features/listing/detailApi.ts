import type { Tables, Views } from "../../lib/database";
import { supabase } from "../../lib/supabase";

export type ListingDetail = Tables<"listings">;
export type ListingPhoto = Tables<"listing_photos">;
export type OwnerCard = Views<"profile_cards">;

export type ListingDetailBundle = {
  listing: ListingDetail;
  photos: ListingPhoto[];
  owner: OwnerCard | null;
};

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

/** Listing + ordered photos + the owner's public card. Returns null when not visible to the caller. */
export async function fetchListingDetail(listingId: string): Promise<ListingDetailBundle | null> {
  const [listingResult, photosResult] = await Promise.all([
    client().from("listings").select("*").eq("id", listingId).maybeSingle(),
    client()
      .from("listing_photos")
      .select("*")
      .eq("listing_id", listingId)
      .order("is_cover", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (listingResult.error) throw listingResult.error;
  if (photosResult.error) throw photosResult.error;
  const listing = listingResult.data;
  if (!listing) return null;

  let owner: OwnerCard | null = null;
  if (listing.owner_id) {
    const { data } = await client().from("profile_cards").select("*").eq("id", listing.owner_id).maybeSingle();
    owner = data ?? null;
  }

  return { listing, photos: photosResult.data ?? [], owner };
}

/** Opens (or reuses) the student's conversation with the owner. */
export async function startConversation(listingId: string) {
  const { data, error } = await client().rpc("start_conversation", { p_listing_id: listingId });
  if (error) throw error;
  return data as string;
}
