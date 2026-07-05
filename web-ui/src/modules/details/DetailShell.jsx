import React from "react";
import { StatusTag } from "../../components/Primitives";

export function DetailHeader({ breadcrumb = [], title, status, subtitle, actions }) {
  return (
    <section className="record-header">
      <div>
        <div className="breadcrumb">{breadcrumb.join(" / ")}</div>
        <div className="record-title-line">
          <h2>{title}</h2>
          {status ? <StatusTag tone={["Active", "Ready", "Connected", "Approved", "Paid", "Completed"].includes(status) ? "success" : ["Warning", "Pending", "Open", "Draft", "Blocked", "At Risk", "Review"].includes(status) ? "warn" : "blue"}>{status}</StatusTag> : null}
        </div>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="record-actions">{actions}</div>
    </section>
  );
}

export function DetailSummary({ items }) {
  return (
    <section className="summary-strip">
      {items.map(item => (
        <article className="mini-stat" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value ?? "-"}</strong>
          {item.note ? <small>{item.note}</small> : null}
        </article>
      ))}
    </section>
  );
}

export function DetailTabs({ tabs, active, onChange }) {
  return (
    <div className="record-tabs" role="tablist">
      {tabs.map(tab => (
        <button key={tab} className={tab === active ? "active" : ""} type="button" onClick={() => onChange(tab)}>
          {tab}
        </button>
      ))}
    </div>
  );
}

export function DetailPanelStack({ children, className = "" }) {
  return <section className={`record-main-layout ${className}`.trim()}>{children}</section>;
}

export function EmptyState({ children }) {
  return <div className="empty-state">{children}</div>;
}
