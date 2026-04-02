import { useMemo, useState } from "react";
import HouseMark from "../shared/HouseMark";
import { usePointerGlow } from "../shared/usePointerGlow";
import "./mapaguapa-auth.css";

type Mode = "login" | "signup";

type Credentials = {
  email: string;
  password: string;
  fullName?: string;
};

type MapaguapaAuthPageProps = {
  authConfigured: boolean;
  authError: string | null;
  authInfo: string | null;
  isSubmitting: boolean;
  onLogin: (credentials: Credentials) => Promise<void>;
  onSignup: (credentials: Credentials) => Promise<void>;
};

type HeroHighlight = {
  title: string;
  text: string;
};

const heroHighlights: HeroHighlight[] = [
  {
    title: "Near Campus",
    text: "Browse listings close to VSU and nearby student-friendly areas.",
  },
  {
    title: "Verified Details",
    text: "View cleaner listing info, amenities, and useful stay highlights.",
  },
  {
    title: "24/7 & Fast Search",
    text: "Access across smart devices and a fast search experience for students.",
  },
];

const modeCopy = {
  login: {
    titleLines: ["Welcome back to", "MAPAGUAPA"],
    description:
      "Sign in to explore available boarding houses and manage your saved places.",
    submitLabel: "Log in",
    swapLead: "No account yet?",
    swapAction: "Create one",
  },
  signup: {
    titleLines: ["Create your MAPAGUAPA", "account"],
    description:
      "Start your search for student-friendly spaces with a personalized account.",
    submitLabel: "Create account",
    swapLead: "Already have an account?",
    swapAction: "Log in here",
  },
} as const;

