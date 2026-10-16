import { useEffect, useState, type ReactNode } from "react";
import { Heart, LogOut, Menu as MenuIcon, User } from "lucide-react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Avatar } from "./Avatar";
import { Drawer } from "./Drawer";
import { Logo } from "./Logo";
import { Menu } from "./Menu";
import { cx } from "./cx";
import "./topnav.css";

export type TopNavLink = { to: string; label: string; icon?: ReactNode; badge?: number; end?: boolean };

type TopNavProps = {
  links: TopNavLink[];
  savedCount?: number;
  user?: { name: string; avatarUrl?: string | null } | null;
  onSignOut?: () => void;
  profileTo?: string;
  /** Rendered instead of the account controls when signed out. */
  signedOutActions?: ReactNode;
};

/** Student top navigation (Components 2-41). Collapses into a drawer below 768px. */
export function TopNav({ links, savedCount = 0, user, onSignOut, profileTo = "/profile", signedOutActions }: TopNavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const navLinks = (variant: "bar" | "drawer") =>
    links.map((link) => (
      <NavLink
        className={({ isActive }) => cx(`ui-topnav__link--${variant}`, isActive && "is-active")}
        end={link.end}
        key={link.to}
        to={link.to}
      >
        {variant === "drawer" && link.icon}
        <span>{link.label}</span>
        {typeof link.badge === "number" && link.badge > 0 && (
          <span className="ui-topnav__dot" aria-label={`${link.badge} unread`}>
            {link.badge}
          </span>
        )}
      </NavLink>
    ));

  return (
    <header className="ui-topnav">
      <div className="ui-topnav__inner">
        <div className="ui-topnav__left">
          <Logo />
          <nav aria-label="Main" className="ui-topnav__links">
            {navLinks("bar")}
          </nav>
        </div>
        <div className="ui-topnav__right">
          {user ? (
            <>
              <Link className="ui-topnav__saved" to="/saved">
                <Heart aria-hidden="true" />
                <span>Saved · {savedCount}</span>
              </Link>
              <Menu
                items={[
                  { key: "profile", label: "Profile", icon: <User />, onSelect: () => navigate(profileTo) },
                  { key: "signout", label: "Sign out", icon: <LogOut />, onSelect: () => onSignOut?.() },
                ]}
                label="Account menu"
                trigger={<Avatar name={user.name} src={user.avatarUrl} />}
              />
            </>
          ) : (
            signedOutActions
          )}
          <button aria-expanded={drawerOpen} aria-label="Open menu" className="ui-topnav__toggle" onClick={() => setDrawerOpen(true)} type="button">
            <MenuIcon />
          </button>
        </div>
      </div>
      <Drawer onClose={() => setDrawerOpen(false)} open={drawerOpen} side="right" title="Menu">
        <nav aria-label="Main" className="ui-topnav__drawer-links">
          {navLinks("drawer")}
          {user && (
            <NavLink className={({ isActive }) => cx("ui-topnav__link--drawer", isActive && "is-active")} to="/saved">
              <Heart />
              <span>Saved · {savedCount}</span>
            </NavLink>
          )}
        </nav>
        {user && (
          <div className="ui-topnav__drawer-user">
            <Avatar name={user.name} src={user.avatarUrl} />
            <span>{user.name}</span>
            <button className="ui-topnav__drawer-signout" onClick={onSignOut} type="button">
              <LogOut aria-hidden="true" />
              Sign out
            </button>
          </div>
        )}
      </Drawer>
    </header>
  );
}
