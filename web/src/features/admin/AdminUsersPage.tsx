import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import type { Role } from "../../lib/domain";
import { useToast } from "../../ui";
import { useAdminData } from "./AdminDataContext";
import { AdminUsersView } from "./AdminUsersView";
import { ActiveDialog, MergeDialog, ProfileDialog, RoleDialog } from "./UserDialogs";
import {
  exportUsers,
  fetchUsers,
  findDuplicateCandidates,
  mergeUsers,
  setUserActive,
  setUserRole,
  userFiltersFromParams,
  userFiltersToParams,
  type AdminUser,
  type UserFilters,
} from "./usersApi";
import { reportError } from "../../lib/errors";

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

/** /admin/users (frame A4). Replaces the v1 users console. */
export default function AdminUsersPage() {
  const [params, setParams] = useSearchParams();
  const { profile } = useAuth();
  const { overview, refresh: refreshCounts } = useAdminData();
  const toast = useToast();
  const filters = useMemo(() => userFiltersFromParams(params), [params]);
  const key = userFiltersToParams(filters).toString();

  const [rows, setRows] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reload, setReload] = useState(0);
  const request = useRef(0);

  const [viewing, setViewing] = useState<AdminUser | null>(null);
  const [roleTarget, setRoleTarget] = useState<AdminUser | null>(null);
  const [activeTarget, setActiveTarget] = useState<AdminUser | null>(null);
  const [mergeTarget, setMergeTarget] = useState<AdminUser | null>(null);
  const [candidates, setCandidates] = useState<AdminUser[] | null>(null);

  useEffect(() => {
    document.title = "Users · Admin · mapaguapa";
  }, []);

  useEffect(() => {
    const id = ++request.current;
    setStatus("loading");
    fetchUsers(userFiltersFromParams(new URLSearchParams(key)))
      .then((page) => {
        if (id !== request.current) return;
        setRows(page.rows);
        setTotal(page.total);
        setStatus("ready");
      })
      .catch((error) => {
        reportError(error);
        if (id === request.current) setStatus("error");
      });
  }, [key, reload]);

  const onChange = useCallback(
    (patch: Partial<UserFilters>) => {
      setParams((current) => userFiltersToParams({ ...userFiltersFromParams(current), ...patch }), { replace: "q" in patch });
    },
    [setParams]
  );

  const afterChange = () => {
    setReload((value) => value + 1);
    void refreshCounts();
  };

  const openMerge = (user: AdminUser) => {
    setMergeTarget(user);
    setCandidates(null);
    findDuplicateCandidates(user).then(setCandidates, () => setCandidates([]));
  };

  const changeRole = async (role: Role) => {
    if (!roleTarget) return null;
    try {
      await setUserRole(roleTarget.id, role);
    } catch (error) {
      return errorText(error);
    }
    toast.success(`${roleTarget.full_name ?? "User"} is now ${role === "admin" ? "an admin" : `a ${role}`}.`);
    setRoleTarget(null);
    afterChange();
    return null;
  };

  const toggleActive = async () => {
    if (!activeTarget) return null;
    const next = !activeTarget.is_active;
    try {
      await setUserActive(activeTarget.id, next);
    } catch (error) {
      return errorText(error);
    }
    toast.success(`${activeTarget.full_name ?? "Account"} ${next ? "reactivated" : "deactivated"}.`);
    setActiveTarget(null);
    afterChange();
    return null;
  };

  const merge = async (keepId: string, duplicateId: string) => {
    try {
      await mergeUsers(keepId, duplicateId);
    } catch (error) {
      return errorText(error);
    }
    toast.success("Accounts merged. The duplicate is deactivated.");
    setMergeTarget(null);
    afterChange();
    return null;
  };

  const onExport = async () => {
    try {
      const count = await exportUsers(filters);
      toast.success(`Exported ${count} ${count === 1 ? "user" : "users"}.`);
    } catch (error) {
      toast.error(`Export failed: ${errorText(error)}`);
    }
  };

  return (
    <>
      <AdminUsersView
        counts={overview?.users ?? null}
        currentUserId={profile?.id ?? null}
        filters={filters}
        onChange={onChange}
        onChangeRole={setRoleTarget}
        onExport={() => void onExport()}
        onMerge={openMerge}
        onRetry={() => setReload((value) => value + 1)}
        onToggleActive={setActiveTarget}
        onView={setViewing}
        rows={rows}
        status={status}
        total={total}
      />
      <ProfileDialog onClose={() => setViewing(null)} user={viewing} />
      <RoleDialog onCancel={() => setRoleTarget(null)} onConfirm={changeRole} user={roleTarget} />
      <ActiveDialog onCancel={() => setActiveTarget(null)} onConfirm={toggleActive} user={activeTarget} />
      <MergeDialog candidates={candidates} onCancel={() => setMergeTarget(null)} onConfirm={merge} user={mergeTarget} />
    </>
  );
}
