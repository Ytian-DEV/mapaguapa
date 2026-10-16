import type { CSSProperties, ReactNode } from "react";
import { cx } from "./cx";
import "./skeleton.css";

type SkeletonProps = {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  radius?: CSSProperties["borderRadius"];
  className?: string;
};

export function Skeleton({ width = "100%", height = 16, radius, className }: SkeletonProps) {
  return <span aria-hidden="true" className={cx("ui-skeleton", className)} style={{ width, height, borderRadius: radius }} />;
}

/** Placeholder matching the listing card layout. */
export function ListingCardSkeleton() {
  return (
    <div aria-hidden="true" className="ui-skeleton-card">
      <Skeleton className="ui-skeleton-card__photo" height="auto" radius="var(--radius-card)" />
      <Skeleton height={18} width="70%" />
      <Skeleton height={14} width="45%" />
      <div className="ui-skeleton-card__tags">
        <Skeleton height={24} radius="var(--radius-pill)" width={56} />
        <Skeleton height={24} radius="var(--radius-pill)" width={48} />
        <Skeleton height={24} radius="var(--radius-pill)" width={64} />
      </div>
    </div>
  );
}

/** Screen-reader friendly loading region wrapper. */
export function LoadingRegion({ label = "Loading", children }: { label?: string; children: ReactNode }) {
  return (
    <div aria-busy="true" aria-label={label} role="status">
      {children}
    </div>
  );
}
