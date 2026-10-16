import { useState, type FormEvent } from "react";
import { MailCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Button, ButtonLink, Field, Input } from "../../ui";
import { AuthAlert } from "./AuthAlert";
import { AuthHeading, AuthLayout } from "./AuthLayout";
import { friendlyAuthError, sendPasswordReset } from "./authApi";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter the email you signed up with.");
      return;
    }
    setBusy(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (resetError) {
      setError(friendlyAuthError(resetError as Error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Reset your password">
      {sent ? (
        <div className="auth__done">
          <span className="auth__done-icon">
            <MailCheck aria-hidden="true" />
          </span>
          <AuthHeading
            description={
              <>
                If an account exists for <strong>{email.trim()}</strong>, a reset link is on its way. Open it on this device.
              </>
            }
            eyebrow="Check your inbox"
            title="Reset link sent"
          />
          <ButtonLink to="/sign-in" variant="secondary">
            Back to sign in
          </ButtonLink>
        </div>
      ) : (
        <>
          <AuthHeading description="We’ll email you a link to choose a new password." eyebrow="Account help" title="Forgot your password?" />
          <form className="auth__form" noValidate onSubmit={handleSubmit}>
            {error && <AuthAlert tone="error">{error}</AuthAlert>}
            <Field label="Email">
              <Input
                autoComplete="email"
                inputMode="email"
                inputSize="lg"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@vsu.edu.ph"
                type="email"
                value={email}
              />
            </Field>
            <Button block loading={busy} size="lg" type="submit">
              Send reset link
            </Button>
            <p className="auth__switch">
              Remembered it?
              <Link to="/sign-in">Back to sign in</Link>
            </p>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
