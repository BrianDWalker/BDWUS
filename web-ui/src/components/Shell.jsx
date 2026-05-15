import React, { useState } from "react";
import { navGroups } from "../data/mockData";
import { Icon } from "./Icons";

function navigateTo(route) {
  window.location.hash = `/${route}`;
}

function TopbarMenu({ icon, label, menu, onToggle }) {
  return (
    <div className="topbar-menu-anchor">
      <button className={icon === "user" ? "topbar-user" : "topbar-icon-button"} type="button" aria-label={label} onClick={() => onToggle(menu)}>
        {icon === "user" ? "BW" : <Icon name={icon} className="button-icon" />}
      </button>
    </div>
  );
}

function TopbarUtilities({ withSearch = false, searchPlaceholder = "Search accounts, invoices, orders..." }) {
  const [openMenu, setOpenMenu] = useState(null);
  const menuSets = {
    notifications: [
      { label: "Reports", description: "Open operational reporting", route: "reports" },
      { label: "Billing", description: "Review ledger and invoices", route: "billing" },
      { label: "Customer 360", description: "Jump into an account workspace", route: "customer-360" },
      { label: "Orders", description: "Inspect delivery queue", route: "orders" }
    ],
    settings: [
      { label: "Product & Pricing", description: "Catalog and pricing governance", route: "product-pricing" },
      { label: "Customer Service", description: "Cases and service desk", route: "customer-service" },
      { label: "Sales", description: "Pipeline and quote desk", route: "sales" },
      { label: "Home", description: "Return to the daily brief", route: "dashboard" }
    ],
    user: [
      { label: "Dashboard", description: "Home workspace", route: "dashboard" },
      { label: "Reports", description: "Report catalog and exports", route: "reports" },
      { label: "Billing", description: "Accounts and invoices", route: "billing" },
      { label: "Sign out", description: "Session action placeholder", onClick: () => {} }
    ]
  };
  const items = openMenu ? menuSets[openMenu] || [] : [];

  return (
    <div className="topbar-controls">
      {withSearch && (
        <label className="topbar-search">
          <Icon name="search" className="button-icon" />
          <input placeholder={searchPlaceholder} />
        </label>
      )}
      <div className="topbar-button-group">
        <TopbarMenu icon="bell" label="Notifications" menu="notifications" onToggle={setOpenMenu} />
        <TopbarMenu icon="settings" label="Settings" menu="settings" onToggle={setOpenMenu} />
        <TopbarMenu icon="user" label="User account" menu="user" onToggle={setOpenMenu} />
        {openMenu && (
          <div className="topbar-popover" role="menu" aria-label={`${openMenu} menu`}>
            {items.map(item => (
              <button
                key={item.label}
                className="topbar-popover-item"
                type="button"
                role="menuitem"
                onClick={() => {
                  if (item.route) navigateTo(item.route);
                  item.onClick?.();
                  setOpenMenu(null);
                }}
              >
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Shell({ activeRoute, setRoute, children, onNotifications, onSettings, onUser }) {
  return (
    <div className="app-shell">
      <aside className="sidebar platform-sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true"></div>
          <div className="brand-copy">
            <strong>Northstar Telecom</strong>
            <span>Unified operations platform</span>
          </div>
        </div>

        <nav className="sidebar-nav grouped-nav" aria-label="Primary">
          {navGroups.map(group => (
            <div className="nav-group" key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              {group.items.map(item => (
                <a
                  data-nav
                  href={`#/${item.id}`}
                  className={activeRoute === item.id ? "active" : ""}
                  key={item.id}
                  onClick={() => setRoute(item.id)}
                >
                  <Icon name={item.icon} />
                  <span className="nav-label">{item.label}</span>
                </a>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="label">Platform status</div>
          <div className="value">Demo data layer online</div>
          <div className="footer-note">React/Vite shell with reusable modules, grouped nav, and export-ready reports.</div>
        </div>
      </aside>
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
      <div className="topbar-actions">
        {actions}
        <TopbarUtilities withSearch />
      </div>
    </header>
  );
}
