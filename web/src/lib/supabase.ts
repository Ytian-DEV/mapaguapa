import { createClient, type SupabaseClient, type SupportedStorage } from "@supabase/supabase-js";
import type { Database } from "./database";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);
export const listingPhotosBucket =
  import.meta.env.VITE_SUPABASE_LISTING_PHOTOS_BUCKET?.trim() || "listing-photos";

const REMEMBER_KEY = "mapaguapa:remember-device";

function safeStorage(kind: "localStorage" | "sessionStorage"): Storage | null {
  try {
    return window[kind];
  } catch {
    return null;
  }
}

/** "Keep me signed in on this device": false keeps the session for this tab only. */
export function setRememberDevice(remember: boolean) {
  safeStorage("localStorage")?.setItem(REMEMBER_KEY, remember ? "true" : "false");
}

function rememberDevice() {
  return safeStorage("localStorage")?.getItem(REMEMBER_KEY) !== "false";
}

/**
 * Session storage that follows the remember-device choice. Reads check both
 * stores so a session (and the PKCE code verifier) survives a redirect.
 */
const authStorage: SupportedStorage = {
  getItem(key) {
    return safeStorage("localStorage")?.getItem(key) ?? safeStorage("sessionStorage")?.getItem(key) ?? null;
  },
  setItem(key, value) {
    const target = rememberDevice() ? "localStorage" : "sessionStorage";
    const other = target === "localStorage" ? "sessionStorage" : "localStorage";
    safeStorage(other)?.removeItem(key);
    safeStorage(target)?.setItem(key, value);
  },
  removeItem(key) {
    safeStorage("localStorage")?.removeItem(key);
    safeStorage("sessionStorage")?.removeItem(key);
  },
};

export const supabase: SupabaseClient<Database> | null = hasSupabaseEnv
  ? createClient<Database>(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        // PKCE: OAuth, magic-link and recovery redirects return a one-time
        // `?code=` that is exchanged for a session, so tokens never appear in the URL.
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
        storage: authStorage,
      },
    })
  : null;

/** Where Supabase sends users back after OAuth or email confirmation. */
export const authCallbackUrl = () => `${window.location.origin}/auth/callback`;
export const passwordResetUrl = () => `${window.location.origin}/reset-password`;
