import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import "./chip.css";

/** Static tag, e.g. amenity labels on a listing card. */
export function Tag({ className, children, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span {...rest} className={cx("ui-tag", className)}>
      {children}
    </span>
  );
}

type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  selected?: boolean;
  icon?: ReactNode;
};

/** Toggleable filter chip (quick filters, template chips). */
export function Chip({ selected = false, icon, className, children, type = "button", ...rest }: ChipProps) {
  return (
    <button
      {...rest}
      aria-pressed={selected}
      className={cx("ui-chip", selected && "ui-chip--selected", className)}
      type={type}
    >
      {icon}
      {children}
    </button>
  );
}

export function ChipGroup({ className, children, label }: { className?: string; children: ReactNode; label: string }) {
  return (
    <div aria-label={label} className={cx("ui-chip-group", className)} role="group">
      {children}
    </div>
  );
}
