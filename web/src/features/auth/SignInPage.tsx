import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import { hasSupabaseEnv } from "../../lib/supabase";
import { Button, Checkbox, Field, Input } from "../../ui";
import { AuthAlert } from "./AuthAlert";
import { AuthDivider, AuthHeading, AuthLayout, GoogleIcon } from "./AuthLayout";
import { friendlyAuthError, signInWithGoogle, signInWithPassword } from "./authApi";
import { PasswordInput } from "./PasswordInput";

export default function SignInPage() {
  const { notice, clearNotice } = useAuth();
  const [params] = useSearchParams();
  const next = params.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState<"password" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    clearNotice();
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy("password");
    try {
      await signInWithPassword(email, password, remember);
      // AuthProvider picks up the session; PublicOnly redirects to `next` or the role home.
    } catch (signInError) {
      setError(friendlyAuthError(signInError as Error));
      setBusy(null);
    }
  };

  const handleGoogle = async () => {
    clearNotice();
    setError(null);
    setBusy("google");
    try {
      await signInWithGoogle(null, next);
    } catch (googleError) {
      setError(friendlyAuthError(googleError as Error));
      setBusy(null);
    }
  };

  return (
    <AuthLayout aside={{ prompt: "Own a boarding house?", label: "List your place", to: "/sign-up?as=owner" }} title="Sign in">
      <AuthHeading
        description="Sign in to see your saved places and contact owners directly."
        eyebrow="For VSU students"
        title="Welcome back"
      />

      <form className="auth__form" noValidate onSubmit={handleSubmit}>
        {!hasSupabaseEnv && <AuthAlert tone="error">Sign-in isn’t configured yet. Add the Supabase URL and anon key to web/.env.</AuthAlert>}
        {notice && <AuthAlert tone="info">{notice}</AuthAlert>}
        {error && <AuthAlert tone="error">{error}</AuthAlert>}

        <Button block disabled={busy !== null} leadingIcon={<GoogleIcon />} loading={busy === "google"} onClick={handleGoogle} size="lg" variant="secondary">
          Continue with Google
        </Button>

        <AuthDivider />

        <Field label="VSU or personal email">
          <Input
            autoComplete="email"
            inputMode="email"
            inputSize="lg"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@vsu.edu.ph"
            required
            type="email"
            value={email}
          />
        </Field>

        <div className="ui-field">
          <div className="auth__label-row">
            <label className="ui-field__label" htmlFor="sign-in-password">
              Password
            </label>
            <Link to="/forgot-password">Forgot password?</Link>
          </div>
          <PasswordInput
            autoComplete="current-password"
            id="sign-in-password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            required
            value={password}
          />
        </div>

        <Checkbox checked={remember} label="Keep me signed in on this device" onChange={(event) => setRemember(event.target.checked)} />

        <Button block disabled={busy !== null || !hasSupabaseEnv} loading={busy === "password"} size="lg" type="submit">
          Sign in
        </Button>

        <p className="auth__switch">
          New student?
          <Link to={next ? `/sign-up?next=${encodeURIComponent(next)}` : "/sign-up"}>Create an account</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
