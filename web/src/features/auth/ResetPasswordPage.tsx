import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import { FullPageLoader } from "../../app/FullPageLoader";
import { homeFor } from "../../app/guards";
import { Button, ButtonLink, Field, useToast } from "../../ui";
import { AuthAlert } from "./AuthAlert";
import { AuthHeading, AuthLayout } from "./AuthLayout";
import { friendlyAuthError, MIN_PASSWORD_LENGTH, updatePassword } from "./authApi";
import { PasswordInput } from "./PasswordInput";

/** Target of the reset email. The PKCE `?code=` is exchanged by the Supabase client on load. */
export default function ResetPasswordPage() {
  const { session, profile, loading } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return <FullPageLoader />;
  }

  if (!session) {
    return (
      <AuthLayout title="Reset link expired">
        <AuthHeading
          description="Reset links work once and expire after a while. Request a new one and open it on this device."
          eyebrow="Account help"
          title="This link has expired"
        />
        <ButtonLink to="/forgot-password">Send a new link</ButtonLink>
      </AuthLayout>
    );
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don’t match.");
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      toast.success("Password updated.");
      navigate(homeFor(profile?.role), { replace: true });
    } catch (updateError) {
      setError(friendlyAuthError(updateError as Error));
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Choose a new password">
      <AuthHeading description="Pick something you haven’t used before." eyebrow="Account help" title="Choose a new password" />
      <form className="auth__form" noValidate onSubmit={handleSubmit}>
        {error && <AuthAlert tone="error">{error}</AuthAlert>}
        <Field hint={`At least ${MIN_PASSWORD_LENGTH} characters.`} label="New password">
          <PasswordInput autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} value={password} />
        </Field>
        <Field label="Confirm new password">
          <PasswordInput autoComplete="new-password" onChange={(event) => setConfirm(event.target.value)} value={confirm} />
        </Field>
        <Button block loading={busy} size="lg" type="submit">
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
