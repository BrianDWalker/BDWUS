import React from "react";

export function MetricCard({ label, value, delta, tone = "" }) {
  return (
    <article className="metric-card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className={`delta ${tone}`}>{delta}</div>
    </article>
  );
}

export function Panel({ title, description, action, children, className = "" }) {
  return (
    <article className={`panel ${className}`}>
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      <div className="panel-body">{children}</div>
    </article>
  );
}

export function DataTable({ columns, rows, onRowClick }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>{columns.map(column => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              className={onRowClick ? "interactive-row" : ""}
              key={row.id || index}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map(column => <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatusTag({ children, tone = "blue" }) {
  return <span className={`mini-tag ${tone}`}>{children}</span>;
}

export function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}
