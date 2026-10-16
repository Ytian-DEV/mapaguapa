import { MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { cx } from "./cx";
import "./logo.css";

type LogoProps = {
  to?: string;
  onDark?: boolean;
  className?: string;
};

export function Logo({ to = "/", onDark = false, className }: LogoProps) {
  return (
    <Link aria-label="mapaguapa home" className={cx("ui-logo", onDark && "ui-logo--on-dark", className)} to={to}>
      <span aria-hidden="true" className="ui-logo__mark">
        <MapPin strokeWidth={2.2} />
      </span>
      <span aria-hidden="true" className="ui-logo__word">
        mapaguapa
      </span>
    </Link>
  );
}