export default function MapaguapaAuthPage({
  authConfigured,
  authError,
  authInfo,
  isSubmitting,
  onLogin,
  onSignup,
}: MapaguapaAuthPageProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const {
    pageRef,
    handlePointerEnter,
    handlePointerLeave,
    handlePointerMove,
  } = usePointerGlow();

  const copy = modeCopy[mode];
  const isSignup = mode === "signup";
  const activeError = localError || authError;

  const helperText = useMemo(() => {
    if (!authConfigured) {
      return "Supabase is not configured yet. Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in web/.env.";
    }

    return authInfo;
  }, [authConfigured, authInfo]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);

    if (!authConfigured) {
      setLocalError("Supabase environment variables are missing.");
      return;
    }

    if (!email.trim() || !password.trim()) {
      setLocalError("Email and password are required.");
      return;
    }

    if (isSignup) {
      if (!fullName.trim()) {
        setLocalError("Full name is required for sign up.");
        return;
      }

      if (password !== confirmPassword) {
        setLocalError("Passwords do not match.");
        return;
      }

      await onSignup({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
      });
      return;
    }

    await onLogin({
      email: email.trim(),
      password,
    });
  };

  return (
    <main
      className="mapa-auth-page"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      ref={pageRef}
    >
      <div className="mapa-auth-page__orb mapa-auth-page__orb--left" />
      <div className="mapa-auth-page__orb mapa-auth-page__orb--right" />
      <div className="mapa-auth-page__orb mapa-auth-page__orb--bottom" />
      <div className="mapa-auth-page__arc" />
      <div className="mapa-auth-page__grid" />
      <div className="mapa-auth-page__mouse-glow" />
      <div className="mapa-auth-page__mouse-warp" />

      <div className="mapa-auth-page__shell">
        <section className="mapa-auth-page__hero mapa-auth-page__fade-up">
          <div className="mapa-auth-page__wordmark-box">
            <div className="mapa-auth-page__wordmark-icon">
              <HouseMark className="mapa-auth-page__house-icon" />
            </div>
            <div className="mapa-auth-page__wordmark-text">MAPAGUAPA</div>
          </div>

          <h1 className="mapa-auth-page__hero-title">
            Find a comfortable
            <br />
            place to stay,
            <span>right in your palm.</span>
          </h1>

          <p className="mapa-auth-page__hero-copy">
            <strong>MAPAGUAPA</strong> helps Viscan students discover boarding houses
            <br />
            and apartments that match their comfort, location, and budget
            <br />
            all in one sleek and accessible platform.
          </p>

          <section className="mapa-auth-page__info-panel mapa-auth-page__fade-up mapa-auth-page__fade-up--delay-1">
            {heroHighlights.map((item) => (
              <article className="mapa-auth-page__info-item" key={item.title}>
                <h2 className="mapa-auth-page__info-title">{item.title}</h2>
                <p className="mapa-auth-page__info-copy">{item.text}</p>
              </article>
            ))}
          </section>
        </section>

        <section className="mapa-auth-page__panel mapa-auth-page__fade-up mapa-auth-page__fade-up--delay-2">
          <p className="mapa-auth-page__panel-kicker">Account portal</p>
          <h2 className="mapa-auth-page__panel-title">
            {copy.titleLines.map((line) => (
              <span className="mapa-auth-page__panel-title-line" key={line}>
                {line}
              </span>
            ))}
          </h2>
          <p className="mapa-auth-page__panel-copy">{copy.description}</p>

          <div className="mapa-auth-page__tabs" role="tablist" aria-label="Authentication mode">
            <button
              className={`mapa-auth-page__tab${!isSignup ? " is-active" : ""}`}
              onClick={() => {
                setMode("login");
                setLocalError(null);
              }}
              type="button"
            >
              Log in
            </button>
            <button
              className={`mapa-auth-page__tab${isSignup ? " is-active" : ""}`}
              onClick={() => {
                setMode("signup");
                setLocalError(null);
              }}
              type="button"
            >
              Sign up
            </button>
          </div>          <form className="mapa-auth-page__form" onSubmit={handleSubmit}>
            {isSignup && (
              <label className="mapa-auth-page__field">
                <span className="mapa-auth-page__field-label">Full name</span>
                <input
                  className="mapa-auth-page__input"
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Juan Dela Cruz"
                  type="text"
                  value={fullName}
                />
              </label>
            )}

            <label className="mapa-auth-page__field">
              <span className="mapa-auth-page__field-label">Email</span>
              <input
                className="mapa-auth-page__input"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                type="email"
                value={email}
              />
            </label>

            <label className="mapa-auth-page__field">
              <span className="mapa-auth-page__field-label">Password</span>
              <span className="mapa-auth-page__password-wrap">
                <input
                  className="mapa-auth-page__input mapa-auth-page__input--password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  className="mapa-auth-page__toggle-password"
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
            </label>

            {isSignup && (
              <label className="mapa-auth-page__field">
                <span className="mapa-auth-page__field-label">Confirm password</span>
                <span className="mapa-auth-page__password-wrap">
                  <input
                    className="mapa-auth-page__input mapa-auth-page__input--password"
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Re-enter your password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                  />
                  <button
                    className="mapa-auth-page__toggle-password"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    type="button"
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </span>
              </label>
            )}

            {!isSignup && (
              <div className="mapa-auth-page__form-meta">
                <label className="mapa-auth-page__remember-row">
                  <input type="checkbox" />
                  <span>Remember me</span>
                </label>
                <button className="mapa-auth-page__text-button" type="button">
                  Forgot password?
                </button>
              </div>
            )}

            {activeError && <p className="mapa-auth-page__feedback mapa-auth-page__feedback--error">{activeError}</p>}
            {helperText && <p className="mapa-auth-page__feedback mapa-auth-page__feedback--info">{helperText}</p>}

            <button className="mapa-auth-page__primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Please wait..." : copy.submitLabel}
            </button>

            <div className="mapa-auth-page__divider">
              <span>or continue with</span>
            </div>

            <div className="mapa-auth-page__social-row">
              <button className="mapa-auth-page__ghost-button" disabled type="button">
                Google
              </button>
              <button className="mapa-auth-page__ghost-button" disabled type="button">
                Facebook
              </button>
            </div>
          </form>

          <p className="mapa-auth-page__swap-text">
            {copy.swapLead}{" "}
            <button
              className="mapa-auth-page__text-button"
              onClick={() => {
                setMode(isSignup ? "login" : "signup");
                setLocalError(null);
              }}
              type="button"
            >
              {copy.swapAction}
            </button>
          </p>
        </section>
      </div>
    </main>
  );
}
