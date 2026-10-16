import { useEffect, useState, type ReactNode } from "react";
import { LogOut, Menu as MenuIcon } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { Avatar } from "./Avatar";
import { Count } from "./Badge";
import { Drawer } from "./Drawer";
import { Logo } from "./Logo";
import { cx } from "./cx";
import "./sidebar.css";

export type SidebarNavItem = {
  to: string;
  label: string;
  icon: ReactNode;
  count?: number;
  /** Clay-coloured count (things that need action). */
  emphasis?: boolean;
  end?: boolean;
};

export type SidebarGroup = {
  label: string;
  items: SidebarNavItem[];
};

type SidebarUser = {
  name: string;
  subtitle: string;
  avatarUrl?: string | null;
  tone?: "sage" | "clay";
};

type SidebarProps = {
  workspace: string;
  homeTo: string;
  groups: SidebarGroup[];
  user: SidebarUser;
  onSignOut: () => void;
};

function SidebarContent({ workspace, homeTo, groups, user, onSignOut, inDrawer = false }: SidebarProps & { inDrawer?: boolean }) {
  return (
    <div className="ui-sidebar__inner">
      {!inDrawer && (
        <div className="ui-sidebar__brand">
          <Logo to={homeTo} />
          <span className="ui-sidebar__workspace">{workspace}</span>
        </div>
      )}
      <nav aria-label={workspace} className="ui-sidebar__nav">
        {groups.map((group) => (
          <div className="ui-sidebar__group" key={group.label}>
            <p className="ui-sidebar__group-label">{group.label}</p>
            <ul>
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink className={({ isActive }) => cx("ui-sidebar__link", isActive && "ui-sidebar__link--active")} end={item.end} to={item.to}>
                    <span aria-hidden="true" className="ui-sidebar__icon">
                      {item.icon}
                    </span>
                    <span className="ui-sidebar__label">{item.label}</span>
                    {typeof item.count === "number" && item.count > 0 && (
                      <>
                        <Count emphasis={item.emphasis} value={item.count} />
                        <span className="v2-sr-only">{item.emphasis ? "needing attention" : "total"}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="ui-sidebar__user">
        <Avatar name={user.name} src={user.avatarUrl} tone={user.tone ?? "sage"} />
        <div className="ui-sidebar__who">
          <p className="ui-sidebar__name">{user.name}</p>
          <p className="ui-sidebar__subtitle">{user.subtitle}</p>
        </div>
        <button aria-label="Sign out" className="ui-sidebar__signout" onClick={onSignOut} type="button">
          <LogOut />
        </button>
      </div>
    </div>
  );
}

/**
 * Owner/admin sidebar (Components 14-231 / 14-301). Below 768px it becomes a
 * top bar with a menu button that opens the same navigation in a drawer.
 */
export function Sidebar(props: SidebarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    <>
      <aside className="ui-sidebar">
        <SidebarContent {...props} />
      </aside>
      <header className="ui-sidebar-bar">
        <Logo to={props.homeTo} />
        <span className="ui-sidebar__workspace">{props.workspace}</span>
        <button aria-expanded={drawerOpen} aria-label="Open navigation" className="ui-sidebar-bar__toggle" onClick={() => setDrawerOpen(true)} type="button">
          <MenuIcon />
        </button>
      </header>
      <Drawer className="ui-sidebar-drawer" onClose={() => setDrawerOpen(false)} open={drawerOpen} title={props.workspace}>
        <SidebarContent {...props} inDrawer />
      </Drawer>
    </>
  );
}

/** Two-column app frame used by owner and admin areas. */
export function AppShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div className="v2 v2--app ui-app-shell">
      {sidebar}
      <main className="ui-app-shell__main" id="main">
        {children}
      </main>
    </div>
  );
}

/** Page heading block: eyebrow, Fraunces title, subtitle and actions. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="ui-page-header">
      <div className="ui-page-header__text">
        {eyebrow && <p className="v2-eyebrow">{eyebrow}</p>}
        <h1 className="v2-h1">{title}</h1>
        {subtitle && <p className="ui-page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="ui-page-header__actions">{actions}</div>}
    </header>
  );
}
