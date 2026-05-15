import React from "react";
import { navGroups } from "../data/mockData";
import { Icon } from "./Icons";

export function Shell({ activeRoute, setRoute, children }) {
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
        <label className="topbar-search">
          <Icon name="search" className="button-icon" />
          <input placeholder="Search accounts, invoices, orders..." />
        </label>
        {actions}
        <button className="topbar-icon-button" type="button" aria-label="Notifications"><Icon name="bell" className="button-icon" /></button>
        <button className="topbar-icon-button" type="button" aria-label="Settings"><Icon name="settings" className="button-icon" /></button>
        <button className="topbar-user" type="button" aria-label="User account">BW</button>
      </div>
    </header>
  );
}
