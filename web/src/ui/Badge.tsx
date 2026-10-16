import type { HTMLAttributes, ReactNode } from "react";
import type { Tone } from "../styles/tokens";
import { cx } from "./cx";
import "./badge.css";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
  dot?: boolean;
  icon?: ReactNode;
};

export function Badge({ tone = "gray", dot = false, icon, className, children, ...rest }: BadgeProps) {
  return (
    <span {...rest} className={cx("ui-badge", `ui-badge--${tone}`, className)}>
      {dot && <span aria-hidden="true" className="ui-badge__dot" />}
      {icon}
      {children}
    </span>
  );
}

/** Small numeric pill used in sidebars and tabs. */
export function Count({ value, emphasis = false, className }: { value: number | string; emphasis?: boolean; className?: string }) {
  return <span className={cx("ui-count", emphasis && "ui-count--emphasis", className)}>{value}</span>;
}

export type ListingStatus = "draft" | "in_review" | "changes_requested" | "published" | "archived";

const statusMeta: Record<ListingStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "gray" },
  in_review: { label: "In review", tone: "amber" },
  changes_requested: { label: "Changes requested", tone: "red" },
  published: { label: "Published", tone: "green" },
  archived: { label: "Archived", tone: "gray" },
};

export function StatusBadge({ status }: { status: ListingStatus }) {
  const meta = statusMeta[status];
  return (
    <Badge dot tone={meta.tone}>
      {meta.label}
    </Badge>
  );
}

export type Role = "student" | "owner" | "admin";

const roleMeta: Record<Role, { label: string; tone: Tone }> = {
  student: { label: "Student", tone: "gray" },
  owner: { label: "Owner", tone: "clay" },
  admin: { label: "Admin", tone: "blue" },
};

export function RoleBadge({ role }: { role: Role }) {
  return <Badge tone={roleMeta[role].tone}>{roleMeta[role].label}</Badge>;
}
