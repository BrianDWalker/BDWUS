import React from "react";

export function MetricCard({ label, value, delta, tone = "" }) {
  return (
    <article className="metric-card">
      <div className="label">{label}</div>
      <div className="value">{value ?? "-"}</div>
      {delta !== undefined && delta !== null && <div className={`delta ${tone}`.trim()}>{delta}</div>}
    </article>
  );
}

export function Panel({ title, description, action, children, className = "" }) {
  return (
    <article className={`panel ${action ? "has-panel-action" : ""} ${className}`.trim()}>
      <div className="panel-header">
        <div className="panel-title-copy">
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action && <div className="panel-action-slot">{action}</div>}
      </div>
      <div className="panel-body">{children}</div>
    </article>
  );
}

function rowKey(row, index) {
  return row?.id || row?.Id || row?.key || row?.Key || row?.uuid || row?.UUID || row?.TicketId || row?.TicketNumber || row?.OrderId || row?.OrderNumber || row?.InvoiceId || row?.InvoiceNumber || row?.CustomerNumber || row?.OpportunityId || row?.QuoteId || row?.ContractId || index;
}

export function DataTable({ columns, rows = [], onRowClick, emptyMessage = "No rows returned." }) {
  return (
    <div className="table-wrap" role="region" aria-label="Data table" tabIndex={0}>
      <table className="table">
        <thead>
          <tr>{columns.map(column => <th key={column.key} scope="col">{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr
              className={onRowClick ? "interactive-row" : ""}
              key={rowKey(row, index)}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map(column => <td key={column.key}>{column.render ? column.render(row, index) : row[column.key]}</td>)}
            </tr>
          )) : (
            <tr className="table-empty-row">
              <td colSpan={Math.max(columns.length, 1)}>{emptyMessage}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function StatusTag({ children, tone = "blue" }) {
  return <span className={`mini-tag ${tone}`.trim()}>{children || "-"}</span>;
}

export function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value || 0);
}
