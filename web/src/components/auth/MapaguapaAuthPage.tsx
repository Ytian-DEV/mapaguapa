import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import "./mapaguapa-auth.css";

type Mode = "login" | "signup";

type HeroHighlight = {
  title: string;
  text: string;
};

type PointerVars = {
  active: boolean;
  x: number;
  y: number;
  gridShiftX: number;
  gridShiftY: number;
  lensShiftX: number;
  lensShiftY: number;
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
    title: "Welcome back to MAPAGUAPA",
    description:
      "Sign in to explore available boarding houses and manage your saved places.",
    submitLabel: "Log in",
    swapLead: "No account yet?",
    swapAction: "Create one",
  },
  signup: {
    title: "Create your MAPAGUAPA account",
    description:
      "Start your search for student-friendly spaces with a personalized account.",
    submitLabel: "Create account",
    swapLead: "Already have an account?",
    swapAction: "Log in here",
  },
} as const;

function HouseMark() {
  return (
    <svg
      aria-hidden="true"
      className="mapa-auth-page__house-icon"
      fill="none"
      viewBox="0 0 28 28"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4.75 12.25L14 4.5L23.25 12.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
      <path
        d="M7.25 10.85V22.1C7.25 22.6523 7.69772 23.1 8.25 23.1H19.75C20.3023 23.1 20.75 22.6523 20.75 22.1V10.85"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.2"
      />
      <path
        d="M11.1 23.1V15.75H16.9V23.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

export default function MapaguapaAuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const pageRef = useRef<HTMLElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const pointerRef = useRef<PointerVars>({
    active: false,
    x: 0,
    y: 0,
    gridShiftX: 0,
    gridShiftY: 0,
    lensShiftX: 0,
    lensShiftY: 0,
  });

  const copy = modeCopy[mode];
  const isSignup = mode === "signup";

  const applyPointerVars = () => {
    const page = pageRef.current;
    if (!page) {
      return;
    }

    const pointer = pointerRef.current;

    page.style.setProperty("--pointer-x", `${pointer.x}px`);
    page.style.setProperty("--pointer-y", `${pointer.y}px`);
    page.style.setProperty("--pointer-grid-shift-x", `${pointer.gridShiftX}px`);
    page.style.setProperty("--pointer-grid-shift-y", `${pointer.gridShiftY}px`);
    page.style.setProperty("--pointer-lens-shift-x", `${pointer.lensShiftX}px`);
    page.style.setProperty("--pointer-lens-shift-y", `${pointer.lensShiftY}px`);
    page.style.setProperty("--pointer-opacity", pointer.active ? "1" : "0");
  };

  const schedulePointerPaint = () => {
    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      applyPointerVars();
    });
  };

  useEffect(() => {
    const page = pageRef.current;
    if (!page) {
      return;
    }

    const centerX = page.clientWidth * 0.32;
    const centerY = page.clientHeight * 0.38;

    pointerRef.current = {
      active: false,
      x: centerX,
      y: centerY,
      gridShiftX: 0,
      gridShiftY: 0,
      lensShiftX: 0,
      lensShiftY: 0,
    };

    applyPointerVars();

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const updatePointer = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse") {
      return;
    }

    const page = pageRef.current;
    if (!page) {
      return;
    }

    const rect = page.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const rx = rect.width === 0 ? 0.5 : x / rect.width;
    const ry = rect.height === 0 ? 0.5 : y / rect.height;

    pointerRef.current = {
      active: true,
      x,
      y,
      gridShiftX: (0.5 - rx) * 18,
      gridShiftY: (0.5 - ry) * 18,
      lensShiftX: (rx - 0.5) * 8,
      lensShiftY: (ry - 0.5) * 8,
    };

    schedulePointerPaint();
  };

  const hidePointer = () => {
    pointerRef.current = {
      ...pointerRef.current,
      active: false,
      gridShiftX: 0,
      gridShiftY: 0,
      lensShiftX: 0,
      lensShiftY: 0,
    };

    schedulePointerPaint();
  };

  return (
    <main
      className="mapa-auth-page"
      onPointerEnter={updatePointer}
      onPointerLeave={hidePointer}
      onPointerMove={updatePointer}
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
              <HouseMark />
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
          <h2 className="mapa-auth-page__panel-title">{copy.title}</h2>
          <p className="mapa-auth-page__panel-copy">{copy.description}</p>

          <div className="mapa-auth-page__tabs" role="tablist" aria-label="Authentication mode">
            <button
              className={`mapa-auth-page__tab${!isSignup ? " is-active" : ""}`}
              onClick={() => setMode("login")}
              type="button"
            >
              Log in
            </button>
            <button
              className={`mapa-auth-page__tab${isSignup ? " is-active" : ""}`}
              onClick={() => setMode("signup")}
              type="button"
            >
              Sign up
            </button>
          </div>

          <form className="mapa-auth-page__form">
            {isSignup && (
              <label className="mapa-auth-page__field">
                <span className="mapa-auth-page__field-label">Full name</span>
                <input className="mapa-auth-page__input" placeholder="Juan Dela Cruz" type="text" />
              </label>
            )}

            <label className="mapa-auth-page__field">
              <span className="mapa-auth-page__field-label">Email</span>
              <input className="mapa-auth-page__input" placeholder="you@example.com" type="email" />
            </label>

            <label className="mapa-auth-page__field">
              <span className="mapa-auth-page__field-label">Password</span>
              <span className="mapa-auth-page__password-wrap">
                <input
                  className="mapa-auth-page__input mapa-auth-page__input--password"
                  placeholder="Enter your password"
                  type={showPassword ? "text" : "password"}
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
                    placeholder="Re-enter your password"
                    type={showConfirmPassword ? "text" : "password"}
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

            <button className="mapa-auth-page__primary-button" type="button">
              {copy.submitLabel}
            </button>

            <div className="mapa-auth-page__divider">
              <span>or continue with</span>
            </div>

            <div className="mapa-auth-page__social-row">
              <button className="mapa-auth-page__ghost-button" type="button">
                Google
              </button>
              <button className="mapa-auth-page__ghost-button" type="button">
                Facebook
              </button>
            </div>
          </form>

          <p className="mapa-auth-page__swap-text">
            {copy.swapLead}{" "}
            <button
              className="mapa-auth-page__text-button"
              onClick={() => setMode(isSignup ? "login" : "signup")}
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