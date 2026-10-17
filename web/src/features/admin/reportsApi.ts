import type { Tables } from "../../lib/database";
import { REPORT_STATUSES, type ReportStatus } from "../../lib/domain";
import { supabase } from "../../lib/supabase";

export type Report = Tables<"reports">;
export type Person = { id: string; full_name: string | null; email: string | null; is_active: boolean };
export type ReportRow = Report & {
  reporter: Person | null;
  reported: Person | null;
  listing: { id: string; name: string; status: string } | null;
};
export type ReportMessage = Pick<Tables<"messages">, "id" | "sender_id" | "body" | "kind" | "created_at">;

export type ReportFilters = { status: ReportStatus; page: number };
export const REPORTS_PAGE_SIZE = 20;

export function reportFiltersFromParams(params: URLSearchParams): ReportFilters {
  const status = params.get("status");
  return {
    status: status && (REPORT_STATUSES as readonly string[]).includes(status) ? (status as ReportStatus) : "open",
    page: Math.max(0, Number.parseInt(params.get("page") ?? "1", 10) - 1 || 0),
  };
}

export function reportFiltersToParams(filters: ReportFilters) {
  const params = new URLSearchParams();
  if (filters.status !== "open") params.set("status", filters.status);
  if (filters.page > 0) params.set("page", String(filters.page + 1));
  return params;
}

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

/** Adds reporter, reported user and listing names (admins can read all three). */
async function hydrate(reports: Report[]): Promise<ReportRow[]> {
  const people = Array.from(new Set(reports.flatMap((r) => [r.reporter_id, r.reported_user_id]).filter((id): id is string => Boolean(id))));
  const listings = Array.from(new Set(reports.map((r) => r.listing_id).filter((id): id is string => Boolean(id))));
  const [profiles, places] = await Promise.all([
    people.length ? client().from("profiles").select("id, full_name, email, is_active").in("id", people) : Promise.resolve({ data: [], error: null }),
    listings.length ? client().from("listings").select("id, name, status").in("id", listings) : Promise.resolve({ data: [], error: null }),
  ]);
  if (profiles.error) throw profiles.error;
  if (places.error) throw places.error;
  const personById = new Map((profiles.data ?? []).map((p) => [p.id, p as Person]));
  const listingById = new Map((places.data ?? []).map((l) => [l.id, l]));
  return reports.map((r) => ({
    ...r,
    reporter: personById.get(r.reporter_id) ?? null,
    reported: r.reported_user_id ? (personById.get(r.reported_user_id) ?? null) : null,
    listing: r.listing_id ? (listingById.get(r.listing_id) ?? null) : null,
  }));
}

export async function fetchReports(filters: ReportFilters): Promise<{ rows: ReportRow[]; total: number }> {
  const from = filters.page * REPORTS_PAGE_SIZE;
  const { data, error, count } = await client()
    .from("reports")
    .select("*", { count: "exact" })
    .eq("status", filters.status)
    .order(filters.status === "open" ? "created_at" : "resolved_at", { ascending: false })
    .range(from, from + REPORTS_PAGE_SIZE - 1);
  if (error) throw error;
  return { rows: await hydrate(data ?? []), total: count ?? 0 };
}

export async function fetchReportCounts(): Promise<Record<ReportStatus, number>> {
  const results = await Promise.all(
    REPORT_STATUSES.map((status) => client().from("reports").select("id", { count: "exact", head: true }).eq("status", status))
  );
  return Object.fromEntries(REPORT_STATUSES.map((status, i) => [status, results[i].count ?? 0])) as Record<ReportStatus, number>;
}

export async function fetchReport(id: string): Promise<ReportRow | null> {
  const { data, error } = await client().from("reports").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return (await hydrate([data]))[0];
}

/** Messages around the reported one (admins can read reported conversations). */
export async function fetchReportContext(report: Report): Promise<ReportMessage[]> {
  if (!report.conversation_id) return [];
  const { data, error } = await client()
    .from("messages")
    .select("id, sender_id, body, kind, created_at")
    .eq("conversation_id", report.conversation_id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []).reverse();
}

/** Other reports about the same listing or person. */
export async function fetchRelatedCount(report: Report): Promise<number> {
  const target = report.listing_id && report.target_type === "listing" ? ["listing_id", report.listing_id] : report.reported_user_id ? ["reported_user_id", report.reported_user_id] : null;
  if (!target) return 0;
  const { count, error } = await client().from("reports").select("id", { count: "exact", head: true }).eq(target[0], target[1]).neq("id", report.id);
  if (error) throw error;
  return count ?? 0;
}

export async function setReportStatus(id: string, status: ReportStatus, note: string) {
  const { error } = await client()
    .from("reports")
    .update({ status, resolution_note: status === "open" ? null : note.trim() || null })
    .eq("id", id);
  if (error) throw error;
}
