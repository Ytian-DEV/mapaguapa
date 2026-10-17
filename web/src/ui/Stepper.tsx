import type { ReactNode } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { cx } from "./cx";
import "./stepper.css";

export type StepState = "done" | "current" | "todo";

export type StepItem = {
  key: string;
  label: string;
  state: StepState;
};

type StepperProps = {
  steps: StepItem[];
  onSelect?: (key: string) => void;
  label?: string;
  className?: string;
};

/** Vertical wizard stepper (O2). Collapses to a horizontal scroller on mobile. */
export function Stepper({ steps, onSelect, label = "Steps", className }: StepperProps) {
  return (
    <nav aria-label={label} className={cx("ui-stepper", className)}>
      <ol className="ui-stepper__list">
        {steps.map((step, index) => {
          const content = (
            <>
              <span aria-hidden="true" className="ui-stepper__marker">
                {step.state === "done" ? <Check strokeWidth={3} /> : index + 1}
              </span>
              <span className="ui-stepper__label">{step.label}</span>
              {step.state === "done" && <span className="v2-sr-only">(completed)</span>}
            </>
          );

          return (
            <li className={cx("ui-stepper__item", `ui-stepper__item--${step.state}`)} key={step.key}>
              {onSelect ? (
                <button
                  aria-current={step.state === "current" ? "step" : undefined}
                  className="ui-stepper__button"
                  onClick={() => onSelect(step.key)}
                  type="button"
                >
                  {content}
                </button>
              ) : (
                <span aria-current={step.state === "current" ? "step" : undefined} className="ui-stepper__button">
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

type NumberStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  label?: string;
};

/** "− 6 +" counter used for room counts. */
export function NumberStepper({ value, onChange, min = 0, max = 999, step = 1, label, ...aria }: NumberStepperProps) {
  const clamp = (next: number) => Math.max(min, Math.min(max, next));

  return (
    <div className="ui-number">
      <button
        aria-label={`Decrease${label ? ` ${label}` : ""}`}
        className="ui-number__btn"
        disabled={value <= min}
        onClick={() => onChange(clamp(value - step))}
        type="button"
      >
        <Minus />
      </button>
      <input
        {...aria}
        className="ui-number__input"
        inputMode="numeric"
        max={max}
        min={min}
        onChange={(event) => {
          const parsed = Number.parseInt(event.target.value, 10);
          onChange(Number.isNaN(parsed) ? min : clamp(parsed));
        }}
        type="number"
        value={value}
      />
      <button
        aria-label={`Increase${label ? ` ${label}` : ""}`}
        className="ui-number__btn"
        disabled={value >= max}
        onClick={() => onChange(clamp(value + step))}
        type="button"
      >
        <Plus />
      </button>
    </div>
  );
}

type RadioCardOption<T extends string> = { value: T; label: ReactNode; description?: ReactNode };

/** Large selectable cards ("Ladies only / Men only / Mixed"). */
export function RadioCards<T extends string>({
  name,
  options,
  value,
  onChange,
  label,
  className,
}: {
  name: string;
  options: RadioCardOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <fieldset className={cx("ui-radio-cards", className)}>
      <legend className="v2-sr-only">{label}</legend>
      {options.map((option) => (
        <label className={cx("ui-radio-card", value === option.value && "ui-radio-card--selected")} key={option.value}>
          <input
            checked={value === option.value}
            className="ui-radio-card__input"
            name={name}
            onChange={() => onChange(option.value)}
            type="radio"
            value={option.value}
          />
          <span aria-hidden="true" className="ui-radio-card__dot" />
          <span className="ui-radio-card__text">
            <span className="ui-radio-card__label">{option.label}</span>
            {option.description && <span className="ui-radio-card__desc">{option.description}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
