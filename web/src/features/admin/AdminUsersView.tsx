import { useEffect, useState } from "react";
import { Ban, Download, GitMerge, RotateCcw, Search, Shield, User } from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  DataTable,
  EmptyState,
  FilterSelect,
  Input,
  Menu,
  PageHeader,
  Pagination,
  RoleBadge,
  Tabs,
  type Column,
  type MenuItem,
} from "../../ui";
import type { AdminOverview } from "./adminApi";
import { joinedLabel, lastActiveLabel, roleOf, USERS_PAGE_SIZE, type AdminUser, type UserFilters, type UserSort, type UserTab } from "./usersApi";
import "./admin.css";

const TAB_LABELS: Record<UserTab, string> = {
  all: "All",
  student: "Students",
  owner: "Owners",
  admin: "Admins",
  deactivated: "Deactivated",
};
const TAB_ORDER: UserTab[] = ["all", "student", "owner", "admin", "deactivated"];
const SORT_LABELS: Record<UserSort, string> = { newest: "Newest", oldest: "Oldest", name: "Name", last_active: "Last active" };

/** One status per row, most important first (A4). */
export function UserStatus({ user }: { user: AdminUser }) {
  if (user.merged_into)
    return (
      <Badge dot tone="gray">
        Merged
      </Badge>
    );
  if (!user.is_active)
    return (
      <Badge dot tone="red">
        Deactivated
      </Badge>
    );
  if (user.possible_duplicate)
    return (
      <Badge dot tone="amber">
        Possible duplicate
      </Badge>
    );
  if (user.role === "owner")
    return user.is_verified_owner ? (
      <Badge dot tone="green">
        Verified
      </Badge>
    ) : (
      <Badge dot tone="amber">
        Unverified
      </Badge>
    );
  return (
    <Badge dot tone="green">
      Active
    </Badge>
  );
}

export type AdminUsersViewProps = {
  filters: UserFilters;
  onChange: (patch: Partial<UserFilters>) => void;
  rows: AdminUser[];
  total: number;
  counts: AdminOverview["users"] | null;
  status: "loading" | "ready" | "error";
  currentUserId: string | null;
  onRetry: () => void;
  onExport: () => void;
  onView: (user: AdminUser) => void;
  onMerge: (user: AdminUser) => void;
  onChangeRole: (user: AdminUser) => void;
  onToggleActive: (user: AdminUser) => void;
};

/** Admin Users (frame A4). Presentational; the page owns data and actions. */
export function AdminUsersView(props: AdminUsersViewProps) {
  const { filters, onChange, rows, total, counts, status, currentUserId } = props;
  const [search, setSearch] = useState(filters.q);
  useEffect(() => setSearch(filters.q), [filters.q]);
  useEffect(() => {
    if (search === filters.q) return undefined;
    const timer = window.setTimeout(() => onChange({ q: search, page: 0 }), 300);
    return () => window.clearTimeout(timer);
  }, [search, filters.q, onChange]);

  const tabCount: Record<UserTab, number | undefined> = {
    all: counts?.total,
    student: counts?.students,
    owner: counts?.owners,
    admin: counts?.admins,
    deactivated: counts?.deactivated,
  };

  const rowMenu = (user: AdminUser): MenuItem[] => {
    const self = user.id === currentUserId;
    const items: MenuItem[] = [{ key: "view", label: "View profile", icon: <User />, onSelect: () => props.onView(user) }];
    if (!user.merged_into) {
      items.push({ key: "merge", label: "Merge with duplicate…", icon: <GitMerge />, onSelect: () => props.onMerge(user) });
      items.push({ key: "role", label: "Change role…", icon: <Shield />, disabled: self, onSelect: () => props.onChangeRole(user) });
      items.push(
        user.is_active
          ? { key: "deactivate", label: "Deactivate account", icon: <Ban />, destructive: true, disabled: self, onSelect: () => props.onToggleActive(user) }
          : { key: "reactivate", label: "Reactivate account", icon: <RotateCcw />, onSelect: () => props.onToggleActive(user) }
      );
    }
    return items;
  };

  const columns: Column<AdminUser>[] = [
    {
      key: "name",
      header: "Name",
      primary: true,
      cell: (user) => (
        <span className="admin-cell-user">
          <Avatar name={user.full_name ?? user.email} size="sm" src={user.avatar_url} tone={user.role === "owner" ? "clay" : "sage"} />
          <span className="admin-cell-listing__text">
            <strong>
              {user.full_name || "No name"}
              {user.id === currentUserId && <span className="admin-cell-user__you"> (you)</span>}
            </strong>
            <span>{user.email ?? "No email"}</span>
          </span>
        </span>
      ),
    },
    { key: "role", header: "Role", cell: (user) => <RoleBadge role={roleOf(user)} /> },
    { key: "status", header: "Status", cell: (user) => <UserStatus user={user} /> },
    { key: "joined", header: "Joined", hideOnMobile: true, cell: (user) => <span className="admin-nowrap">{joinedLabel(user.created_at)}</span> },
    { key: "active", header: "Last active", hideOnMobile: true, cell: (user) => <span className="admin-nowrap">{lastActiveLabel(user.last_active_at)}</span> },
  ];

  const subtitle = counts
    ? `${counts.total} accounts · ${counts.admins} ${counts.admins === 1 ? "admin" : "admins"} · every role change is logged.`
    : "Every role change is logged.";

  return (
    <div className="admin-listings">
      <PageHeader
        actions={
          <Button leadingIcon={<Download />} onClick={props.onExport} variant="secondary">
            Export
          </Button>
        }
        eyebrow="People"
        subtitle={subtitle}
        title="Users"
      />

      <Tabs
        idPrefix="admin-users"
        items={TAB_ORDER.map((value) => ({ value, label: TAB_LABELS[value], count: tabCount[value] }))}
        label="User role"
        onChange={(tab) => onChange({ tab, page: 0 })}
        value={filters.tab}
      />

      <div className="admin-toolbar">
        <Input
          aria-label="Search users"
          className="admin-toolbar__search"
          leadingIcon={<Search />}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or email"
          type="search"
          value={search}
        />
        <FilterSelect
          anyLabel="Newest"
          label="Sort"
          layout="inline"
          onChange={(event) => onChange({ sort: (event.target.value || "newest") as UserSort, page: 0 })}
          options={(Object.keys(SORT_LABELS) as UserSort[]).filter((value) => value !== "newest").map((value) => ({ value, label: SORT_LABELS[value] }))}
          value={filters.sort === "newest" ? "" : filters.sort}
        />
      </div>

      {status === "error" ? (
        <EmptyState
          action={
            <Button onClick={props.onRetry} variant="secondary">
              Try again
            </Button>
          }
          title="Couldn’t load users"
          tone="error"
        />
      ) : (
        <DataTable
          caption={`${TAB_LABELS[filters.tab]} users`}
          className="admin-users-table"
          columns={columns}
          empty={
            <EmptyState
              compact
              description={filters.q ? "Try a different name or email." : undefined}
              title={filters.q ? "No users match" : `No ${TAB_LABELS[filters.tab].toLowerCase()} users`}
            />
          }
          getRowId={(user) => user.id}
          loading={status === "loading"}
          rowActions={(user) => <Menu items={rowMenu(user)} label={`Actions for ${user.full_name ?? user.email}`} />}
          rows={rows}
        />
      )}

      {status === "ready" && total > 0 && (
        <Pagination itemLabel="users" onPageChange={(page) => onChange({ page })} page={filters.page} pageSize={USERS_PAGE_SIZE} total={total} />
      )}
    </div>
  );
}
