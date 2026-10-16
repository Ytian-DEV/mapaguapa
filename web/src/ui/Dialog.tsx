import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";
import { cx } from "./cx";
import "./dialog.css";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Prevent closing via Escape/backdrop while an action is running. */
  dismissible?: boolean;
};

/** Modal built on native <dialog>: focus trapping, Escape and inert background for free. */
export function Dialog({ open, onClose, title, description, children, footer, size = "md", className, dismissible = true }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) {
      node.showModal();
    } else if (!open && node.open) {
      node.close();
    }
  }, [open]);

  return (
    <dialog
      aria-describedby={description ? descId : undefined}
      aria-labelledby={titleId}
      className={cx("ui-dialog", `ui-dialog--${size}`, className)}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose();
      }}
      ref={ref}
    >
      {open && (
        <div className="ui-dialog__panel">
          <header className="ui-dialog__header">
            <div>
              <h2 className="ui-dialog__title" id={titleId}>
                {title}
              </h2>
              {description && (
                <p className="ui-dialog__desc" id={descId}>
                  {description}
                </p>
              )}
            </div>
            {dismissible && (
              <button aria-label="Close" className="ui-dialog__close" onClick={onClose} type="button">
                <X />
              </button>
            )}
          </header>
          {children && <div className="ui-dialog__body">{children}</div>}
          {footer && <footer className="ui-dialog__footer">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  children?: ReactNode;
  confirmDisabled?: boolean;
};

/** Confirmation for destructive actions and role changes. */
export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  busy = false,
  children,
  confirmDisabled = false,
}: ConfirmDialogProps) {
  return (
    <Dialog
      description={description}
      dismissible={!busy}
      footer={
        <>
          <Button disabled={busy} onClick={onCancel} variant="secondary">
            Cancel
          </Button>
          <Button disabled={confirmDisabled} loading={busy} onClick={onConfirm} variant={destructive ? "danger" : "primary"}>
            {confirmLabel}
          </Button>
        </>
      }
      onClose={onCancel}
      open={open}
      size="sm"
      title={title}
    >
      {children}
    </Dialog>
  );
}
