import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/Shell";
import { DataTable, Panel, StatusTag, WarningBanner, formatDateTime, formatMoney, statusTone } from "../../components/Primitives";
import { downloadBlob, makeXlsx } from "../../utils/export";
import { fetchPlatformReport, fetchPlatformReportDefinitions } from "../../utils/platformApi";
import { readSessionCache, writeSessionCache } from "../../utils/sessionCache";

const DEFAULT_PARAMS = {
  reportId: "executive-scorecard",
  region: "All regions",
  period: "Q2 2026 to date",
  segment: "All segments",
  status: "All statuses"
};

const DEFAULT_DEFINITIONS = [
  { id: "executive-scorecard", name: "Executive scorecard", area: "Executive", description: "Pipeline, quoted value, approvals, and contract coverage." },
  { id: "pricing-approval-queue", name: "Pricing approval queue", area: "Pricing", description: "Quotes and custom pricing requests waiting on review." },
  { id: "customer-revenue", name: "Customer revenue watchlist", area: "Billing", description: "Customer MRR and account exposure across active accounts." }
];
const REPORTS_CACHE_KEY = "bdwus.reports.v1";

function csvBlob(rows) {
  const csv = rows.map(row => row.map(cell => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  return new Blob([csv], { type: "text/csv" });
}

export default function ReportsModule({ showToast }) {
  const cached = readSessionCache(REPORTS_CACHE_KEY, null);
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [page, setPage] = useState(1);
  const [runStamp, setRunStamp] = useState(cached?.runStamp || "");
  const [definitions, setDefinitions] = useState(cached?.definitions?.length ? cached.definitions : DEFAULT_DEFINITIONS);
  const [reportPayload, setReportPayload] = useState(cached?.reportPayload || null);
  const [loadingDefinitions, setLoadingDefinitions] = useState(!(cached?.definitions?.length || DEFAULT_DEFINITIONS.length));
  const [loadingReport, setLoadingReport] = useState(!cached?.reportPayload);
  const [error, setError] = useState("");
  const pageSize = 6;

  useEffect(() => {
    let active = true;
    setLoadingDefinitions(true);
    fetchPlatformReportDefinitions()
      .then(items => {
        if (!active) return;
        setDefinitions(items || []);
        writeSessionCache(REPORTS_CACHE_KEY, {
          definitions: items || [],
          reportPayload,
          runStamp
        });
        if (items?.length && !items.some(item => item.id === params.reportId)) {
          setParams(current => ({ ...current, reportId: items[0].id }));
        }
      })
      .catch(err => {
        if (!active) return;
        setError(err.message || "Unable to load report definitions.");
      })
      .finally(() => {
        if (active) setLoadingDefinitions(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoadingReport(true);
    setError("");
    fetchPlatformReport(params.reportId)
      .then(payload => {
        if (!active) return;
        setReportPayload(payload);
        const nextRunStamp = new Date().toISOString();
        setRunStamp(nextRunStamp);
        writeSessionCache(REPORTS_CACHE_KEY, {
          definitions,
          reportPayload: payload,
          runStamp: nextRunStamp
        });
      })
      .catch(err => {
        if (!active) return;
        setError(err.message || "Unable to load report results.");
        setReportPayload(null);
      })
      .finally(() => {
        if (active) setLoadingReport(false);
      });
    return () => {
      active = false;
    };
  }, [params.reportId]);

  const definition = reportPayload?.definition || definitions.find(item => item.id === params.reportId) || definitions[0] || { name: "Report", description: "Report results", area: "General" };
  const rows = reportPayload?.rows || [];
  const regionOptions = ["All regions", ...new Set(rows.map(row => row.region).filter(Boolean))];
  const segmentOptions = ["All segments", ...new Set(rows.map(row => row.segment).filter(Boolean))];
  const statusOptions = ["All statuses", ...new Set(rows.map(row => row.status).filter(Boolean))];

  const filteredRows = useMemo(() => {
    return rows.filter(row =>
      (params.region === "All regions" || row.region === params.region) &&
      (params.segment === "All segments" || row.segment === params.segment) &&
      (params.status === "All statuses" || row.status === params.status)
    );
  }, [rows, params.region, params.segment, params.status]);

  const pages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const total = filteredRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const hasRows = rows.length > 0;

  function updateParam(key, value) {
    setParams(current => ({ ...current, [key]: value }));
    setPage(1);
  }

  function exportExcel() {
    const exportRows = [["Report", definition.name], ["Region", params.region], ["Period", params.period], [], ["Account", "Region", "Segment", "Service", "Amount", "Metric", "Status"], ...filteredRows.map(row => [row.account, row.region, row.segment, row.service, row.amount, row.metric, row.status])];
    downloadBlob(makeXlsx(exportRows), `${params.reportId}-${params.period.toLowerCase().replaceAll(" ", "-")}.xlsx`);
    showToast?.("Excel report exported");
  }

  function exportCsv() {
    const exportRows = [["Account", "Region", "Segment", "Service", "Amount", "Metric", "Status"], ...filteredRows.map(row => [row.account, row.region, row.segment, row.service, row.amount, row.metric, row.status])];
    downloadBlob(csvBlob(exportRows), `${params.reportId}-${params.period.toLowerCase().replaceAll(" ", "-")}.csv`);
    showToast?.("CSV report exported");
  }

  function refreshReport() {
    setLoadingReport(true);
    setError("");
    fetchPlatformReport(params.reportId)
      .then(payload => {
        setReportPayload(payload);
        const nextRunStamp = new Date().toISOString();
        setRunStamp(nextRunStamp);
        writeSessionCache(REPORTS_CACHE_KEY, {
          definitions,
          reportPayload: payload,
          runStamp: nextRunStamp
        });
        showToast?.("Report refreshed");
      })
      .catch(err => {
        setError(err.message || "Unable to refresh report.");
      })
      .finally(() => setLoadingReport(false));
  }

  return (
    <>
      <PageHeader className="compact-page-header" title="Reports" description="API-backed operational reports, result sets, and exports." />
      <section className="report-studio reports-compact">
        <aside className="report-catalog">
          <div className="report-catalog-header"><strong>Report catalog</strong></div>
          {loadingDefinitions && !definitions.length && <div className="empty-state">Loading report definitions…</div>}
          {definitions.map(report => (
            <button className={report.id === params.reportId ? "report-item active" : "report-item"} type="button" key={report.id} onClick={() => updateParam("reportId", report.id)}>
              <strong>{report.name}</strong>
              <span>{report.area}</span>
            </button>
          ))}
        </aside>
        <main className="report-workbench">
          {loadingDefinitions && definitions.length ? <WarningBanner>Refreshing report definitions…</WarningBanner> : null}
          {loadingReport && hasRows ? <WarningBanner>Refreshing report results…</WarningBanner> : null}
          <div className="parameter-ribbon">
            <label>Region<select value={params.region} onChange={event => updateParam("region", event.target.value)}>{regionOptions.map(value => <option key={value}>{value}</option>)}</select></label>
            <label>Period<select value={params.period} onChange={event => updateParam("period", event.target.value)}>{["May 2026", "April 2026", "Q2 2026 to date", "Rolling 90 days"].map(value => <option key={value}>{value}</option>)}</select></label>
            <label>Segment<select value={params.segment} onChange={event => updateParam("segment", event.target.value)}>{segmentOptions.map(value => <option key={value}>{value}</option>)}</select></label>
            <label>Status<select value={params.status} onChange={event => updateParam("status", event.target.value)}>{statusOptions.map(value => <option key={value}>{value}</option>)}</select></label>
            <button className="button" type="button" onClick={refreshReport}>Run report</button>
          </div>
          {error && <div className="empty-state">{error}</div>}
          {loadingReport && !error && !hasRows && <div className="empty-state">Loading report results…</div>}
          {(!loadingReport || hasRows) && !error && (
            <section className="report-page">
              <div className="report-page-header">
                <div>
                  <h2>{definition.name}</h2>
                  <p>{definition.description}</p>
                  <p className="small-muted">Last run: {formatDateTime(runStamp, { empty: "Not run" })}</p>
                </div>
                <div className="report-page-actions">
                  <div className="module-toolbar report-page-pagination">
                    <button className="ghost-button" disabled={page === 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</button>
                    <button className="ghost-button" disabled={page === pages} onClick={() => setPage(value => Math.min(pages, value + 1))}>Next</button>
                  </div>
                  <div className="module-toolbar report-page-exports">
                    <button className="button" type="button" onClick={exportExcel}>Export Excel</button>
                    <button className="ghost-button" type="button" onClick={exportCsv}>Export CSV</button>
                  </div>
                </div>
              </div>
              <div className="report-summary-strip"><div className="report-summary-card"><span>Total exposure</span><strong>{formatMoney(total)}</strong></div><div className="report-summary-card"><span>Rows</span><strong>{filteredRows.length}</strong></div><div className="report-summary-card"><span>Page</span><strong>{page} of {pages}</strong></div><div className="report-summary-card"><span>Area</span><strong>{definition.area}</strong></div></div>
              <Panel title="Result set" description="Current report results returned by the platform API.">
                <DataTable emptyMessage="No rows match the current parameters." columns={[{ key: "account", label: "Account" }, { key: "region", label: "Region" }, { key: "segment", label: "Segment" }, { key: "service", label: "Service" }, { key: "amount", label: "Amount", render: row => formatMoney(row.amount || 0) }, { key: "metric", label: "Metric" }, { key: "status", label: "Status", render: row => <StatusTag tone={statusTone(row.status, { success: ["Growth"] })}>{row.status}</StatusTag> }]} rows={visibleRows} />
              </Panel>
            </section>
          )}
        </main>
      </section>
    </>
  );
}
