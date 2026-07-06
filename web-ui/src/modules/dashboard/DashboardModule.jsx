import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/Shell";
import { DataTable, MetricCard, Panel, StatusTag, WarningBanner, formatMoney, statusTone } from "../../components/Primitives";
import { fetchCustomerServiceOverview, fetchPlatformBootstrap } from "../../utils/platformApi";
import { fetchOpsBootstrap } from "../../utils/opsApi";
import { arrayField, normalizeNetworkEvent, normalizeOrder, normalizeTicket } from "../../utils/payloadMapping";
import { readSessionCache, writeSessionCache } from "../../utils/sessionCache";

const DASHBOARD_CACHE_KEY = "bdwus.dashboard.v1";

function numberValue(row = {}, ...keys) {
  const value = keys.map(key => row?.[key]).find(item => item !== undefined && item !== null && item !== "");
  return Number(value || 0);
}

function normalizeCareSummary(summary = {}, tickets = []) {
  return {
    openTicketCount: numberValue(summary, "openTicketCount", "OpenTicketCount") || tickets.filter(row => row.Status !== "Closed").length,
    escalatedTicketCount: numberValue(summary, "escalatedTicketCount", "EscalatedTicketCount") || tickets.filter(row => row.Status === "Escalated" || String(row.EscalationLevel || "").toLowerCase().includes("tier 2")).length,
    networkTicketCount: numberValue(summary, "networkTicketCount", "NetworkTicketCount"),
    billingTicketCount: numberValue(summary, "billingTicketCount", "BillingTicketCount")
  };
}

