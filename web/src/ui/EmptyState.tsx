import type { ReactNode } from "react";
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
  return (
    <div
      className={cx("ui-empty", `ui-empty--${tone}`, compact && "ui-empty--compact", className)}
      role={tone === "error" ? "alert" : undefined}
    >
      {icon && <span className="ui-empty__icon">{icon}</span>}
      <h3 className="ui-empty__title">{title}</h3>
      {description && <p className="ui-empty__desc">{description}</p>}
      {action && <div className="ui-empty__action">{action}</div>}
    </div>
  );
}
