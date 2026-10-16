import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { cx } from "./cx";
import "./menu.css";

export type MenuItem = {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

type MenuProps = {
  items: MenuItem[];
  label: string;
  trigger?: ReactNode;
  align?: "start" | "end";
  className?: string;
};

/** Accessible dropdown menu (row "⋯" menus, avatar menu). */
export function Menu({ items, label, trigger, align = "end", className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointer);
    itemRefs.current.find((node) => node && !node.disabled)?.focus();
    return () => document.removeEventListener("pointerdown", handlePointer);
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const handleMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = itemRefs.current.filter((node): node is HTMLButtonElement => Boolean(node && !node.disabled));
    const index = enabled.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      enabled[(index + 1) % enabled.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      enabled[(index - 1 + enabled.length) % enabled.length]?.focus();
    }
  };

  return (
    <div className={cx("ui-menu", className)} ref={rootRef}>
      <button
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className={cx("ui-menu__trigger", !trigger && "ui-menu__trigger--icon")}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        ref={buttonRef}
        type="button"
      >
        {trigger ?? <MoreHorizontal />}
      </button>
      {open && (
        <div className={cx("ui-menu__list", `ui-menu__list--${align}`)} id={menuId} onKeyDown={handleMenuKey} role="menu">
          {items.map((item, index) => (
            <button
              className={cx("ui-menu__item", item.destructive && "ui-menu__item--danger")}
              disabled={item.disabled}
              key={item.key}
              onClick={(event) => {
                event.stopPropagation();
                close();
                item.onSelect();
              }}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              role="menuitem"
              tabIndex={-1}
              type="button"
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
