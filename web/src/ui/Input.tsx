import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cx } from "./cx";
import "./input.css";

type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  hideLabel?: boolean;
  className?: string;
  /** A single control; Field wires up id, aria-describedby and aria-invalid. */
  children: ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean }>;
};

export function Field({ label, hint, error, optional, hideLabel, className, children }: FieldProps) {
  const generatedId = useId();
  const controlId = children.props.id ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [children.props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx("ui-field", error && "ui-field--error", className)}>
      <label className={cx("ui-field__label", hideLabel && "v2-sr-only")} htmlFor={controlId}>
        {label}
        {optional && <span className="ui-field__optional">Optional</span>}
      </label>
      {isValidElement(children)
        ? cloneElement(children, { id: controlId, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })
        : children}
      {hint && !error && (
        <p className="ui-field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="ui-field__error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  leadingIcon?: ReactNode;
  trailing?: ReactNode;
  inputSize?: "md" | "lg";
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { leadingIcon, trailing, inputSize = "md", className, ...rest },
  ref
) {
  if (!leadingIcon && !trailing) {
    return <input {...rest} className={cx("ui-input", inputSize === "lg" && "ui-input--lg", className)} ref={ref} />;
  }

  return (
    <div className={cx("ui-input-wrap", inputSize === "lg" && "ui-input--lg", className)}>
      {leadingIcon && <span className="ui-input-wrap__icon">{leadingIcon}</span>}
      <input {...rest} className="ui-input ui-input--bare" ref={ref} />
      {trailing && <span className="ui-input-wrap__trailing">{trailing}</span>}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 4, ...rest },
  ref
) {
  return <textarea {...rest} className={cx("ui-input", "ui-textarea", className)} ref={ref} rows={rows} />;
});

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode; description?: ReactNode };

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, className, ...rest },
  ref
) {
  return (
    <label className={cx("ui-check", className)}>
      <input {...rest} className="ui-check__box" ref={ref} type="checkbox" />
      <span className="ui-check__text">
        <span>{label}</span>
        {description && <span className="ui-check__desc">{description}</span>}
      </span>
    </label>
  );
});

type ToggleProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode };

export const Toggle = forwardRef<HTMLInputElement, ToggleProps>(function Toggle({ label, className, ...rest }, ref) {
  return (
    <label className={cx("ui-toggle", className)}>
      <input {...rest} className="ui-toggle__input" ref={ref} role="switch" type="checkbox" />
      <span aria-hidden="true" className="ui-toggle__track">
        <span className="ui-toggle__thumb" />
      </span>
      <span className="ui-toggle__label">{label}</span>
    </label>
  );
});
