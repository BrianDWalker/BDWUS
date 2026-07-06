import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/Shell";
import { DataTable, MetricCard, Panel, StatusTag, WarningBanner, formatMoney } from "../../components/Primitives";
import { fetchCustomer360 } from "../../utils/platformApi";
import { getBillingCustomer, listBillingCustomers } from "../../utils/salesApi";
import { arrayField, normalizeCustomer } from "../../utils/payloadMapping";
import { DetailHeader, DetailSummary, DetailTabs, EmptyState } from "./DetailShell";

function pickCustomerNumber(row) {
  return row?.CustomerNumber || row?.customerNumber || row?.id || "";
}

function normalizeLocation(row = {}) {
  return {
    ...row,
    ServiceLocationId: row.ServiceLocationId || row.serviceLocationId || row.id,
    LocationName: row.LocationName || row.locationName || row.name,
    AddressLine1: row.AddressLine1 || row.addressLine1 || row.address,
    City: row.City || row.city,
    StateProvince: row.StateProvince || row.stateProvince || row.state,
    ServiceabilityType: row.ServiceabilityType || row.serviceabilityType || row.serviceability,
    Status: row.Status || row.status
  };
}

function normalizeCommercial(row = {}, type) {
  return {
    ...row,
    id: row.id || row.AccountId || row.accountId || row.OpportunityId || row.opportunityId || row.QuoteId || row.quoteId || row.ContractId || row.contractId,
    type,
    name: row.AccountName || row.accountName || row.AccountNameResolved || row.accountNameResolved || row.OpportunityName || row.opportunityName || row.QuoteNumber || row.quoteNumber || row.ContractNumber || row.contractNumber,
    status: row.Status || row.status || row.ApprovalStatus || row.approvalStatus,
    amount: Number(row.EstimatedValue ?? row.estimatedValue ?? row.TotalMrc ?? row.totalMrc ?? row.ContractValue ?? row.contractValue ?? 0)
  };
}

function statusTone(status) {
  return ["Active", "Ready", "Connected", "Approved"].includes(status) ? "success" : ["Pending", "Review", "Blocked", "At Risk"].includes(status) ? "warn" : "blue";
}

