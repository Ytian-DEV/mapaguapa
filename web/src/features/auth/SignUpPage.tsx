import { useState, type FormEvent } from "react";
import { MailCheck } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { hasSupabaseEnv } from "../../lib/supabase";
import { Button, ButtonLink, Field, Input, RadioCards } from "../../ui";
import { AuthAlert } from "./AuthAlert";
import { AuthDivider, AuthHeading, AuthLayout, GoogleIcon } from "./AuthLayout";
import { friendlyAuthError, MIN_PASSWORD_LENGTH, signInWithGoogle, signUpWithPassword, type AccountType } from "./authApi";
import { PasswordInput } from "./PasswordInput";

type FieldErrors = Partial<Record<"fullName" | "email" | "password", string>>;

export default function SignUpPage() {
  const [params] = useSearchParams();
  const next = params.get("next");
  const [accountType, setAccountType] = useState<AccountType>(params.get("as") === "owner" ? "owner" : "student");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState<"password" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const isOwner = accountType === "owner";

  const validate = () => {
    const errors: FieldErrors = {};
    if (!fullName.trim()) errors.fullName = "Enter your full name.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = "Enter a valid email address.";
    if (password.length < MIN_PASSWORD_LENGTH) errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!validate()) return;
    setBusy("password");
    try {
      const { needsConfirmation } = await signUpWithPassword({ email, password, fullName, accountType });
      if (needsConfirmation) {
        setSentTo(email.trim());
        setBusy(null);
      }
      // Otherwise the new session signs the user in and PublicOnly redirects.
    } catch (signUpError) {
      setError(friendlyAuthError(signUpError as Error));
      setBusy(null);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setBusy("google");
    try {
      await signInWithGoogle(accountType, next);
    } catch (googleError) {
      setError(friendlyAuthError(googleError as Error));
      setBusy(null);
    }
  };

  if (sentTo) {
    return (
      <AuthLayout title="Check your email">
        <div className="auth__done">
          <span className="auth__done-icon">
            <MailCheck aria-hidden="true" />
          </span>
          <AuthHeading
            description={
              <>
                We sent a confirmation link to <strong>{sentTo}</strong>. Open it on this device to finish creating your account.
              </>
            }
            eyebrow="One more step"
            title="Check your email"
          />
          <ButtonLink to="/sign-in" variant="secondary">
            Back to sign in
          </ButtonLink>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      aside={{ prompt: "Already have an account?", label: "Sign in", to: next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in" }}
      title="Create an account"
    >
      <AuthHeading
        description={
          isOwner
            ? "List your boarding house, answer students, and schedule visits. Listings go live after a quick review."
            : "Save places, compare rent and rules, and message owners directly."
        }
        eyebrow={isOwner ? "For owners" : "For VSU students"}
        title="Create your account"
      />

      <form className="auth__form" noValidate onSubmit={handleSubmit}>
        {error && <AuthAlert tone="error">{error}</AuthAlert>}

        <RadioCards
          label="Account type"
          name="account-type"
          onChange={setAccountType}
          options={[
            { value: "student", label: "I’m a student", description: "Find a place near VSU" },
            { value: "owner", label: "I own a place", description: "List and manage rooms" },
          ]}
          value={accountType}
        />

        <Button block disabled={busy !== null} leadingIcon={<GoogleIcon />} loading={busy === "google"} onClick={handleGoogle} size="lg" variant="secondary">
          Sign up with Google
        </Button>

        <AuthDivider />

        <Field error={fieldErrors.fullName} label="Full name">
          <Input autoComplete="name" inputSize="lg" onChange={(event) => setFullName(event.target.value)} placeholder="Juan Dela Cruz" value={fullName} />
        </Field>

        <Field error={fieldErrors.email} hint={isOwner ? undefined : "Your VSU email works best."} label={isOwner ? "Email" : "VSU or personal email"}>
          <Input
            autoComplete="email"
            inputMode="email"
            inputSize="lg"
            onChange={(event) => setEmail(event.target.value)}
            placeholder={isOwner ? "you@example.com" : "you@vsu.edu.ph"}
            type="email"
            value={email}
          />
        </Field>

        <Field error={fieldErrors.password} hint={`At least ${MIN_PASSWORD_LENGTH} characters.`} label="Password">
          <PasswordInput autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} placeholder="Create a password" value={password} />
        </Field>

        <Button block disabled={busy !== null || !hasSupabaseEnv} loading={busy === "password"} size="lg" type="submit">
          {isOwner ? "Create owner account" : "Create account"}
        </Button>

        <p className="auth__switch">
          Already have an account?
          <Link to={next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in"}>Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
