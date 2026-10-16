import { useEffect, useState } from "react";
import { ConfirmDialog, Field, Input } from "../../ui";
import { PasswordInput } from "../auth/PasswordInput";

type ArchiveDialogProps = {
  open: boolean;
  count: number;
  name?: string;
  hasPassword: boolean;
  onCancel: () => void;
  /** Resolves to an error message, or null on success. */
  onConfirm: (password: string, reason: string) => Promise<string | null>;
};

/** Archiving removes listings from the student catalog, so the admin re-enters their password. */
export function ArchiveDialog({ open, count, name, hasPassword, onCancel, onConfirm }: ArchiveDialogProps) {
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword("");
      setReason("");
      setError(null);
    }
  }, [open]);

  const confirm = async () => {
    if (hasPassword && !password) {
      setError("Enter your password to continue.");
      return;
    }
    setBusy(true);
    const message = await onConfirm(password, reason);
    setBusy(false);
    if (message) setError(message);
  };

  const target = count === 1 && name ? `“${name}”` : `${count} ${count === 1 ? "listing" : "listings"}`;

  return (
    <ConfirmDialog
      busy={busy}
      confirmDisabled={!hasPassword}
      confirmLabel={count === 1 ? "Archive listing" : `Archive ${count} listings`}
      description={`${target} will disappear from the student catalog. A snapshot is kept and you can restore it from the Archived tab.`}
      destructive
      onCancel={onCancel}
      onConfirm={() => void confirm()}
      open={open}
      title={`Archive ${target}?`}
    >
      <div style={{ display: "grid", gap: 14 }}>
        <Field label="Reason" optional>
          <Input onChange={(event) => setReason(event.target.value)} placeholder="e.g. Closed, duplicate, owner request" value={reason} />
        </Field>
        {hasPassword ? (
          <Field error={error ?? undefined} label="Your password">
            <PasswordInput autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} value={password} />
          </Field>
        ) : (
          <p className="ui-field__error" role="alert">
            Your account signs in with Google only. Set a password from your profile first — archiving requires re-entering it.
          </p>
        )}
      </div>
    </ConfirmDialog>
  );
}
