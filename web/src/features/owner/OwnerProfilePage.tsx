import { useEffect, useState, type FormEvent } from "react";
import { BadgeCheck } from "lucide-react";
import { useAuth } from "../../app/AuthProvider";
import { Avatar, Badge, Button, Card, CardHeader, Field, Input, PageHeader, useToast } from "../../ui";
import { friendlyAuthError, MIN_PASSWORD_LENGTH, updatePassword } from "../auth/authApi";
import { PasswordInput } from "../auth/PasswordInput";
import { updateMyProfile } from "./ownerApi";
import "./owner.css";

export default function OwnerProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    document.title = "Profile · Owner portal · mapaguapa";
  }, []);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
  }, [profile?.full_name, profile?.phone]);

  if (!profile) return null;

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await updateMyProfile(profile.id, { fullName, phone });
      await refreshProfile();
      toast.success("Profile saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t save your profile.");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setPasswordError("The two passwords don’t match.");
      return;
    }
    setChanging(true);
    try {
      await updatePassword(password);
      setPassword("");
      setConfirm("");
      toast.success("Password updated.");
    } catch (error) {
      setPasswordError(friendlyAuthError(error as Error));
    } finally {
      setChanging(false);
    }
  };

  return (
    <div className="owner-form-page">
      <PageHeader eyebrow="Account" subtitle="Students see your name on your listings and in messages." title="Profile" />

      <Card>
        <div className="profile-head">
          <Avatar name={profile.full_name || profile.email} size="lg" src={profile.avatar_url} tone="clay" />
          <div>
            <p style={{ color: "var(--color-ink)", fontWeight: 600 }}>{profile.full_name || "Owner"}</p>
            <p>{profile.email}</p>
            {profile.verified_owner_at && (
              <Badge icon={<BadgeCheck />} tone="green">
                Verified owner
              </Badge>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Details" />
        <form className="owner-form" onSubmit={saveProfile}>
          <div className="owner-form__row">
            <Field label="Full name">
              <Input autoComplete="name" onChange={(event) => setFullName(event.target.value)} value={fullName} />
            </Field>
            <Field hint="Used for account recovery; listings use the number on each listing." label="Mobile number" optional>
              <Input autoComplete="tel" inputMode="tel" onChange={(event) => setPhone(event.target.value)} placeholder="09XX XXX XXXX" value={phone} />
            </Field>
          </div>
          <Field hint="Email is managed by your sign-in. Contact an admin to change it." label="Email">
            <Input disabled value={profile.email ?? ""} />
          </Field>
          <div className="owner-form__actions">
            <Button loading={saving} type="submit">
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader description="Signed in with Google? You can still set a password for email sign-in." title="Password" />
        <form className="owner-form" noValidate onSubmit={changePassword}>
          <div className="owner-form__row">
            <Field error={passwordError ?? undefined} label="New password">
              <PasswordInput autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} value={password} />
            </Field>
            <Field label="Confirm new password">
              <PasswordInput autoComplete="new-password" onChange={(event) => setConfirm(event.target.value)} value={confirm} />
            </Field>
          </div>
          <div className="owner-form__actions">
            <Button loading={changing} type="submit" variant="secondary">
              Update password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
