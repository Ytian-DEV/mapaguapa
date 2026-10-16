import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { cx } from "./cx";
import "./button.css";

export type ButtonVariant = "primary" | "dark" | "secondary" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg";

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  loading?: boolean;
  block?: boolean;
  iconOnly?: boolean;
};

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

function buttonClass({ variant = "primary", size = "md", block, iconOnly, loading }: CommonProps, className?: string) {
  return cx(
    "ui-btn",
    `ui-btn--${variant}`,
    `ui-btn--${size}`,
    block && "ui-btn--block",
    iconOnly && "ui-btn--icon",
    loading && "ui-btn--loading",
    className
  );
}

function Content({ leadingIcon, trailingIcon, loading, children }: CommonProps & { children?: ReactNode }) {
  return (
    <>
      {loading ? <span aria-hidden="true" className="ui-btn__spinner" /> : leadingIcon}
      {children !== undefined && children !== null && <span className="ui-btn__label">{children}</span>}
      {trailingIcon}
    </>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, leadingIcon, trailingIcon, loading, block, iconOnly, className, children, type = "button", disabled, ...rest },
  ref
) {
  return (
    <button
      {...rest}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, block, iconOnly, loading }, className)}
      disabled={disabled || loading}
      ref={ref}
      type={type}
    >
      <Content leadingIcon={leadingIcon} loading={loading} trailingIcon={trailingIcon}>
        {children}
      </Content>
    </button>
  );
});

export type ButtonLinkProps = CommonProps & LinkProps;

export function ButtonLink({ variant, size, leadingIcon, trailingIcon, block, iconOnly, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link {...rest} className={buttonClass({ variant, size, block, iconOnly }, className)}>
      <Content leadingIcon={leadingIcon} trailingIcon={trailingIcon}>
        {children}
      </Content>
    </Link>
  );
}
