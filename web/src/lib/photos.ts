import { listingPhotosBucket, supabase } from "./supabase";

/** Public URL for a listing photo (the listing-photos bucket is public). */
export function publicPhotoUrl(bucket: string | null | undefined, path: string | null | undefined) {
  if (!supabase || !path) return "";
  return supabase.storage.from(bucket || listingPhotosBucket).getPublicUrl(path).data.publicUrl;
}
