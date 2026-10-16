import { useEffect, useState } from "react";
import { ROLES, type Role } from "../../lib/domain";
import { Avatar, ConfirmDialog, Dialog, RadioCards, RoleBadge } from "../../ui";
import { UserStatus } from "./AdminUsersView";
import { joinedLabel, lastActiveLabel, roleOf, type AdminUser } from "./usersApi";

/** Resolves to an error message, or null on success. */
type Action<T extends unknown[]> = (...args: T) => Promise<string | null>;

const ROLE_HELP: Record<Role, string> = {
  student: "Browses, saves and messages owners.",
  owner: "Lists places and answers inquiries. Listings still go through review.",
  admin: "Full access to this console, including other people’s roles.",
};

function ErrorLine({ message }: { message: string | null }) {
  return message ? (
    <p className="ui-field__error" role="alert">
      {message}
    </p>
  ) : null;
}

function UserSummary({ user }: { user: AdminUser }) {
  return (
    <div className="user-summary">
      <Avatar name={user.full_name ?? user.email} src={user.avatar_url} />
      <div>
        <p>{user.full_name || "No name"}</p>
        <span>{user.email ?? "No email"}</span>
      </div>
    </div>
  );
}

export function ProfileDialog({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  return (
    <Dialog onClose={onClose} open={user !== null} title="Profile">
      {user && (
        <div className="user-dialog">
          <UserSummary user={user} />
          <dl className="user-facts">
            <div>
              <dt>Role</dt>
              <dd>
                <RoleBadge role={roleOf(user)} />
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <UserStatus user={user} />
              </dd>
            </div>
            <div>
              <dt>Joined</dt>
              <dd>{joinedLabel(user.created_at)}</dd>
            </div>
            <div>
              <dt>Last active</dt>
              <dd>{lastActiveLabel(user.last_active_at)}</dd>
            </div>
            {user.role === "owner" && (
              <div>
                <dt>Ownership</dt>
                <dd>{user.is_verified_owner ? "Verified" : "Not verified yet"}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </Dialog>
  );
}

export function RoleDialog({ user, onCancel, onConfirm }: { user: AdminUser | null; onCancel: () => void; onConfirm: Action<[Role]> }) {
  const [role, setRole] = useState<Role>("student");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setRole(roleOf(user));
      setError(null);
    }
  }, [user]);

  const confirm = async () => {
    setBusy(true);
    const message = await onConfirm(role);
    setBusy(false);
    setError(message);
  };

  return (
    <ConfirmDialog
      busy={busy}
      confirmDisabled={!user || role === roleOf(user)}
      confirmLabel="Change role"
      description="The change is logged and takes effect the next time they load a page."
      onCancel={onCancel}
      onConfirm={() => void confirm()}
      open={user !== null}
      title={`Change ${user?.full_name ?? "this user"}’s role?`}
    >
      <RadioCards
        label="Role"
        name="admin-user-role"
        onChange={setRole}
        options={ROLES.map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1), description: ROLE_HELP[value] }))}
        value={role}
      />
      <ErrorLine message={error} />
    </ConfirmDialog>
  );
}

export function ActiveDialog({ user, onCancel, onConfirm }: { user: AdminUser | null; onCancel: () => void; onConfirm: Action<[]> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setError(null), [user]);
  const deactivating = Boolean(user?.is_active);

  const confirm = async () => {
    setBusy(true);
    const message = await onConfirm();
    setBusy(false);
    setError(message);
  };

  return (
    <ConfirmDialog
      busy={busy}
      confirmLabel={deactivating ? "Deactivate" : "Reactivate"}
      description={
        deactivating
          ? "They’re signed out the next time they open the app and can’t sign back in. Their listings and messages stay. You can reactivate them later."
          : "They can sign in again with their usual method."
      }
      destructive={deactivating}
      onCancel={onCancel}
      onConfirm={() => void confirm()}
      open={user !== null}
      title={`${deactivating ? "Deactivate" : "Reactivate"} ${user?.full_name ?? "this account"}?`}
    >
      <ErrorLine message={error} />
    </ConfirmDialog>
  );
}

type MergeDialogProps = {
  user: AdminUser | null;
  candidates: AdminUser[] | null;
  onCancel: () => void;
  onConfirm: Action<[keepId: string, duplicateId: string]>;
};

/** Pick the other account, then which one to keep. The other is deactivated after its data moves over. */
export function MergeDialog({ user, candidates, onCancel, onConfirm }: MergeDialogProps) {
  const [otherId, setOtherId] = useState<string | null>(null);
  const [keep, setKeep] = useState<"this" | "other">("this");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOtherId(candidates?.[0]?.id ?? null);
    setKeep("this");
    setError(null);
  }, [user, candidates]);

  const other = candidates?.find((item) => item.id === otherId) ?? null;
  const confirm = async () => {
    if (!user || !other) return;
    setBusy(true);
    const message = keep === "this" ? await onConfirm(user.id, other.id) : await onConfirm(other.id, user.id);
    setBusy(false);
    setError(message);
  };

  const label = (item: AdminUser) => `${item.full_name || "No name"} · ${item.email ?? "no email"}`;

  return (
    <ConfirmDialog
      busy={busy}
      confirmDisabled={!other}
      confirmLabel="Merge accounts"
      description="Saved places, conversations and listings move to the account you keep. The other account is deactivated. This can’t be undone from here."
      destructive
      onCancel={onCancel}
      onConfirm={() => void confirm()}
      open={user !== null}
      title="Merge duplicate accounts?"
    >
      {candidates === null ? (
        <p className="user-dialog__muted">Looking for accounts with the same name…</p>
      ) : candidates.length === 0 ? (
        <p className="user-dialog__muted">No other account has the name “{user?.full_name}”. Search the users table to find the duplicate, then merge from either row.</p>
      ) : (
        <div className="user-dialog">
          {candidates.length > 1 && (
            <RadioCards
              label="Duplicate account"
              name="merge-other"
              onChange={setOtherId}
              options={candidates.map((item) => ({ value: item.id, label: label(item) }))}
              value={otherId}
            />
          )}
          {user && other && (
            <RadioCards
              label="Keep which account?"
              name="merge-keep"
              onChange={setKeep}
              options={[
                { value: "this", label: label(user), description: `Joined ${joinedLabel(user.created_at)} · last active: ${lastActiveLabel(user.last_active_at)}` },
                { value: "other", label: label(other), description: `Joined ${joinedLabel(other.created_at)} · last active: ${lastActiveLabel(other.last_active_at)}` },
              ]}
              value={keep}
            />
          )}
        </div>
      )}
      <ErrorLine message={error} />
    </ConfirmDialog>
  );
}
