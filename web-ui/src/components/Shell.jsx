import React, { createContext, useEffect, useMemo, useRef, useState } from "react";
import { navGroups, topNavSections } from "../navigationConfig";
import { activeRole, roles, synchronizeRoleToken } from "../utils/permissions";
import { platformApiBase } from "../utils/platformApi";
import { Icon } from "./Icons";

export const PermissionRoleContext = createContext(null);

function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const handleChange = () => setMatches(media.matches);
    handleChange();
    media.addEventListener?.("change", handleChange);
    return () => media.removeEventListener?.("change", handleChange);
  }, [query]);

  return matches;
}

function routeMatches(section, route) {
  return section.routes?.some(match => route === match || route.startsWith(`${match}/`) || route.startsWith(`${match}?`));
}

function routeGroupLabel(route) {
  const groups = [
    { label: "Command", matches: ["dashboard", "knowledge", "reports"] },
    { label: "Commercial", matches: ["sales", "orders", "product-pricing", "details/lead", "details/opportunity", "details/quote", "details/contract"] },
    { label: "Customer", matches: ["customer-service", "customer-360", "billing", "details/customer", "details/account", "details/billing-account", "details/invoice", "details/service", "details/ticket"] },
    { label: "Network & Service", matches: ["network", "service-management", "provisioning", "details/network"] },
    { label: "Finance", matches: ["carrier-settlement"] },
    { label: "Administration", matches: ["administration", "details/record"] }
  ];
  const match = groups.find(group => group.matches.some(item => route === item || route.startsWith(`${item}/`) || route.startsWith(`${item}?`)));
  return match?.label || "Workspace";
}

function navigate(setRoute, route) {
  setRoute(route);
}

function TopNavButton({ section, active, onNavigate }) {
  return (
    <button
      className={active ? "topnav-nav-button active" : "topnav-nav-button"}
      type="button"
      onClick={() => onNavigate(section.route || section.id)}
      aria-current={active ? "page" : undefined}
    >
      <Icon name={section.icon} className="button-icon" />
      <span>{section.label}</span>
    </button>
  );
}

