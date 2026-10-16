import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cx } from "./cx";
import { Skeleton } from "./Skeleton";
import "./data-table.css";

export type Column<Row> = {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  width?: string;
  align?: "left" | "right" | "center";
  /** Shown as the card title on mobile (only one column should set this). */
  primary?: boolean;
  /** Hide this column in the stacked mobile card. */
  hideOnMobile?: boolean;
};

type DataTableProps<Row> = {
  columns: Column<Row>[];
  rows: Row[];
  getRowId: (row: Row) => string;
  caption: string;
  loading?: boolean;
  skeletonRows?: number;
  empty?: ReactNode;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  rowActions?: (row: Row) => ReactNode;
  onRowClick?: (row: Row) => void;
  className?: string;
};

/**
 * Admin/owner data table (A2, A4). Renders a real <table> on desktop and
 * stacked cards below 768px using the same markup (CSS grid per row).
 */
export function DataTable<Row>({
  columns,
  rows,
  getRowId,
  caption,
  loading = false,
  skeletonRows = 6,
  empty,
  selectable = false,
  selectedIds,
  onSelectionChange,
  rowActions,
  onRowClick,
  className,
}: DataTableProps<Row>) {
  const selected = selectedIds ?? new Set<string>();
  const allIds = rows.map(getRowId);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = !allSelected && allIds.some((id) => selected.has(id));

  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) {
      allIds.forEach((id) => next.delete(id));
    } else {
      allIds.forEach((id) => next.add(id));
    }
    onSelectionChange?.(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange?.(next);
  };

  const colCount = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);

  return (
    <div className={cx("ui-table-wrap", className)}>
      <table className="ui-table">
        <caption className="v2-sr-only">{caption}</caption>
        <thead>
          <tr>
            {selectable && (
              <th className="ui-table__check" scope="col">
                <input
                  aria-label="Select all rows on this page"
                  checked={allSelected}
                  className="ui-table__checkbox"
                  disabled={rows.length === 0}
                  onChange={toggleAll}
                  ref={(node) => {
                    if (node) node.indeterminate = someSelected;
                  }}
                  type="checkbox"
                />
              </th>
            )}
            {columns.map((column) => (
              <th className={cx(column.align && `ui-table--${column.align}`)} key={column.key} scope="col" style={{ width: column.width }}>
                {column.header}
              </th>
            ))}
            {rowActions && (
              <th className="ui-table__actions" scope="col">
                <span className="v2-sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: skeletonRows }, (_, index) => (
              <tr aria-hidden="true" className="ui-table__skeleton" key={`s-${index}`}>
                <td colSpan={colCount}>
                  <Skeleton height={20} />
                </td>
              </tr>
            ))}
          {!loading && rows.length === 0 && (
            <tr className="ui-table__empty-row">
              <td colSpan={colCount}>{empty ?? "Nothing to show."}</td>
            </tr>
          )}
          {!loading &&
            rows.map((row) => {
              const id = getRowId(row);
              const isSelected = selected.has(id);
              return (
                <tr
                  className={cx(isSelected && "ui-table__row--selected", onRowClick && "ui-table__row--clickable")}
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {selectable && (
                    <td className="ui-table__check" onClick={(event) => event.stopPropagation()}>
                      <input
                        aria-label="Select row"
                        checked={isSelected}
                        className="ui-table__checkbox"
                        onChange={() => toggleOne(id)}
                        type="checkbox"
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      className={cx(
                        column.align && `ui-table--${column.align}`,
                        column.primary && "ui-table__primary",
                        column.hideOnMobile && "ui-table__hide-mobile"
                      )}
                      data-label={typeof column.header === "string" ? column.header : undefined}
                      key={column.key}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="ui-table__actions" onClick={(event) => event.stopPropagation()}>
                      {rowActions(row)}
                    </td>
                  )}
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}

/** Dark bar shown above a table when rows are selected (A2 "2 selected"). */
export function BulkBar({ count, children, onClear }: { count: number; children: ReactNode; onClear: () => void }) {
  if (count === 0) {
    return null;
  }
  return (
    <div aria-live="polite" className="ui-bulk" role="region" aria-label="Bulk actions">
      <span className="ui-bulk__count">{count} selected</span>
      <div className="ui-bulk__actions">{children}</div>
      <button aria-label="Clear selection" className="ui-bulk__clear" onClick={onClear} type="button">
        <X />
      </button>
    </div>
  );
}
