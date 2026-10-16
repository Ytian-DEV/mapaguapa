import { forwardRef, useId, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "./cx";
import "./select.css";

export type SelectOption = { value: string; label: string; disabled?: boolean };

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  options: SelectOption[];
  placeholder?: string;
};

/** Native select styled to match inputs: accessible and mobile-friendly by default. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, placeholder, className, ...rest },
  ref
) {
  return (
    <div className={cx("ui-select", className)}>
      <select {...rest} className="ui-select__control" ref={ref}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option disabled={option.disabled} key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" className="ui-select__chevron" />
    </div>
  );
});

type FilterSelectProps = Omit<SelectProps, "placeholder"> & {
  label: string;
  /** Label for the empty value, e.g. "Any" or "All". */
  anyLabel?: string;
  layout?: "stacked" | "inline";
};

/**
 * Compact filter select from the Browse / Admin frames: a small caption ("Area")
 * with the current value ("Any") beneath or beside it.
 */
export function FilterSelect({ label, anyLabel = "Any", layout = "stacked", options, value, className, ...rest }: FilterSelectProps) {
  const id = useId();
  const current = options.find((option) => option.value === value)?.label ?? anyLabel;

  return (
    <div className={cx("ui-filter-select", `ui-filter-select--${layout}`, className)}>
      <label className="ui-filter-select__caption" htmlFor={id}>
        {label}
        {layout === "inline" && ":"}
      </label>
      <span aria-hidden="true" className="ui-filter-select__value">
        {current}
      </span>
      <ChevronDown aria-hidden="true" className="ui-filter-select__chevron" />
      <select {...rest} className="ui-filter-select__control" id={id} value={value}>
        <option value="">{anyLabel}</option>
        {options.map((option) => (
          <option disabled={option.disabled} key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
