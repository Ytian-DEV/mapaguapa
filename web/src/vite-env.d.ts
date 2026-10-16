/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_LISTING_PHOTOS_BUCKET?: string;
  /** MapTiler key for basemap tiles (restrict it to your domains). */
  readonly VITE_MAPTILER_KEY?: string;
  /** MapTiler map id, default "streets-v2-light". */
  readonly VITE_MAPTILER_STYLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
