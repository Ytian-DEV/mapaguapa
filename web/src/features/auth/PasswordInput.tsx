import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Input } from "../../ui";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/** Password field with the "Show / Hide" toggle from frame 01. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(props, ref) {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      {...props}
      inputSize="lg"
      ref={ref}
      trailing={
        <button
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="auth__toggle"
          onClick={() => setVisible((value) => !value)}
          type="button"
        >
          {visible ? "Hide" : "Show"}
        </button>
      }
      type={visible ? "text" : "password"}
    />
  );
});
