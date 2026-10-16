import { Logo } from "../ui";
import "./full-page-loader.css";

export function FullPageLoader({ label = "Loading mapaguapa…" }: { label?: string }) {
  return (
    <div aria-busy="true" aria-live="polite" className="v2 app-loader" role="status">
      <Logo />
      <span className="app-loader__bar" aria-hidden="true" />
      <span className="v2-sr-only">{label}</span>
    </div>
  );
}
