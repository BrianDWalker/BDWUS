import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/Shell";
import { DataTable, MetricCard, Panel, StatusTag, WarningBanner, formatMoney } from "../../components/Primitives";
import { fetchCustomer360, fetchPlatformBootstrap } from "../../utils/platformApi";
import { getBillingCustomer, listBillingCustomers } from "../../utils/salesApi";
import { arrayField, normalizeCustomer } from "../../utils/payloadMapping";

function pickCustomerNumber(row) {
  return row?.CustomerNumber || row?.customerNumber || row?.id;
}

function normalizeCommercial(row = {}, type) {
  return {
    id: row.AccountId || row.accountId || row.OpportunityId || row.opportunityId || row.QuoteId || row.quoteId || row.ContractId || row.contractId || row.id,
    type,
    name: row.AccountName || row.accountName || row.AccountNameResolved || row.accountNameResolved || row.OpportunityName || row.opportunityName || row.QuoteNumber || row.quoteNumber || row.ContractNumber || row.contractNumber || row.Title || row.title,
    status: row.Status || row.status || row.ApprovalStatus || row.approvalStatus,
    amount: row.EstimatedValue ?? row.estimatedValue ?? row.TotalMrc ?? row.totalMrc ?? row.ContractValue ?? row.contractValue
  };
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

export default function Customer360Module({ setRoute, showToast }) {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [customerProfile, setCustomerProfile] = useState(null);
  const [customer360, setCustomer360] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setWarnings([]);

    async function loadCustomerOptions() {
      const platformResult = await fetchPlatformBootstrap()
        .then(payload => ({ status: "fulfilled", value: arrayField(payload, "customers", "Customers") }))
        .catch(err => ({ status: "rejected", reason: err }));

      if (active && platformResult.status === "fulfilled" && platformResult.value.length) {
        const normalized = platformResult.value.map(normalizeCustomer);
        setCustomers(normalized);
        setSelectedCustomer(current => current || pickCustomerNumber(normalized[0]) || "");
        setLoading(false);
      }

      const billingResult = await listBillingCustomers()
        .then(rows => ({ status: "fulfilled", value: rows || [] }))
        .catch(err => ({ status: "rejected", reason: err }));

      if (!active) return;

      if (billingResult.status === "fulfilled" && billingResult.value.length) {
        const normalized = billingResult.value.map(normalizeCustomer);
        setCustomers(normalized);
        setSelectedCustomer(current => current || pickCustomerNumber(normalized[0]) || "");
        setLoading(false);
      } else if (platformResult.status === "fulfilled" && platformResult.value.length) {
        setWarnings([`Billing customer list is unavailable; showing ${platformResult.value.length} platform bootstrap customer record${platformResult.value.length === 1 ? "" : "s"}.`]);
      } else {
        const message = billingResult.reason?.message || platformResult.reason?.message || "Unable to load customers.";
        setError(message);
        setLoading(false);
      }
    }

    loadCustomerOptions()
      .catch(err => {
        if (!active) return;
        setError(err.message || "Unable to load customers.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedCustomer) return;
    let active = true;
    setLoading(true);
    setError("");
    setWarnings([]);
    Promise.allSettled([fetchCustomer360(selectedCustomer), getBillingCustomer(selectedCustomer)])
      .then(([customerResult, billingResult]) => {
        if (!active) return;
        const customerPayload = customerResult.status === "fulfilled" ? customerResult.value : {};
        const billingPayload = billingResult.status === "fulfilled" ? billingResult.value : customers.find(row => pickCustomerNumber(row) === selectedCustomer) || {};
        setCustomer360(customerPayload || {});
        setCustomerProfile(normalizeCustomer(billingPayload || {}));
        const failedSources = [
          customerResult.status === "rejected" ? "customer 360 profile" : "",
          billingResult.status === "rejected" ? "billing customer profile" : ""
        ].filter(Boolean);
        setWarnings(failedSources.length ? [`${failedSources.join(" and ")} unavailable; showing available customer data.`] : []);
        if (customerResult.status === "rejected" && billingResult.status === "rejected") {
          setError(customerResult.reason?.message || billingResult.reason?.message || "Unable to load customer 360.");
        }
      })
      .catch(err => {
        if (active) setError(err.message || "Unable to load customer 360.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedCustomer, reloadKey]);

  const customer = normalizeCustomer(customer360?.customer || customer360?.Customer || customerProfile || {});
  const opportunities = arrayField(customer360, "opportunities", "Opportunities");
  const quotes = arrayField(customer360, "quotes", "Quotes");
  const contracts = arrayField(customer360, "contracts", "Contracts");
  const locations = arrayField(customer360, "serviceLocations", "ServiceLocations", "locations").map(normalizeLocation);
  const accountRows = arrayField(customer360, "accounts", "Accounts");
  const customerOptions = useMemo(() => customers.map(row => ({ number: pickCustomerNumber(row), name: row.CustomerName || row.customerName || row.name || pickCustomerNumber(row) })).filter(item => item.number), [customers]);
  const commercialRows = [
    ...accountRows.map(row => normalizeCommercial(row, "Account")),
    ...opportunities.map(row => normalizeCommercial(row, "Opportunity")),
    ...quotes.map(row => normalizeCommercial(row, "Quote")),
    ...contracts.map(row => normalizeCommercial(row, "Contract"))
  ];

  return (
    <section className="customer360-compact">
      <PageHeader
        title="Customer 360"
        description="API-backed customer profile, account, location, opportunity, quote, and contract context."
        actions={<div className="button-cluster"><button className="ghost-button" disabled={loading || !selectedCustomer} type="button" onClick={() => setReloadKey(value => value + 1)}>Refresh</button><button className="ghost-button" disabled={!selectedCustomer} type="button" onClick={() => setRoute?.(`details/customer/${selectedCustomer}`)}>Open Detail</button><button className="button" type="button" onClick={() => { setRoute?.("orders"); showToast?.("Opening order workspace"); }}>Create Order</button></div>}
      />
      <div className="module-toolbar">
        <label className="inline-search">Customer<select value={selectedCustomer} onChange={event => setSelectedCustomer(event.target.value)}>{customerOptions.map(item => <option key={item.number} value={item.number}>{item.name}</option>)}</select></label>
      </div>
      {warnings.map(warning => <WarningBanner key={warning}>{warning}</WarningBanner>)}
      {error && <div className="empty-state">{error}</div>}
      {loading ? <div className="empty-state">Loading customer data...</div> : !customerOptions.length ? <div className="empty-state">No customers returned by the billing API.</div> : (
        <>
          <section className="overview-grid">
            <MetricCard label="MRR" value={formatMoney(customer.Mrr || 0)} delta={customer.Segment || "Segment"} />
            <MetricCard label="Credit" value={customer.CreditRating || "-"} delta="Credit rating" />
            <MetricCard label="Locations" value={locations.length} delta="Service footprint" />
            <MetricCard label="Open quotes" value={quotes.length} delta="Commercial activity" />
          </section>
          <section className="record-main-layout">
            <Panel title={customer.CustomerName || "Customer"} description={customer.BillingProfile || "Billing profile"}>
              <div className="field-grid">
                <MetricCard label="Customer Number" value={selectedCustomer || "-"} delta={customer.Status || "Status"} />
                <MetricCard label="Industry" value={customer.Industry || "-"} delta={customer.Region || "Region"} />
                <MetricCard label="Support Tier" value={customer.SupportTier || "-"} delta={customer.AccountManager || "Account manager"} />
                <MetricCard label="Primary Contact" value={customer.PrimaryContact || "-"} delta="Contact" />
              </div>
            </Panel>
            <Panel title="Locations" description="Service locations returned by the platform API.">{locations.length ? <DataTable columns={[{ key: "LocationName", label: "Location" }, { key: "AddressLine1", label: "Address" }, { key: "City", label: "City" }, { key: "StateProvince", label: "State" }, { key: "ServiceabilityType", label: "Serviceability" }, { key: "Status", label: "Status", render: row => <StatusTag tone={row.Status === "Active" ? "success" : "blue"}>{row.Status}</StatusTag> }]} rows={locations} /> : <div className="empty-state">No service locations returned for this customer.</div>}</Panel>
          </section>
          <Panel title="Commercial Records" description="Accounts, opportunities, quotes, and contracts tied to the selected customer.">{commercialRows.length ? <DataTable columns={[{ key: "type", label: "Type" }, { key: "name", label: "Name" }, { key: "status", label: "Status" }, { key: "amount", label: "Amount", render: row => row.amount ? formatMoney(row.amount) : "-" }]} rows={commercialRows} /> : <div className="empty-state">No commercial records returned for this customer.</div>}</Panel>
        </>
      )}
    </section>
  );
}
