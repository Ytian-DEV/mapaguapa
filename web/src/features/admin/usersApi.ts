import type { Database } from "../../lib/database";
import { downloadCsv, toCsv } from "../../lib/csv";
import type { Role } from "../../lib/domain";
import { supabase } from "../../lib/supabase";

type RpcRow = Database["public"]["Functions"]["admin_users"]["Returns"][number];
export type AdminUser = Omit<RpcRow, "id" | "total_count"> & { id: string };

export const USER_TABS = ["all", "student", "owner", "admin", "deactivated"] as const;
export type UserTab = (typeof USER_TABS)[number];
export const USER_SORTS = ["newest", "oldest", "name", "last_active"] as const;
export type UserSort = (typeof USER_SORTS)[number];

export type UserFilters = { tab: UserTab; q: string; sort: UserSort; page: number };

export const USERS_PAGE_SIZE = 20;

const pick = <T extends string>(values: readonly T[], value: string | null, fallback: T): T =>
  value && (values as readonly string[]).includes(value) ? (value as T) : fallback;

export function userFiltersFromParams(params: URLSearchParams): UserFilters {
  return {
    tab: pick(USER_TABS, params.get("tab"), "all"),
    q: params.get("q") ?? "",
    sort: pick(USER_SORTS, params.get("sort"), "newest"),
    page: Math.max(0, Number.parseInt(params.get("page") ?? "1", 10) - 1 || 0),
  };
}

export function userFiltersToParams(filters: UserFilters) {
  const params = new URLSearchParams();
  if (filters.tab !== "all") params.set("tab", filters.tab);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  if (filters.page > 0) params.set("page", String(filters.page + 1));
  return params;
}

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

/** One page of users from admin_users() plus the total for pagination. */
export async function fetchUsers(filters: UserFilters, pageSize = USERS_PAGE_SIZE): Promise<{ rows: AdminUser[]; total: number }> {
  const { data, error } = await client().rpc("admin_users", {
    p_search: filters.q.trim() || undefined,
    p_tab: filters.tab,
    p_sort: filters.sort,
    p_page: filters.page,
    p_page_size: pageSize,
  });
  if (error) throw error;
  const list = data ?? [];
  return {
    rows: list.filter((row): row is RpcRow & { id: string } => Boolean(row.id)).map(({ total_count: _total, ...row }) => row),
    total: Number(list[0]?.total_count ?? 0),
  };
}

export async function setUserRole(userId: string, role: Role) {
  const { error } = await client().rpc("admin_set_role", { p_user_id: userId, p_role: role });
  if (error) throw error;
}

export async function setUserActive(userId: string, active: boolean) {
  const { error } = await client().rpc("admin_set_active", { p_user_id: userId, p_active: active });
  if (error) throw error;
}

/** Moves saved listings, conversations and listings onto keepId, then deactivates duplicateId. */
export async function mergeUsers(keepId: string, duplicateId: string) {
  const { error } = await client().rpc("admin_merge_users", { p_keep_id: keepId, p_duplicate_id: duplicateId });
  if (error) throw error;
}

/** Candidate accounts for a merge: same name, different account. */
export async function findDuplicateCandidates(user: AdminUser): Promise<AdminUser[]> {
  if (!user.full_name) return [];
  const { rows } = await fetchUsers({ tab: "all", q: user.full_name, sort: "newest", page: 0 }, 20);
  return rows.filter((row) => row.id !== user.id && !row.merged_into);
}

/** Every user matching the tab and search, fetched 100 at a time. */
export async function exportUsers(filters: UserFilters) {
  const all: AdminUser[] = [];
  for (let page = 0; page < 200; page += 1) {
    const { rows, total } = await fetchUsers({ ...filters, page }, 100);
    all.push(...rows);
    if (all.length >= total || rows.length === 0) break;
  }
  const csv = toCsv(
    all.map((row) => ({
      name: row.full_name ?? "",
      email: row.email ?? "",
      role: row.role ?? "",
      active: row.is_active ? "yes" : "no",
      verified: row.is_verified_owner ? "yes" : "no",
      duplicate: row.possible_duplicate ? "yes" : "no",
      joined: row.created_at ?? "",
      lastActive: row.last_active_at ?? "",
    })),
    [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "role", label: "Role" },
      { key: "active", label: "Active" },
      { key: "verified", label: "Verified owner" },
      { key: "duplicate", label: "Possible duplicate" },
      { key: "joined", label: "Joined" },
      { key: "lastActive", label: "Last active" },
    ]
  );
  downloadCsv(`mapaguapa-users-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  return all.length;
}
