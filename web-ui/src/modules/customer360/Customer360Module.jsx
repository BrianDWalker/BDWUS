import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/Shell";
import { DataTable, MetricCard, Panel, StatusTag, formatMoney } from "../../components/Primitives";
import { fetchCustomer360 } from "../../utils/platformApi";
import { getBillingCustomer, listBillingCustomers } from "../../utils/salesApi";

function pickCustomerNumber(row) {
  return row?.CustomerNumber || row?.customerNumber || row?.id;
}

export default function Customer360Module({ setRoute, showToast }) {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [customerProfile, setCustomerProfile] = useState(null);
  const [customer360, setCustomer360] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    listBillingCustomers()
      .then(rows => {
        if (!active) return;
        setCustomers(rows || []);
        setSelectedCustomer(pickCustomerNumber(rows?.[0]) || "");
      })
      .catch(err => {
        if (active) setError(err.message || "Unable to load customers.");
      })
      .finally(() => {
        if (active) setLoading(false);
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
    Promise.all([fetchCustomer360(selectedCustomer), getBillingCustomer(selectedCustomer)])
      .then(([customerPayload, billingPayload]) => {
        if (!active) return;
        setCustomer360(customerPayload);
        setCustomerProfile(billingPayload);
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
  }, [selectedCustomer]);

  const customer = customer360?.customer || customerProfile || {};
  const opportunities = customer360?.opportunities || [];
  const quotes = customer360?.quotes || [];
  const contracts = customer360?.contracts || [];
  const locations = customer360?.serviceLocations || [];
  const accountRows = customer360?.accounts || [];
  const customerOptions = useMemo(() => customers.map(row => ({ number: pickCustomerNumber(row), name: row.CustomerName || row.customerName || row.name || pickCustomerNumber(row) })).filter(item => item.number), [customers]);

  return (
    <>
      <PageHeader
        title="Customer 360"
        description="API-backed customer profile, account, location, opportunity, quote, and contract context."
        actions={<button className="button" type="button" onClick={() => { setRoute?.("orders"); showToast?.("Opening order workspace"); }}>Create Order</button>}
      />
      <div className="module-toolbar">
        <label className="inline-search">Customer<select value={selectedCustomer} onChange={event => setSelectedCustomer(event.target.value)}>{customerOptions.map(item => <option key={item.number} value={item.number}>{item.name}</option>)}</select></label>
      </div>
      {error && <div className="empty-state">{error}</div>}
      {loading ? <div className="empty-state">Loading customer data...</div> : (
        <>
          <section className="overview-grid">
            <MetricCard label="MRR" value={formatMoney(customer.Mrr || customer.mrr || 0)} delta={customer.Segment || customer.segment || "Segment"} />
            <MetricCard label="Credit" value={customer.CreditRating || customer.creditRating || "-"} delta="Credit rating" />
            <MetricCard label="Locations" value={locations.length} delta="Service footprint" />
            <MetricCard label="Open quotes" value={quotes.length} delta="Commercial activity" />
          </section>
          <section className="record-main-layout">
            <Panel title={customer.CustomerName || customer.customerName || "Customer"} description={customer.BillingProfile || customer.billingProfile || "Billing profile"}>
              <div className="field-grid">
                <MetricCard label="Customer Number" value={selectedCustomer || "-"} delta={customer.Status || "Status"} />
                <MetricCard label="Industry" value={customer.Industry || "-"} delta={customer.Region || "Region"} />
                <MetricCard label="Support Tier" value={customer.SupportTier || "-"} delta={customer.AccountManager || "Account manager"} />
                <MetricCard label="Primary Contact" value={customer.PrimaryContact || "-"} delta="Contact" />
              </div>
            </Panel>
            <Panel title="Locations" description="Service locations returned by the platform API.">
              <DataTable columns={[{ key: "LocationName", label: "Location" }, { key: "AddressLine1", label: "Address" }, { key: "City", label: "City" }, { key: "StateProvince", label: "State" }, { key: "ServiceabilityType", label: "Serviceability" }, { key: "Status", label: "Status", render: row => <StatusTag tone={row.Status === "Active" ? "success" : "blue"}>{row.Status}</StatusTag> }]} rows={locations} />
            </Panel>
          </section>
          <Panel title="Commercial Records" description="Accounts, opportunities, quotes, and contracts tied to the selected customer.">
            <DataTable columns={[{ key: "type", label: "Type" }, { key: "name", label: "Name" }, { key: "status", label: "Status" }, { key: "amount", label: "Amount", render: row => row.amount ? formatMoney(row.amount) : "-" }]} rows={[
              ...accountRows.map(row => ({ id: row.AccountId, type: "Account", name: row.AccountName || row.AccountNameResolved, status: row.Status, amount: row.EstimatedValue })),
              ...opportunities.map(row => ({ id: row.OpportunityId, type: "Opportunity", name: row.OpportunityName, status: row.Status, amount: row.EstimatedValue })),
              ...quotes.map(row => ({ id: row.QuoteId, type: "Quote", name: row.QuoteNumber, status: row.Status || row.ApprovalStatus, amount: row.TotalMrc })),
              ...contracts.map(row => ({ id: row.ContractId, type: "Contract", name: row.ContractNumber || row.Title, status: row.Status, amount: row.ContractValue }))
            ]} />
          </Panel>
        </>
      )}
    </>
  );
}