function RoleSelector({ role, onRoleChange }) {
  return (
    <label className="role-selector" title="Demo permission role selector">
      <span>Demo role</span>
      <select value={role} onChange={event => onRoleChange(event.target.value)} aria-label="Active permission role">
        {Object.keys(roles).map(item => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  );
}

function UtilityPopover({ utility, onClose, onNavigate, role }) {
  const menuSets = {
    notifications: [
      { label: "Reports", description: "Open operational reporting", route: "reports" },
      { label: "Billing", description: "Review ledger and invoices", route: "billing" },
      { label: "Orders", description: "Inspect delivery queue", route: "orders" },
      { label: "Customer 360", description: "Jump into an account workspace", route: "customer-360" }
    ],
    help: [
      { label: "Customer Service", description: "Support and case work", route: "customer-service" },
      { label: "Network & Service", description: "Operational queue", route: "network" },
      { label: "Reports", description: "Search and export reports", route: "reports" }
    ],
    settings: [
      { label: "Administration", description: "Users, roles, and integrations", route: "administration" },
      { label: "Product & Pricing", description: "Catalog and governance", route: "product-pricing" },
      { label: "Billing", description: "Billing controls and reports", route: "billing" }
    ],
    profile: [
      { label: `Active role: ${role}`, description: "Role controls sensitive actions", route: "administration" },
      { label: "Home", description: "Return to the operating brief", route: "dashboard" },
      { label: "Sales", description: "Pipeline and quote desk", route: "sales" },
      { label: "Sign out", description: "Session action placeholder", route: "dashboard" }
    ]
  };
  const items = menuSets[utility] || [];
  return (
    <div className="topnav-utility-panel" role="menu" aria-label={utility}>
      {items.map(item => (
        <button
          key={item.label}
          className="nav-menu-link"
          type="button"
          onClick={() => {
            onNavigate(item.route);
            onClose();
          }}
        >
          <div className="nav-menu-link-copy">
            <strong>{item.label}</strong>
            <span>{item.description}</span>
          </div>
          <Icon name="chevronRight" className="button-icon" />
        </button>
      ))}
    </div>
  );
}

function SearchPopover({ query, results, onChange, onNavigate, onClose, mobile = false }) {
  return (
    <div className={mobile ? "topnav-search-sheet" : "topnav-search-popover"} role="dialog" aria-label="Global search">
      <label className="topnav-search-field">
        <Icon name="search" className="button-icon" />
        <input
          value={query}
          onChange={event => onChange(event.target.value)}
          placeholder="Search modules and workspaces"
          autoFocus={mobile}
        />
      </label>
      <div className="topnav-search-results">
        {results.length ? results.map(item => (
          <button key={`${item.route}-${item.label}`} className="nav-menu-link" type="button" onClick={() => onNavigate(item.route)}>
            <div className="nav-menu-link-copy">
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </div>
            <Icon name="chevronRight" className="button-icon" />
          </button>
        )) : (
          <div className="topnav-empty-search">No matches found.</div>
        )}
      </div>
      {mobile && (
        <button className="ghost-button topnav-search-close" type="button" onClick={onClose}>
          Close
        </button>
      )}
    </div>
  );
}

function MobileDrawer({ activeRoute, onNavigate, onClose }) {
  return (
    <div className="topnav-drawer" role="dialog" aria-label="Primary navigation">
      <div className="topnav-drawer-header">
        <div>
          <strong>Navigation</strong>
          <span>{routeGroupLabel(activeRoute)} workspace</span>
        </div>
        <button className="topnav-mega-close" type="button" onClick={onClose} aria-label="Close navigation">
          <Icon name="close" className="button-icon" />
        </button>
      </div>
      <div className="topnav-drawer-groups">
        {navGroups.map(group => (
          <section key={group.label} className="topnav-drawer-group">
            <strong className="topnav-drawer-group-title">{group.label}</strong>
            <div className="topnav-drawer-flat">
              {group.items.map(item => {
                const section = topNavSections.find(nav => nav.id === item.id);
                if (!section) return null;
                const active = routeMatches(section, activeRoute);
                return (
                  <button
                    key={section.id}
                    className={active ? "topnav-drawer-item active" : "topnav-drawer-item"}
                    type="button"
                    onClick={() => {
                      onNavigate(section.route || section.id);
                      onClose();
                    }}
                  >
                    <Icon name={section.icon} className="button-icon" />
                    <span>{section.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function Shell({ activeRoute, setRoute, children }) {
  const isMobile = useMediaQuery("(max-width: 760px)");
  const shellRef = useRef(null);
  const [utility, setUtility] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [role, setRole] = useState(activeRole());

  function changeRole(nextRole) {
    window.localStorage?.setItem("bdwus.role", nextRole);
    setRole(nextRole);
  }

  const searchIndex = useMemo(() => {
    return topNavSections.map(section => ({ label: section.label, description: section.label, route: section.route || section.id, icon: section.icon }));
  }, []);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const scored = searchIndex.filter(item => {
      if (!query) return true;
      return [item.label, item.description, item.route].some(value => String(value).toLowerCase().includes(query));
    });
    return scored.slice(0, 8);
  }, [searchIndex, searchQuery]);
  const activeSection = topNavSections.find(section => routeMatches(section, activeRoute));
  const activeGroup = routeGroupLabel(activeRoute);

  useEffect(() => {
    setUtility(null);
    setSearchOpen(false);
    setDrawerOpen(false);
  }, [activeRoute]);

  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile]);

  useEffect(() => {
    synchronizeRoleToken(platformApiBase, role).catch(() => {});
  }, [role]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!shellRef.current?.contains(event.target)) {
        setUtility(null);
        setSearchOpen(false);
        setDrawerOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function go(route) {
    navigate(setRoute, route);
    setUtility(null);
    setSearchOpen(false);
    setDrawerOpen(false);
    setSearchQuery("");
  }

  return (
    <PermissionRoleContext.Provider value={role}>
      <div className="app-shell" ref={shellRef}>
      <header className="app-topnav">
        <div className="topnav-left">
          {isMobile && (
            <button className="topnav-icon-button" type="button" aria-label="Open navigation" onClick={() => {
              setUtility(null);
              setSearchOpen(false);
              setDrawerOpen(open => !open);
            }}>
              <Icon name={drawerOpen ? "close" : "menu"} className="button-icon" />
            </button>
          )}
          <button className="topnav-brand" type="button" onClick={() => go("dashboard")}>
            <span className="topnav-brand-mark">BDW</span>
            <span className="topnav-brand-copy">
              <strong>Northstar Telecom</strong>
              <span>{activeGroup}{activeSection ? ` · ${activeSection.label}` : ""}</span>
            </span>
          </button>
        </div>

        {!isMobile && (
          <nav className="topnav-center" aria-label="Primary">
            {topNavSections.map(section => (
              <div className="topnav-menu-anchor" key={section.id}>
                <TopNavButton
                  section={section}
                  active={routeMatches(section, activeRoute)}
                  onNavigate={route => {
                    setUtility(null);
                    setSearchOpen(false);
                    setDrawerOpen(false);
                    go(route);
                  }}
                />
              </div>
            ))}
          </nav>
        )}

        <div className="topnav-right">
          {!isMobile ? <RoleSelector role={role} onRoleChange={changeRole} /> : null}
          {!isMobile ? (
            <div className="topnav-search-shell">
              <label className="topnav-search-field">
                <Icon name="search" className="button-icon" />
                <input
                  value={searchQuery}
                  onFocus={() => {
                    setUtility(null);
                    setDrawerOpen(false);
                    setSearchOpen(true);
                  }}
                  onChange={event => {
                    setUtility(null);
                    setDrawerOpen(false);
                    setSearchQuery(event.target.value);
                    setSearchOpen(true);
                  }}
                  placeholder="Search modules and workspaces"
                />
              </label>
              {searchOpen && (
                <SearchPopover
                  query={searchQuery}
                  results={searchResults}
                  onChange={setSearchQuery}
                  onNavigate={go}
                  onClose={() => setSearchOpen(false)}
                />
              )}
            </div>
          ) : (
            <button className="topnav-icon-button" type="button" aria-label="Search" onClick={() => {
              setUtility(null);
              setDrawerOpen(false);
              setSearchOpen(open => !open);
            }}>
              <Icon name="search" className="button-icon" />
            </button>
          )}
          <button className="topnav-icon-button" type="button" aria-label="Notifications" onClick={() => {
            setSearchOpen(false);
            setDrawerOpen(false);
            setUtility(current => current === "notifications" ? null : "notifications");
          }}>
            <Icon name="bell" className="button-icon" />
          </button>
          <button className="topnav-icon-button" type="button" aria-label="Help" onClick={() => {
            setSearchOpen(false);
            setDrawerOpen(false);
            setUtility(current => current === "help" ? null : "help");
          }}>
            <Icon name="help" className="button-icon" />
          </button>
          <button className="topnav-icon-button" type="button" aria-label="Settings" onClick={() => {
            setSearchOpen(false);
            setDrawerOpen(false);
            setUtility(current => current === "settings" ? null : "settings");
          }}>
            <Icon name="settings" className="button-icon" />
          </button>
          <button className="topnav-avatar" type="button" aria-label="Profile" onClick={() => {
            setSearchOpen(false);
            setDrawerOpen(false);
            setUtility(current => current === "profile" ? null : "profile");
          }}>BW</button>
        </div>

        {utility && (
          <UtilityPopover
            utility={utility}
            role={role}
            onClose={() => setUtility(null)}
            onNavigate={go}
          />
        )}
        {isMobile && searchOpen && (
          <SearchPopover
            mobile
            query={searchQuery}
            results={searchResults}
            onChange={setSearchQuery}
            onNavigate={go}
            onClose={() => setSearchOpen(false)}
          />
        )}
        {isMobile && drawerOpen && (
          <MobileDrawer
            activeRoute={activeRoute}
            onNavigate={go}
            onClose={() => setDrawerOpen(false)}
          />
        )}
      </header>
        <main className="content">{children}</main>
      </div>
    </PermissionRoleContext.Provider>
  );
}

export function PageHeader({ title, description, actions, className = "" }) {
  return (
    <header className={`topbar ${className}`}>
      <div className="topbar-title">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="topbar-actions">{actions}</div>
    </header>
  );
}