export default function DashboardModule({ setRoute }) {
  const cached = readSessionCache(DASHBOARD_CACHE_KEY, null);
  const [platform, setPlatform] = useState(cached?.platform || {});
  const [care, setCare] = useState(cached?.care || { tickets: [], summary: {} });
  const [ops, setOps] = useState(cached?.ops || { orders: [], networkEvents: [], provisioningJobs: [], settlements: [] });
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      const [platformResult, careResult, opsResult] = await Promise.allSettled([
        fetchPlatformBootstrap(),
        fetchCustomerServiceOverview(),
        fetchOpsBootstrap()
      ]);
      const platformPayload = platformResult.status === "fulfilled" ? platformResult.value : {};
      const carePayload = careResult.status === "fulfilled" ? careResult.value : {};
      const opsPayload = opsResult.status === "fulfilled" ? opsResult.value : {};
      const tickets = arrayField(carePayload, "tickets", "Tickets").map(normalizeTicket);
      const failedLoads = [platformResult, careResult, opsResult].filter(result => result.status === "rejected");
      setPlatform(platformPayload || {});
      setCare({ tickets, summary: normalizeCareSummary(carePayload?.summary || carePayload?.Summary, tickets) });
      setOps({
        orders: arrayField(opsPayload, "orders", "Orders").map(normalizeOrder),
        networkEvents: arrayField(opsPayload, "networkEvents", "NetworkEvents", "events").map(normalizeNetworkEvent),
        provisioningJobs: arrayField(opsPayload, "provisioningJobs", "ProvisioningJobs", "jobs"),
        settlements: arrayField(opsPayload, "settlements", "carrierSettlements", "CarrierSettlements")
      });
      writeSessionCache(DASHBOARD_CACHE_KEY, {
        platform: platformPayload || {},
        care: { tickets, summary: normalizeCareSummary(carePayload?.summary || carePayload?.Summary, tickets) },
        ops: {
          orders: arrayField(opsPayload, "orders", "Orders").map(normalizeOrder),
          networkEvents: arrayField(opsPayload, "networkEvents", "NetworkEvents", "events").map(normalizeNetworkEvent),
          provisioningJobs: arrayField(opsPayload, "provisioningJobs", "ProvisioningJobs", "jobs"),
          settlements: arrayField(opsPayload, "settlements", "carrierSettlements", "CarrierSettlements")
        }
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

  const dashboard = platform.dashboard || platform.Dashboard || {};
  const customers = arrayField(platform, "customers", "Customers");
  const quotes = arrayField(platform, "quotes", "Quotes");
  const opportunities = arrayField(platform, "opportunities", "Opportunities");
  const approvals = arrayField(platform, "approvals", "Approvals");
  const openOrders = useMemo(() => ops.orders.filter(row => !["Completed", "Cancelled"].includes(row.OverallStatus)), [ops.orders]);
  const atRiskOrders = useMemo(() => ops.orders.filter(row => row.SlaStatus && row.SlaStatus !== "On Track"), [ops.orders]);
  const openTickets = useMemo(() => care.tickets.filter(row => row.Status !== "Closed"), [care.tickets]);
  const escalatedTickets = useMemo(() => care.tickets.filter(row => row.Status === "Escalated" || String(row.EscalationLevel || "").toLowerCase().includes("tier 2")), [care.tickets]);
  const hasData = customers.length || quotes.length || opportunities.length || ops.orders.length || care.tickets.length;

  return (
    <>
      <PageHeader
        title="Home"
        description="Modern API-backed operating dashboard for sales, care, orders, billing, network, and platform work."
        actions={<div className="module-toolbar"><button className="button" type="button" onClick={() => setRoute?.("reports")}>Open Reports</button></div>}
      />
      {loading && !hasData ? <div className="empty-state">Loading operating dashboard...</div> : (
        <>
          <section className="overview-grid">
            <MetricCard label="Pipeline" value={formatMoney(numberValue(dashboard, "PipelineValue", "pipelineValue"))} delta={`${numberValue(dashboard, "OpportunityCount", "opportunityCount") || opportunities.length} opportunities`} />
            <MetricCard label="Quote MRC" value={formatMoney(numberValue(dashboard, "QuoteMrcValue", "quoteMrcValue"))} delta={`${numberValue(dashboard, "QuoteCount", "quoteCount") || quotes.length} quotes`} />
            <MetricCard label="Open Orders" value={openOrders.length} delta={`${atRiskOrders.length} at risk`} tone={atRiskOrders.length ? "warn" : ""} />
            <MetricCard label="Open Tickets" value={care.summary.openTicketCount ?? openTickets.length} delta={`${care.summary.escalatedTicketCount ?? escalatedTickets.length} escalated`} tone={(care.summary.escalatedTicketCount ?? escalatedTickets.length) ? "warn" : ""} />
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
            <Panel title="Customer Watchlist" description="Top customer records.">
              {customers.length ? <DataTable columns={[
                { key: "CustomerNumber", label: "Customer #" },
                { key: "CustomerName", label: "Customer" },
                { key: "Region", label: "Region" },
                { key: "Status", label: "Status", render: row => <StatusTag tone={statusTone(row.Status)}>{row.Status || "Unknown"}</StatusTag> },
                { key: "Mrr", label: "MRR", render: row => formatMoney(row.Mrr || row.mrr || 0) }
              ]} rows={customers.slice(0, 6)} /> : null}
            </Panel>
          </section>
          <section className="record-main-layout">
            <Panel title="Care Queue" description="Open and escalated tickets from Customer Service.">
              {care.tickets.length ? <DataTable columns={[
                { key: "TicketNumber", label: "Ticket" },
                { key: "AccountName", label: "Customer" },
                { key: "IssueType", label: "Issue" },
                { key: "Priority", label: "Priority", render: row => <StatusTag tone={statusTone(row.Priority)}>{row.Priority || "Normal"}</StatusTag> },
                { key: "Status", label: "Status", render: row => <StatusTag tone={statusTone(row.Status)}>{row.Status || "Open"}</StatusTag> }
              ]} rows={care.tickets.slice(0, 6)} /> : null}
            </Panel>
            <Panel title="Orders & Network" description="Operational records that may need attention today.">
              {ops.orders.length ? <DataTable columns={[
                { key: "OrderNumber", label: "Order" },
                { key: "AccountName", label: "Customer" },
                { key: "LifecycleStage", label: "Stage" },
                { key: "OverallStatus", label: "Status", render: row => <StatusTag tone={statusTone(row.OverallStatus)}>{row.OverallStatus || "Draft"}</StatusTag> },
                { key: "SlaStatus", label: "SLA", render: row => <StatusTag tone={statusTone(row.SlaStatus)}>{row.SlaStatus || "Unknown"}</StatusTag> }
              ]} rows={ops.orders.slice(0, 6)} /> : null}
            </Panel>
          </section>
        </>
      )}
    </>
  );
}
