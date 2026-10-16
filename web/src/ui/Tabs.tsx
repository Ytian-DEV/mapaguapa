import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { Count } from "./Badge";
import { cx } from "./cx";
import "./tabs.css";

export type TabItem<T extends string> = {
  value: T;
  label: ReactNode;
  count?: number;
};

type TabsProps<T extends string> = {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
  /** id prefix used to connect tabs to a panel via aria-controls. */
  idPrefix?: string;
};

/** Underlined tab bar (A2 Listings). Arrow keys move between tabs. */
export function Tabs<T extends string>({ items, value, onChange, label, className, idPrefix = "tabs" }: TabsProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    let next = index;
    if (delta !== 0) {
      next = (index + delta + items.length) % items.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = items.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    refs.current[next]?.focus();
    onChange(items[next].value);
  };

  return (
    <div aria-label={label} className={cx("ui-tabs", className)} role="tablist">
      {items.map((item, index) => {
        const selected = item.value === value;
        return (
          <button
            aria-controls={`${idPrefix}-panel`}
            aria-selected={selected}
            className={cx("ui-tabs__tab", selected && "ui-tabs__tab--active")}
            id={`${idPrefix}-tab-${item.value}`}
            key={item.value}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            ref={(node) => {
              refs.current[index] = node;
            }}
            role="tab"
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            {item.label}
            {typeof item.count === "number" && item.count > 0 && (
              <Count className={cx(selected && "ui-tabs__count--active")} value={item.count} />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ idPrefix = "tabs", activeValue, children }: { idPrefix?: string; activeValue: string; children: ReactNode }) {
  return (
    <div aria-labelledby={`${idPrefix}-tab-${activeValue}`} id={`${idPrefix}-panel`} role="tabpanel">
      {children}
    </div>
  );
}

type SegmentedProps<T extends string> = {
  items: Array<{ value: T; label: ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
};

/** Pill-style segmented control (e.g. List / Map toggle on mobile). */
export function Segmented<T extends string>({ items, value, onChange, label, className }: SegmentedProps<T>) {
  return (
    <div aria-label={label} className={cx("ui-segmented", className)} role="radiogroup">
      {items.map((item) => (
        <button
          aria-checked={item.value === value}
          className={cx("ui-segmented__item", item.value === value && "ui-segmented__item--active")}
          key={item.value}
          onClick={() => onChange(item.value)}
          role="radio"
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
