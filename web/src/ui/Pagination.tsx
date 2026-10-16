import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";
import { cx } from "./cx";
import "./pagination.css";

type PaginationProps = {
  /** Zero-based current page. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  className?: string;
};

function pageWindow(current: number, count: number): Array<number | "gap"> {
  if (count <= 7) {
    return Array.from({ length: count }, (_, index) => index);
  }
  const pages = new Set([0, count - 1, current - 1, current, current + 1].filter((p) => p >= 0 && p < count));
  if (current <= 2) [1, 2, 3].forEach((p) => pages.add(p));
  if (current >= count - 3) [count - 4, count - 3, count - 2].forEach((p) => pages.add(p));
  const sorted = [...pages].sort((a, b) => a - b);
  const result: Array<number | "gap"> = [];
  sorted.forEach((p, index) => {
    if (index > 0 && p - sorted[index - 1] > 1) result.push("gap");
    result.push(p);
  });
  return result;
}

/** Numbered server-side pagination (A2/A4): "Showing 1–8 of 90" + page buttons. */
export function Pagination({ page, pageSize, total, onPageChange, itemLabel = "results", className }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);

  return (
    <nav aria-label="Pagination" className={cx("ui-pagination", className)}>
      <p className="ui-pagination__summary">
        Showing {from}–{to} of {total} {itemLabel}
      </p>
      <div className="ui-pagination__pages">
        <button aria-label="Previous page" className="ui-pagination__btn" disabled={page === 0} onClick={() => onPageChange(page - 1)} type="button">
          <ChevronLeft />
        </button>
        {pageWindow(page, pageCount).map((entry, index) =>
          entry === "gap" ? (
            <span aria-hidden="true" className="ui-pagination__gap" key={`gap-${index}`}>
              …
            </span>
          ) : (
            <button
              aria-current={entry === page ? "page" : undefined}
              aria-label={`Page ${entry + 1}`}
              className={cx("ui-pagination__btn", entry === page && "ui-pagination__btn--active")}
              key={entry}
              onClick={() => onPageChange(entry)}
              type="button"
            >
              {entry + 1}
            </button>
          )
        )}
        <button
          aria-label="Next page"
          className="ui-pagination__btn"
          disabled={page >= pageCount - 1}
          onClick={() => onPageChange(page + 1)}
          type="button"
        >
          <ChevronRight />
        </button>
      </div>
    </nav>
  );
}

/** "Showing 4 of 90 places" + "Show more places" (Browse). */
export function ShowMore({
  shown,
  total,
  onMore,
  loading,
  itemLabel = "places",
}: {
  shown: number;
  total: number;
  onMore: () => void;
  loading?: boolean;
  itemLabel?: string;
}) {
  return (
    <div className="ui-show-more">
      <p aria-live="polite" className="ui-pagination__summary">
        Showing {shown} of {total} {itemLabel}
      </p>
      {shown < total && (
        <Button loading={loading} onClick={onMore} trailingIcon={<ChevronDown />} variant="secondary">
          Show more {itemLabel}
        </Button>
      )}
    </div>
  );
}
