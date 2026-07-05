import React from "react";

function normalizeDateValue(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value, { empty = "-" } = {}) {
  const date = normalizeDateValue(value);
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : (value ? String(value) : empty);
}

export function formatDateTime(value, { empty = "-" } = {}) {
  const date = normalizeDateValue(value);
  return date ? date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : (value ? String(value) : empty);
}

export function formatPercent(value, { empty = "-", maximumFractionDigits = 1 } = {}) {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? new Intl.NumberFormat("en-US", { style: "percent", minimumFractionDigits: 0, maximumFractionDigits }).format(numeric / 100)
    : empty;
}

export function parseStructuredValue(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function summarizeValue(value) {
  if (Array.isArray(value)) return value.map(item => summarizeValue(item)).filter(Boolean).join(", ");
  if (value && typeof value === "object") return Object.entries(value).map(([key, item]) => `${key}: ${summarizeValue(item)}`).join(" | ");
  if (value === undefined || value === null || value === "") return "";
  return String(value);
}

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
  const mobileColumns = columns.filter(column => !column.mobileHidden);
  const titleColumn = mobileColumns.find(column => column.mobileTitle) || mobileColumns.find(column => column.key !== "actions") || mobileColumns[0];
  const subtitleColumn = mobileColumns.find(column => column.mobileSubtitle) || mobileColumns.find(column => column.key !== titleColumn?.key && column.key !== "actions");
  const actionColumns = mobileColumns.filter(column => column.key === "actions" || column.mobileAction);
  const detailColumns = mobileColumns.filter(column => column.key !== titleColumn?.key && column.key !== subtitleColumn?.key && !actionColumns.includes(column));

  return (
    <div className="table-wrap" role="region" aria-label="Data table" tabIndex={0}>
      <div className="table-mobile">
        {rows.length ? rows.map((row, index) => (
          <article
            className={onRowClick ? "table-card interactive-row" : "table-card"}
            key={rowKey(row, index)}
            onClick={() => onRowClick?.(row)}
          >
            {titleColumn && (
              <div className="table-card-header">
                <span>{titleColumn.label || titleColumn.key}</span>
                <strong className="table-card-title">{titleColumn.render ? titleColumn.render(row, index) : row[titleColumn.key]}</strong>
                {subtitleColumn && (
                  <div className="table-card-subtitle">
                    <span>{subtitleColumn.label || subtitleColumn.key}</span>
                    <strong>{subtitleColumn.render ? subtitleColumn.render(row, index) : row[subtitleColumn.key]}</strong>
                  </div>
                )}
              </div>
            )}
            {detailColumns.length ? (
              <div className="table-card-fields">
                {detailColumns.map(column => (
                  <div className="table-card-field" key={column.key}>
                    <span>{column.label || column.key}</span>
                    <div className="table-card-value">{column.render ? column.render(row, index) : row[column.key]}</div>
                  </div>
                ))}
              </div>
            ) : null}
            {actionColumns.length ? (
              <div className="table-card-actions">
                {actionColumns.map(column => (
                  <div key={column.key} className="table-card-action-row">
                    {column.render ? column.render(row, index) : row[column.key]}
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        )) : <div className="table-empty-row">{emptyMessage}</div>}
      </div>
      <table className="table table-desktop">
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

export function WarningBanner({ children }) {
  return children ? <div className="warning-banner" role="status">{children}</div> : null;
}

export function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value || 0);
}

export function StructuredValueSummary({ value, empty = "-" }) {
  const parsed = parseStructuredValue(value, value);

  if (Array.isArray(parsed)) {
    const items = parsed.map(item => summarizeValue(item)).filter(Boolean);
    return items.length ? (
      <div className="token-list">
        {items.map(item => <span className="token-pill" key={item}>{item}</span>)}
      </div>
    ) : empty;
  }

  const summary = summarizeValue(parsed);
  return summary || empty;
}

export function StructuredFieldList({ value, emptyMessage = "No structured values available." }) {
  const parsed = parseStructuredValue(value, null);

  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object" || !Object.keys(parsed).length) {
    return <div className="empty-state compact-empty-state">{emptyMessage}</div>;
  }

  return (
    <dl className="structured-field-list">
      {Object.entries(parsed).map(([key, item]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>{summarizeValue(item) || "-"}</dd>
        </div>
      ))}
    </dl>
  );
}
