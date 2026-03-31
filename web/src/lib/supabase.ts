import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);
export const listingPhotosBucket =
  import.meta.env.VITE_SUPABASE_LISTING_PHOTOS_BUCKET?.trim() || "listing-photos";

export const supabase: SupabaseClient<Database> | null = hasSupabaseEnv
  ? createClient<Database>(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;