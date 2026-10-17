/**
 * Small in-memory cache for read-only API calls on student pages.
 * - Going Browse → listing → Back shows the previous results instantly
 *   instead of re-querying Supabase.
 * - Identical requests made at the same time share one network call.
 * Entries expire after `ttlMs`; failed calls are never cached. Only use it for
 * data where being a minute stale is fine (published listings, filter options).
 */
type Entry = { at: number; promise: Promise<unknown> };

const entries = new Map<string, Entry>();
const MAX_ENTRIES = 100;

export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = entries.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.promise as Promise<T>;

  const promise = load();
  entries.set(key, { at: Date.now(), promise });
  promise.catch(() => {
    if (entries.get(key)?.promise === promise) entries.delete(key);
  });

  if (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest !== undefined) entries.delete(oldest);
  }
  return promise;
}

/** Drops every entry whose key starts with `prefix` (or everything). */
export function invalidate(prefix = "") {
  for (const key of entries.keys()) if (key.startsWith(prefix)) entries.delete(key);
}

export const MINUTE = 60_000;