export default function CustomerAccountDetailModule({ id, setRoute, showToast }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [customer360, setCustomer360] = useState(null);
  const [directory, setDirectory] = useState([]);
  const [tab, setTab] = useState("Overview");

  async function loadDetail() {
    setLoading(true);
    setError("");
    setWarnings([]);
    const [customerResult, billingResult, directoryResult] = await Promise.allSettled([
      fetchCustomer360(id),
      getBillingCustomer(id),
      listBillingCustomers()
    ]);

    const customer360Payload = customerResult.status === "fulfilled" ? customerResult.value || {} : null;
    const billingPayload = billingResult.status === "fulfilled" ? billingResult.value || {} : null;
    const directoryRows = directoryResult.status === "fulfilled" ? (directoryResult.value || []).map(normalizeCustomer) : [];
    const selected = normalizeCustomer(
      customer360Payload?.customer ||
      customer360Payload?.Customer ||
      billingPayload ||
      directoryRows.find(row => pickCustomerNumber(row) === id) ||
      { CustomerNumber: id, CustomerName: id, Status: "Active" }
    );

    setCustomer360(customer360Payload);
    setDirectory(directoryRows);
    setCustomer(selected);

    const failed = [
      customerResult.status === "rejected" ? "customer 360 profile" : "",
      billingResult.status === "rejected" ? "billing customer profile" : "",
      directoryResult.status === "rejected" ? "billing customer list" : ""
    ].filter(Boolean);

    if (failed.length && (customer360Payload || billingPayload || directoryRows.length)) {
      setWarnings([]);
    } else if (failed.length) {
      setError(customerResult.reason?.message || billingResult.reason?.message || directoryResult.reason?.message || "Unable to load customer detail.");
    }

    setLoading(false);
  }

  useEffect(() => {
    loadDetail().catch(err => {
      setError(err.message || "Unable to load customer detail.");
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const locations = useMemo(() => arrayField(customer360, "serviceLocations", "ServiceLocations", "locations").map(normalizeLocation), [customer360]);
  const accounts = useMemo(() => arrayField(customer360, "accounts", "Accounts").map(row => normalizeCommercial(row, "Account")), [customer360]);
  const opportunities = useMemo(() => arrayField(customer360, "opportunities", "Opportunities").map(row => normalizeCommercial(row, "Opportunity")), [customer360]);
  const quotes = useMemo(() => arrayField(customer360, "quotes", "Quotes").map(row => normalizeCommercial(row, "Quote")), [customer360]);
  const contracts = useMemo(() => arrayField(customer360, "contracts", "Contracts").map(row => normalizeCommercial(row, "Contract")), [customer360]);
  const activityRows = useMemo(() => arrayField(customer360, "activity", "Activity", "timeline", "Timeline").map((row, index) => ({
    id: row.id || index,
    when: row.when || row.date || row.timestamp || "Recent",
    event: row.event || row.title || row.type || "Activity",
    detail: row.detail || row.body || row.note || row.description || "Customer interaction",
    status: row.status || row.State || "Open"
  })), [customer360]);

  const selectedCustomer = customer || {};
  const customerName = selectedCustomer.CustomerName || selectedCustomer.name || id;
  const customerStatus = selectedCustomer.Status || "Active";
  const billingProfile = selectedCustomer.BillingProfile || "Billing profile unavailable";
  const segment = selectedCustomer.Segment || selectedCustomer.CustomerType || "Customer";

  const tabs = ["Overview", "Accounts", "Locations", "Opportunities", "Quotes", "Contracts", "Activity"];

  return (
    <>
      <PageHeader title="Customer 360" description="Dedicated customer and account detail workspace." actions={<div className="button-cluster"><button className="ghost-button" type="button" onClick={() => setRoute?.("customer-360")}>Back to Customer 360</button></div>} />
      {warnings.map(warning => <WarningBanner key={warning}>{warning}</WarningBanner>)}
      {error && <EmptyState>{error}</EmptyState>}
      {loading ? <EmptyState>Loading customer detail...</EmptyState> : (
        <>
          <DetailHeader
            breadcrumb={["Customer 360", "Accounts", customerName]}
            title={customerName}
            status={customerStatus}
            subtitle={`${selectedCustomer.CustomerNumber || id} · ${segment} · ${selectedCustomer.Region || "Region unavailable"}`}
            actions={<div className="button-cluster"><button className="button" type="button" onClick={() => setRoute?.("billing")}>Open Billing</button><button className="ghost-button" type="button" onClick={() => showToast?.("Customer detail refreshed")}>Snapshot</button></div>}
          />
          <DetailSummary items={[
            { label: "MRR", value: formatMoney(selectedCustomer.Mrr || 0), note: "Recurring revenue" },
            { label: "Credit", value: selectedCustomer.CreditRating || "-", note: "Credit profile" },
            { label: "Locations", value: locations.length, note: "Service footprint" },
            { label: "Accounts", value: accounts.length, note: "Linked accounts" },
            { label: "Quotes", value: quotes.length, note: "Commercial activity" },
            { label: "Contracts", value: contracts.length, note: "Active agreements" }
          ]} />
          <DetailTabs tabs={tabs} active={tab} onChange={setTab} />
          {tab === "Overview" && (
            <section className="record-main-layout">
              <Panel title="Account profile" description={billingProfile}>
                <div className="field-grid compact-fields">
                  <MetricCard label="Customer Number" value={selectedCustomer.CustomerNumber || id} delta={statusTone(customerStatus)} />
                  <MetricCard label="Primary Contact" value={selectedCustomer.PrimaryContact || "N/A"} delta="Contact" />
                  <MetricCard label="Support Tier" value={selectedCustomer.SupportTier || "N/A"} delta="Service level" />
                  <MetricCard label="Account Manager" value={selectedCustomer.AccountManager || "N/A"} delta="Owner" />
                </div>
              </Panel>
              <Panel title="Current state" description="Rollup of account and service health.">
                <div className="field-grid compact-fields">
                  <MetricCard label="Status" value={customerStatus} delta="Account status" />
                  <MetricCard label="Region" value={selectedCustomer.Region || "N/A"} delta="Market" />
                  <MetricCard label="Segment" value={segment} delta="Customer type" />
                  <MetricCard label="Billing profile" value={billingProfile} delta="Ledger setup" />
                </div>
              </Panel>
            </section>
          )}
          {tab === "Accounts" && (
            <Panel title="Accounts" description="Account records linked to this customer.">
              {accounts.length ? <DataTable columns={[{ key: "name", label: "Account" }, { key: "status", label: "Status", render: row => <StatusTag tone={statusTone(row.status)}>{row.status || "-"}</StatusTag> }, { key: "amount", label: "Amount", render: row => formatMoney(row.amount || 0) }]} rows={accounts} /> : null}
            </Panel>
          )}
          {tab === "Locations" && (
            <Panel title="Locations" description="Service locations and serviceability.">
              {locations.length ? <DataTable columns={[{ key: "LocationName", label: "Location" }, { key: "AddressLine1", label: "Address" }, { key: "City", label: "City" }, { key: "StateProvince", label: "State" }, { key: "ServiceabilityType", label: "Serviceability" }, { key: "Status", label: "Status", render: row => <StatusTag tone={statusTone(row.Status)}>{row.Status || "-"}</StatusTag> }]} rows={locations} /> : null}
            </Panel>
          )}
          {tab === "Opportunities" && (
            <Panel title="Opportunities" description="Commercial pipeline tied to this customer.">
              {opportunities.length ? <DataTable columns={[{ key: "name", label: "Opportunity" }, { key: "status", label: "Status", render: row => <StatusTag tone={statusTone(row.status)}>{row.status || "-"}</StatusTag> }, { key: "amount", label: "Value", render: row => formatMoney(row.amount || 0) }]} rows={opportunities} /> : null}
            </Panel>
          )}
          {tab === "Quotes" && (
            <Panel title="Quotes" description="Quote records associated with this customer.">
              {quotes.length ? <DataTable columns={[{ key: "name", label: "Quote" }, { key: "status", label: "Status", render: row => <StatusTag tone={statusTone(row.status)}>{row.status || "-"}</StatusTag> }, { key: "amount", label: "Value", render: row => formatMoney(row.amount || 0) }]} rows={quotes} /> : null}
            </Panel>
          )}
          {tab === "Contracts" && (
            <Panel title="Contracts" description="Agreement records associated with this customer.">
              {contracts.length ? <DataTable columns={[{ key: "name", label: "Contract" }, { key: "status", label: "Status", render: row => <StatusTag tone={statusTone(row.status)}>{row.status || "-"}</StatusTag> }, { key: "amount", label: "Value", render: row => formatMoney(row.amount || 0) }]} rows={contracts} /> : null}
            </Panel>
          )}
          {tab === "Activity" && (
            <Panel title="Activity" description="Timeline entries and customer interactions.">
              {activityRows.length ? <DataTable columns={[{ key: "when", label: "When" }, { key: "event", label: "Event" }, { key: "detail", label: "Detail" }, { key: "status", label: "Status", render: row => <StatusTag tone={statusTone(row.status)}>{row.status || "-"}</StatusTag> }]} rows={activityRows} /> : null}
            </Panel>
          )}
        </>
      )}
    </>
  );
}
