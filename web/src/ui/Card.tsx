import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import "./card.css";

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "article" | "aside";
  padding?: "none" | "sm" | "md" | "lg";
  tone?: "surface" | "paper" | "sage";
};

export function Card({ as: Tag = "div", padding = "md", tone = "surface", className, children, ...rest }: CardProps) {
  return (
    <Tag {...rest} className={cx("ui-card", `ui-card--pad-${padding}`, `ui-card--${tone}`, className)}>
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  eyebrow,
  description,
  action,
  className,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx("ui-card__header", className)}>
      <div className="ui-card__heading">
        {eyebrow && <p className="v2-eyebrow">{eyebrow}</p>}
        <h2 className="ui-card__title">{title}</h2>
        {description && <p className="ui-card__desc">{description}</p>}
      </div>
      {action && <div className="ui-card__action">{action}</div>}
    </header>
  );
}

/** Big-number tile used on the owner and admin overviews. */
export function StatCard({
  label,
  value,
  meta,
  icon,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cx("ui-stat", className)}>
      <div className="ui-stat__top">
        <p className="ui-stat__label">{label}</p>
        {icon && <span className="ui-stat__icon">{icon}</span>}
      </div>
      <p className="ui-stat__value">{value}</p>
      {meta && <p className="ui-stat__meta">{meta}</p>}
    </Card>
  );
}

export function ProgressBar({ value, label, className }: { value: number; label?: string; className?: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cx("ui-progress", className)}>
      {label && (
        <div className="ui-progress__row">
          <span>{label}</span>
          <strong>{clamped}%</strong>
        </div>
      )}
      <div aria-label={label} aria-valuemax={100} aria-valuemin={0} aria-valuenow={clamped} className="ui-progress__track" role="progressbar">
        <span className="ui-progress__fill" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
