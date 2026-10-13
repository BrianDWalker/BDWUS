import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/Shell";
import { Icon } from "../../components/Icons";
import { DataTable, MetricCard, Panel, StatusTag, formatMoney, statusTone } from "../../components/Primitives";
import { createCustomerServiceTicket, fetchCustomerServiceOverview } from "../../utils/platformApi";
import { arrayField, normalizeNetworkEvent, normalizeTicket } from "../../utils/payloadMapping";

function contains(row, query, keys) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return true;
  return keys.some(key => String(row[key] || "").toLowerCase().includes(needle));
}

function normalizeSummary(summary = {}, tickets = []) {
  const networkTicketCount = summary.networkTicketCount ?? summary.NetworkTicketCount ?? tickets.filter(row => row.Category === "Network").length;
  const billingTicketCount = summary.billingTicketCount ?? summary.BillingTicketCount ?? tickets.filter(row => row.Category === "Billing").length;
  const openTicketCount = summary.openTicketCount ?? summary.OpenTicketCount ?? tickets.filter(row => row.Status !== "Closed").length;
  const averageAgeHours = summary.averageAgeHours ?? summary.AverageAgeHours ?? Math.round(tickets.reduce((sum, row) => sum + Number(row.AgeHours || 0), 0) / Math.max(tickets.length, 1));
  return { openTicketCount, networkTicketCount, billingTicketCount, averageAgeHours };
}

export default function CustomerServiceModule({ setRoute, showToast }) {
  const [data, setData] = useState({ tickets: [], customerReportedOutages: [], summary: {} });
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadCustomerService() {
    setLoading(true);
    setError("");
    try {
      const overview = await fetchCustomerServiceOverview();
      const tickets = arrayField(overview, "tickets", "Tickets").map(normalizeTicket);
      const customerReportedOutages = arrayField(overview, "customerReportedOutages", "CustomerReportedOutages", "networkEvents", "NetworkEvents").map(normalizeNetworkEvent);
      setData({ tickets, customerReportedOutages, summary: normalizeSummary(overview.summary || overview.Summary, tickets) });
    } catch (err) {
      setError(err.message || "Unable to load customer service data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomerService();
  }, []);

  const visibleTickets = useMemo(() => {
    return (data.tickets || []).filter(ticket => contains(ticket, query, ["TicketNumber", "AccountName", "CustomerNumber", "IssueType", "Category", "Priority", "Status", "OwnerName"]));
  }, [data.tickets, query]);

  async function createTicket() {
    setSaving(true);
    setError("");
    try {
      const ticket = normalizeTicket(await createCustomerServiceTicket({
        accountName: "New Customer",
        issueType: "Customer inquiry",
        category: "Care",
        priority: "Normal",
        status: "Open",
        ownerName: "Care Ops",
        summary: "Customer service ticket created from the portal.",
        createdBy: "Care Ops"
      }));
      setData(current => ({ ...current, tickets: [ticket, ...current.tickets], summary: normalizeSummary({ ...current.summary, openTicketCount: Number(current.summary.openTicketCount || 0) + 1 }, [ticket, ...current.tickets]) }));
      showToast?.(`Ticket ${ticket.TicketNumber || "created"} saved`);
      if (ticket.TicketId) setRoute?.(`details/ticket/${ticket.TicketId}`);
    } catch (err) {
      setError(err.message || "Unable to create ticket.");
    } finally {
      setSaving(false);
    }
  }

  const summary = data.summary || {};

  return (
    <>
      <PageHeader
        title="Customer Service"
        description="API-backed support tickets, customer-reported network issues, billing inquiries, and care queue triage."
        actions={<div className="module-toolbar"><button className="button" type="button" disabled={saving} onClick={createTicket}>{saving ? "Creating..." : "Create ticket"}</button></div>}
      />
      {loading ? <div className="empty-state">Loading customer service queue...</div> : (
        <>
          <section className="overview-grid">
            <MetricCard label="Open tickets" value={summary.openTicketCount ?? data.tickets.length} delta="Network, billing, orders, and care" />
            <MetricCard label="Network reported" value={summary.networkTicketCount ?? 0} delta="Customer-reported cases" />
            <MetricCard label="Billing inquiries" value={summary.billingTicketCount ?? 0} delta="Invoice and usage questions" />
            <MetricCard label="Avg age" value={`${summary.averageAgeHours ?? 0}h`} delta="Current support queue" />
          </section>
          <section className="care-layout">
            <Panel title="Support tickets" description="Search by ticket, customer, issue, owner, priority, or category." action={<label className="inline-search"><Icon name="search" className="button-icon" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search support tickets" /></label>}>
              {visibleTickets.length ? <DataTable columns={[
                { key: "TicketNumber", label: "Ticket" },
                { key: "AccountName", label: "Customer" },
                { key: "IssueType", label: "Issue" },
                { key: "Category", label: "Category" },
                { key: "AgeHours", label: "Age", render: row => `${row.AgeHours || 0}h` },
                { key: "Priority", label: "Priority", render: row => <StatusTag tone={statusTone(row.Priority, { warn: ["Major"] })}>{row.Priority}</StatusTag> },
                { key: "Status", label: "Status", render: row => <StatusTag tone={statusTone(row.Status)}>{row.Status}</StatusTag> },
                { key: "OwnerName", label: "Owner" },
                { key: "actions", label: "", render: row => <button className="link-button compact-action" type="button" onClick={() => setRoute?.(`details/ticket/${row.TicketId || row.TicketNumber}`)}>Details</button> }
              ]} rows={visibleTickets} /> : null}
            </Panel>
            <Panel title="Customer-reported network issues" description="Care cases connected to operational impact and SLA exposure.">
              {data.customerReportedOutages?.length ? <div className="outage-map">
                {data.customerReportedOutages.map(event => <button className="outage-card enhanced" type="button" key={event.EventId || event.EventNumber} onClick={() => setRoute?.(`details/network/${event.EventId || event.EventNumber}`)}><Icon name="network" className="button-icon" /><div><strong>{event.Market || "Market"}</strong><span>{event.Type} · {event.Impacted || event.AccountName} · {formatMoney(event.SlaExposure || 0)}</span></div><StatusTag tone={statusTone(event.Severity, { warn: ["Major", "Critical"] })}>{event.Severity || "Open"}</StatusTag></button>)}
              </div> : null}
            </Panel>
          </section>
        </>
      )}
    </>
  );
}
