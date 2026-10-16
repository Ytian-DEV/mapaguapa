import { useMemo, useState } from "react";
import { useToast } from "../ui";
import { AdminShell } from "../features/admin/AdminShell";
import { AdminUsersView } from "../features/admin/AdminUsersView";
import { ActiveDialog, MergeDialog, ProfileDialog, RoleDialog } from "../features/admin/UserDialogs";
import type { AdminUser, UserFilters } from "../features/admin/usersApi";

// Dev-only fixtures (not bundled in production).
const iso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const user = (id: string, full_name: string, email: string, extra: Partial<AdminUser> = {}): AdminUser => ({
  id,
  full_name,
  email,
  avatar_url: null,
  role: "student",
  is_active: true,
  is_verified_owner: false,
  possible_duplicate: false,
  merged_into: null,
  created_at: iso(14),
  last_active_at: iso(0),
  ...extra,
});

const all: AdminUser[] = [
  user("u1", "Fixture Student", "student@example.test"),
  user("u2", "Fixture Owner", "owner@example.test", { role: "owner", last_active_at: iso(2) }),
  user("u3", "Twin Fixture", "twin.one@example.test", { possible_duplicate: true, last_active_at: iso(25) }),
  user("u4", "Twin Fixture", "twin.two@example.test", { possible_duplicate: true, last_active_at: null }),
  user("u5", "Dev Admin", "admin@example.test", { role: "admin" }),
  user("u6", "Verified Fixture Owner", "verified@example.test", { role: "owner", is_verified_owner: true, created_at: iso(300), last_active_at: iso(5) }),
  user("u7", "Gone Fixture", "gone@example.test", { is_active: false, last_active_at: iso(90) }),
];

export default function AdminUsersPreview() {
  const toast = useToast();
  const [filters, setFilters] = useState<UserFilters>({ tab: "all", q: "", sort: "newest", page: 0 });
  const [viewing, setViewing] = useState<AdminUser | null>(null);
  const [roleTarget, setRoleTarget] = useState<AdminUser | null>(null);
  const [activeTarget, setActiveTarget] = useState<AdminUser | null>(null);
  const [mergeTarget, setMergeTarget] = useState<AdminUser | null>(null);

  const rows = useMemo(
    () =>
      all.filter((item) => {
        const tabOk = filters.tab === "all" || (filters.tab === "deactivated" ? !item.is_active : item.role === filters.tab && item.is_active);
        const q = filters.q.toLowerCase();
        return tabOk && (!q || item.full_name?.toLowerCase().includes(q) || item.email?.toLowerCase().includes(q));
      }),
    [filters]
  );
  const candidates = mergeTarget ? all.filter((item) => item.id !== mergeTarget.id && item.full_name === mergeTarget.full_name) : null;

  return (
    <AdminShell overview={null}>
      <AdminUsersView
        counts={{ total: 7, students: 4, owners: 2, admins: 1, deactivated: 1, possible_duplicates: 2 }}
        currentUserId="u5"
        filters={filters}
        onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
        onChangeRole={setRoleTarget}
        onExport={() => toast.show("Would export users")}
        onMerge={setMergeTarget}
        onRetry={() => undefined}
        onToggleActive={setActiveTarget}
        onView={setViewing}
        rows={rows}
        status="ready"
        total={rows.length}
      />
      <ProfileDialog onClose={() => setViewing(null)} user={viewing} />
      <RoleDialog
        onCancel={() => setRoleTarget(null)}
        onConfirm={async (role) => (setRoleTarget(null), toast.success(`Would set role ${role}`), null)}
        user={roleTarget}
      />
      <ActiveDialog onCancel={() => setActiveTarget(null)} onConfirm={async () => (setActiveTarget(null), null)} user={activeTarget} />
      <MergeDialog
        candidates={candidates}
        onCancel={() => setMergeTarget(null)}
        onConfirm={async (keep, dup) => (setMergeTarget(null), toast.success(`Would keep ${keep}, merge ${dup}`), null)}
        user={mergeTarget}
      />
    </AdminShell>
  );
}
