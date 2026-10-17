import type { ReactNode } from "react";
import { devErrorDetail } from "../lib/errors";
import { cx } from "./cx";
import "./empty-state.css";

type EmptyStateProps = {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "error";
  compact?: boolean;
  className?: string;
};

export function EmptyState({ icon, title, description, action, tone = "neutral", compact = false, className }: EmptyStateProps) {
  // Dev builds only: the reason behind "Couldn't load …".
  const detail = tone === "error" ? devErrorDetail() : null;
  return (
    <div
      className={cx("ui-empty", `ui-empty--${tone}`, compact && "ui-empty--compact", className)}
      role={tone === "error" ? "alert" : undefined}
    >
      {icon && <span className="ui-empty__icon">{icon}</span>}
      <h3 className="ui-empty__title">{title}</h3>
      {description && <p className="ui-empty__desc">{description}</p>}
      {detail && <code className="ui-empty__detail">{detail}</code>}
      {action && <div className="ui-empty__action">{action}</div>}
    </div>
  );
}
