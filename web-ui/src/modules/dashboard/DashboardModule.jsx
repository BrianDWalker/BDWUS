import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/Shell";
import { DataTable, MetricCard, Panel, StatusTag, formatMoney } from "../../components/Primitives";
import { fetchCustomerServiceOverview, fetchPlatformBootstrap } from "../../utils/platformApi";
import { fetchOpsBootstrap } from "../../utils/opsApi";
import { arrayField, normalizeNetworkEvent, normalizeOrder, normalizeTicket } from "../../utils/payloadMapping";

function statusTone(status) {
  if (["Closed", "Completed", "Active", "Approved", "On Track"].includes(status)) return "success";
  if (["Open", "In Progress", "Escalated", "Pending", "Risk", "Breached", "Blocked"].includes(status)) return "warn";
  return "blue";
}

export default function DashboardModule({ setRoute }) {
  const [platform, setPlatform] = useState({});
  const [care, setCare] = useState({ tickets: [], summary: {} });
  const [ops, setOps] = useState({ orders: [], networkEvents: [], provisioningJobs: [], settlements: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      const [platformPayload, carePayload, opsPayload] = await Promise.all([
        fetchPlatformBootstrap(),
        fetchCustomerServiceOverview(),
        fetchOpsBootstrap()
      ]);
      setPlatform(platformPayload || {});
      setCare({
        tickets: arrayField(carePayload, "tickets", "Tickets").map(normalizeTicket),
        summary: carePayload?.summary || carePayload?.Summary || {}
      });
      setOps({
        orders: arrayField(opsPayload, "orders", "Orders").map(normalizeOrder),
        networkEvents: arrayField(opsPayload, "networkEvents", "NetworkEvents", "events").map(normalizeNetworkEvent),
        provisioningJobs: arrayField(opsPayload, "provisioningJobs", "ProvisioningJobs", "jobs"),
        settlements: arrayField(opsPayload, "settlements", "carrierSettlements", "CarrierSettlements")
      });
    } catch (err) {
      setError(err.message || "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const dashboard = platform.dashboard || {};
  const customers = arrayField(platform, "customers", "Customers");
  const quotes = arrayField(platform, "quotes", "Quotes");
  const opportunities = arrayField(platform, "opportunities", "Opportunities");
  const approvals = arrayField(platform, "approvals", "Approvals");
  const openOrders = useMemo(() => ops.orders.filter(row => !["Completed", "Cancelled"].includes(row.OverallStatus)), [ops.orders]);
  const atRiskOrders = useMemo(() => ops.orders.filter(row => row.SlaStatus && row.SlaStatus !== "On Track"), [ops.orders]);
  const openTickets = useMemo(() => care.tickets.filter(row => row.Status !== "Closed"), [care.tickets]);
  const escalatedTickets = useMemo(() => care.tickets.filter(row => row.Status === "Escalated" || String(row.EscalationLevel || "").toLowerCase().includes("tier 2")), [care.tickets]);

  return (
    <>
      <PageHeader
        title="Home"
        description="Modern API-backed operating dashboard for sales, care, orders, billing, network, and platform work."
        actions={<div className="module-toolbar"><button className="ghost-button" type="button" disabled={loading} onClick={loadDashboard}>Refresh</button><button className="button" type="button" onClick={() => setRoute?.("reports")}>Open Reports</button></div>}
      />
      {error && <div className="empty-state">{error}</div>}
      {loading ? <div className="empty-state">Loading operating dashboard...</div> : (
        <>
          <section className="overview-grid">
            <MetricCard label="Pipeline" value={formatMoney(dashboard.PipelineValue || dashboard.pipelineValue || 0)} delta={`${dashboard.OpportunityCount ?? opportunities.length} opportunities`} />
            <MetricCard label="Quote MRC" value={formatMoney(dashboard.QuoteMrcValue || dashboard.quoteMrcValue || 0)} delta={`${dashboard.QuoteCount ?? quotes.length} quotes`} />
            <MetricCard label="Open Orders" value={openOrders.length} delta={`${atRiskOrders.length} at risk`} tone={atRiskOrders.length ? "warn" : ""} />
            <MetricCard label="Open Tickets" value={care.summary.openTicketCount ?? openTickets.length} delta={`${escalatedTickets.length} escalated`} tone={escalatedTickets.length ? "warn" : ""} />
          </section>
          <section className="record-main-layout">
            <Panel title="Workday Command Center" description="High-priority work across the extracted platform modules.">
              <div className="menu-actions">
                <button className="menu-action" type="button" onClick={() => setRoute?.("sales")}><strong>Sales pipeline</strong><span>{opportunities.length} opportunity records · {approvals.length} approvals</span></button>
                <button className="menu-action" type="button" onClick={() => setRoute?.("customer-service")}><strong>Customer care</strong><span>{openTickets.length} open tickets · {escalatedTickets.length} escalated</span></button>
                <button className="menu-action" type="button" onClick={() => setRoute?.("orders")}><strong>Orders</strong><span>{openOrders.length} active orders · {ops.provisioningJobs.length} provisioning jobs</span></button>
                <button className="menu-action" type="button" onClick={() => setRoute?.("network")}><strong>Network events</strong><span>{ops.networkEvents.length} active network/service records</span></button>
              </div>
            </Panel>
            <Panel title="Customer Watchlist" description="Top customer records returned by the platform bootstrap.">
              {customers.length ? <DataTable columns={[
                { key: "CustomerNumber", label: "Customer #" },
                { key: "CustomerName", label: "Customer" },
                { key: "Region", label: "Region" },
                { key: "Status", label: "Status", render: row => <StatusTag tone={statusTone(row.Status)}>{row.Status}</StatusTag> },
                { key: "Mrr", label: "MRR", render: row => formatMoney(row.Mrr || row.mrr || 0) }
              ]} rows={customers.slice(0, 6)} /> : <div className="empty-state">No customer records returned by platform bootstrap.</div>}
            </Panel>
          </section>
          <section className="record-main-layout">
            <Panel title="Care Queue" description="Open and escalated tickets from Customer Service.">
              {care.tickets.length ? <DataTable columns={[
                { key: "TicketNumber", label: "Ticket" },
                { key: "AccountName", label: "Customer" },
                { key: "IssueType", label: "Issue" },
                { key: "Priority", label: "Priority", render: row => <StatusTag tone={statusTone(row.Priority)}>{row.Priority}</StatusTag> },
                { key: "Status", label: "Status", render: row => <StatusTag tone={statusTone(row.Status)}>{row.Status}</StatusTag> }
              ]} rows={care.tickets.slice(0, 6)} /> : <div className="empty-state">No care tickets returned by Customer Service.</div>}
            </Panel>
            <Panel title="Orders & Network" description="Operational records that may need attention today.">
              {ops.orders.length ? <DataTable columns={[
                { key: "OrderNumber", label: "Order" },
                { key: "AccountName", label: "Customer" },
                { key: "LifecycleStage", label: "Stage" },
                { key: "OverallStatus", label: "Status", render: row => <StatusTag tone={statusTone(row.OverallStatus)}>{row.OverallStatus}</StatusTag> },
                { key: "SlaStatus", label: "SLA", render: row => <StatusTag tone={statusTone(row.SlaStatus)}>{row.SlaStatus}</StatusTag> }
              ]} rows={ops.orders.slice(0, 6)} /> : <div className="empty-state">No orders returned by Operations.</div>}
            </Panel>
          </section>
        </>
      )}
    </>
  );
}
