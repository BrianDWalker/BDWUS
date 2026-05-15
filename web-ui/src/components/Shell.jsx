import React, { useEffect, useMemo, useRef, useState } from "react";
import { topNavSections } from "../data/mockData";
import { Icon } from "./Icons";

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

function navigate(setRoute, route) {
  setRoute(route);
}

function TopNavButton({ section, active, open, onOpen }) {
  return (
    <button
      className={active || open ? "topnav-nav-button active" : "topnav-nav-button"}
      type="button"
      onClick={() => onOpen(section.id)}
      onMouseEnter={() => onOpen(section.id)}
      onFocus={() => onOpen(section.id)}
      aria-expanded={open}
      aria-haspopup="menu"
    >
      <Icon name={section.icon} className="button-icon" />
      <span>{section.label}</span>
      <Icon name="chevronDown" className="button-icon" />
    </button>
  );
}

function MenuLink({ item, onClick }) {
  return (
    <button className="nav-menu-link" type="button" onClick={onClick}>
      <div className="nav-menu-link-copy">
        <strong>{item.label}</strong>
        <span>{item.description}</span>
      </div>
      <Icon name={item.icon || "chevronRight"} className="button-icon" />
    </button>
  );
}

function DesktopMenu({ section, onNavigate, onClose }) {
  if (!section) return null;
  return (
    <div className="topnav-mega-panel" role="menu" aria-label={section.label}>
      <div className="topnav-mega-head">
        <div>
          <strong>{section.label}</strong>
          <span>{section.description}</span>
        </div>
        <button className="topnav-mega-close" type="button" onClick={onClose} aria-label="Close menu">
          <Icon name="close" className="button-icon" />
        </button>
      </div>
      <div className="topnav-mega-grid">
        {section.groups.map(group => (
          <div className="topnav-mega-group" key={group.title}>
            <div className="topnav-mega-group-title">{group.title}</div>
            <div className="topnav-mega-links">
              {group.links.map(item => (
                <MenuLink key={item.label} item={item} onClick={() => onNavigate(item.route)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UtilityPopover({ utility, onClose, onNavigate }) {
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
      { label: "Home", description: "Return to the operating brief", route: "dashboard" },
      { label: "Sales", description: "Pipeline and quote desk", route: "sales" },
      { label: "Sign out", description: "Session action placeholder", route: "dashboard" }
    ]
  };
  const items = menuSets[utility] || [];
  return (
    <div className="topnav-utility-panel" role="menu" aria-label={utility}>
      {items.map(item => (
        <MenuLink
          key={item.label}
          item={item}
          onClick={() => {
            onNavigate(item.route);
            onClose();
          }}
        />
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
          <MenuLink key={`${item.route}-${item.label}`} item={item} onClick={() => onNavigate(item.route)} />
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

function MobileDrawer({ activeRoute, onNavigate, openSection, setOpenSection, onClose }) {
  return (
    <div className="topnav-drawer" role="dialog" aria-label="Primary navigation">
      <div className="topnav-drawer-header">
        <strong>Navigation</strong>
        <button className="topnav-mega-close" type="button" onClick={onClose} aria-label="Close navigation">
          <Icon name="close" className="button-icon" />
        </button>
      </div>
      <div className="topnav-drawer-sections">
        {topNavSections.map(section => {
          const open = openSection === section.id;
          const active = routeMatches(section, activeRoute);
          return (
            <div className={active ? "topnav-drawer-section active" : "topnav-drawer-section"} key={section.id}>
              <button className="topnav-drawer-toggle" type="button" onClick={() => setOpenSection(open ? null : section.id)}>
                <div>
                  <strong>{section.label}</strong>
                  <span>{section.description}</span>
                </div>
                <Icon name={open ? "chevronDown" : "chevronRight"} className="button-icon" />
              </button>
              {open && (
                <div className="topnav-drawer-links">
                  {section.groups.map(group => (
                    <div className="topnav-drawer-group" key={group.title}>
                      <div className="topnav-mega-group-title">{group.title}</div>
                      {group.links.map(item => (
                        <MenuLink
                          key={item.label}
                          item={item}
                          onClick={() => {
                            onNavigate(item.route);
                            onClose();
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Shell({ activeRoute, setRoute, children }) {
  const isMobile = useMediaQuery("(max-width: 1100px)");
  const shellRef = useRef(null);
  const [openSection, setOpenSection] = useState(null);
  const [utility, setUtility] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const searchIndex = useMemo(() => {
    const items = [];
    topNavSections.forEach(section => {
      items.push({ label: section.label, description: section.description, route: section.routes?.[0] || "dashboard", icon: section.icon });
      section.groups.forEach(group => {
        group.links.forEach(link => items.push(link));
      });
    });
    return items;
  }, []);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const scored = searchIndex.filter(item => {
      if (!query) return true;
      return [item.label, item.description, item.route].some(value => String(value).toLowerCase().includes(query));
    });
    return scored.slice(0, 8);
  }, [searchIndex, searchQuery]);

  const activeSection = topNavSections.find(section => routeMatches(section, activeRoute)) || topNavSections[0];

  useEffect(() => {
    setOpenSection(null);
    setUtility(null);
    setSearchOpen(false);
    setDrawerOpen(false);
  }, [activeRoute]);

  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!shellRef.current?.contains(event.target)) {
        setOpenSection(null);
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
    setOpenSection(null);
    setUtility(null);
    setSearchOpen(false);
    setDrawerOpen(false);
    setSearchQuery("");
  }

  return (
    <div className="app-shell" ref={shellRef}>
      <header className="app-topnav">
        <div className="topnav-left">
          {isMobile && (
            <button className="topnav-icon-button" type="button" aria-label="Open navigation" onClick={() => {
              setOpenSection(null);
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
              <span>Unified operations platform</span>
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
                  open={openSection === section.id}
                  onOpen={sectionId => {
                    setUtility(null);
                    setSearchOpen(false);
                    setDrawerOpen(false);
                    setOpenSection(sectionId);
                  }}
                />
              </div>
            ))}
          </nav>
        )}

        <div className="topnav-right">
          {!isMobile ? (
            <div className="topnav-search-shell">
              <label className="topnav-search-field">
                <Icon name="search" className="button-icon" />
                <input
                  value={searchQuery}
                  onFocus={() => {
                    setOpenSection(null);
                    setUtility(null);
                    setDrawerOpen(false);
                    setSearchOpen(true);
                  }}
                  onChange={event => {
                    setOpenSection(null);
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
              setOpenSection(null);
              setUtility(null);
              setDrawerOpen(false);
              setSearchOpen(open => !open);
            }}>
              <Icon name="search" className="button-icon" />
            </button>
          )}
          <button className="topnav-icon-button" type="button" aria-label="Notifications" onClick={() => {
            setOpenSection(null);
            setSearchOpen(false);
            setDrawerOpen(false);
            setUtility(current => current === "notifications" ? null : "notifications");
          }}>
            <Icon name="bell" className="button-icon" />
          </button>
          <button className="topnav-icon-button" type="button" aria-label="Help" onClick={() => {
            setOpenSection(null);
            setSearchOpen(false);
            setDrawerOpen(false);
            setUtility(current => current === "help" ? null : "help");
          }}>
            <Icon name="help" className="button-icon" />
          </button>
          <button className="topnav-icon-button" type="button" aria-label="Settings" onClick={() => {
            setOpenSection(null);
            setSearchOpen(false);
            setDrawerOpen(false);
            setUtility(current => current === "settings" ? null : "settings");
          }}>
            <Icon name="settings" className="button-icon" />
          </button>
          <button className="topnav-avatar" type="button" aria-label="Profile" onClick={() => {
            setOpenSection(null);
            setSearchOpen(false);
            setDrawerOpen(false);
            setUtility(current => current === "profile" ? null : "profile");
          }}>BW</button>
        </div>

        {!isMobile && openSection && (
          <DesktopMenu
            section={topNavSections.find(section => section.id === openSection)}
            onNavigate={go}
            onClose={() => setOpenSection(null)}
          />
        )}
        {utility && (
          <UtilityPopover
            utility={utility}
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
            openSection={openSection}
            setOpenSection={setOpenSection}
            onClose={() => setDrawerOpen(false)}
          />
        )}
      </header>
      <main className="content">{children}</main>
    </div>
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
