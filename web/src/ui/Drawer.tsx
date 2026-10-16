import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cx } from "./cx";
import "./drawer.css";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: "left" | "right" | "bottom";
  children: ReactNode;
  className?: string;
  hideTitle?: boolean;
};

/** Off-canvas panel (mobile nav, filters sheet). Native <dialog> keeps focus inside. */
export function Drawer({ open, onClose, title, side = "left", children, className, hideTitle = false }: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

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
      aria-labelledby={titleId}
      className={cx("ui-drawer", `ui-drawer--${side}`, className)}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      ref={ref}
    >
      {open && (
        <div className="ui-drawer__panel">
          <header className="ui-drawer__header">
            <h2 className={cx("ui-drawer__title", hideTitle && "v2-sr-only")} id={titleId}>
              {title}
            </h2>
            <button aria-label="Close" className="ui-drawer__close" onClick={onClose} type="button">
              <X />
            </button>
          </header>
          <div className="ui-drawer__body">{children}</div>
        </div>
      )}
    </dialog>
  );
}
