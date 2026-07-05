import React, { useEffect, useMemo, useState } from "react";
import { GatedButton } from "../../components/PermissionGate";
import { PageHeader } from "../../components/Shell";
import { DataTable, MetricCard, Panel, StatusTag, formatMoney } from "../../components/Primitives";
import { fetchBillingWorkflowAdjustments, fetchBillingWorkflowInvoice, fetchBillingWorkflowInvoiceActions, fetchBillingWorkflowInvoices } from "../../utils/opsApi";
import { createBillingAdjustment, createInvoiceAction } from "../../utils/opsMutations";
import { listBillingCustomers } from "../../utils/salesApi";
import { normalizeCustomer, normalizeInvoice } from "../../utils/payloadMapping";

function normalizeAction(row = {}) {
  return {
    ...row,
    InvoiceActionId: row.InvoiceActionId || row.invoiceActionId || row.id,
    ActionType: row.ActionType || row.actionType || row.type,
    Status: row.Status || row.status,
    RequestedBy: row.RequestedBy || row.requestedBy,
    Notes: row.Notes || row.notes,
    CreatedAtUtc: row.CreatedAtUtc || row.createdAtUtc || row.createdAt
  };
}

function normalizeAdjustment(row = {}) {
  return {
    ...row,
    AdjustmentId: row.AdjustmentId || row.adjustmentId || row.id,
    AdjustmentNumber: row.AdjustmentNumber || row.adjustmentNumber || row.number,
    AdjustmentType: row.AdjustmentType || row.adjustmentType || row.type,
    Amount: Number(row.Amount ?? row.amount ?? 0),
    Status: row.Status || row.status,
    Reason: row.Reason || row.reason
  };
}

export default function BillingModule({ setRoute, showToast }) {
  const [tab, setTab] = useState("Invoices");
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [actions, setActions] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState("");
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingActions, setLoadingActions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadBilling() {
    setLoading(true);
    setError("");
    try {
      const [customerRows, invoiceRows, adjustmentRows] = await Promise.all([
        listBillingCustomers(),
        fetchBillingWorkflowInvoices(),
        fetchBillingWorkflowAdjustments()
      ]);
      const normalizedInvoices = (invoiceRows || []).map(normalizeInvoice);
      setCustomers((customerRows || []).map(normalizeCustomer));
      setInvoices(normalizedInvoices);
      setAdjustments((adjustmentRows || []).map(normalizeAdjustment));
      setSelectedInvoice(current => current || normalizedInvoices?.[0]?.InvoiceId || "");
    } catch (err) {
      setError(err.message || "Unable to load billing workflows.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBilling();
  }, []);

  useEffect(() => {
    if (!selectedInvoice) {
      setActions([]);
      setSelectedInvoiceDetail(null);
      return;
    }
    let active = true;
    setLoadingActions(true);
    Promise.all([
      fetchBillingWorkflowInvoice(selectedInvoice),
      fetchBillingWorkflowInvoiceActions(selectedInvoice)
    ])
      .then(([invoiceDetail, actionRows]) => {
        if (!active) return;
        setSelectedInvoiceDetail(normalizeInvoice(invoiceDetail));
        setActions((actionRows || []).map(normalizeAction));
      })
      .catch(err => {
        if (active) setError(err.message || "Unable to load invoice actions.");
      })
      .finally(() => {
        if (active) setLoadingActions(false);
      });
    return () => {
      active = false;
    };
  }, [selectedInvoice]);

  async function createSampleAction() {
    if (!selectedInvoice) return;
    setSaving(true);
    try {
      await createInvoiceAction(selectedInvoice, { actionType: "Review", status: "Open", requestedBy: "Billing Ops", notes: "Created from billing module" });
      setActions((await fetchBillingWorkflowInvoiceActions(selectedInvoice) || []).map(normalizeAction));
      showToast?.("Invoice action created");
    } catch (err) {
      setError(err.message || "Unable to create invoice action.");
    } finally {
      setSaving(false);
    }
  }

  async function createSampleAdjustment() {
    setSaving(true);
    try {
      await createBillingAdjustment({ invoiceId: selectedInvoice || null, adjustmentType: "Credit", amount: -100, status: "Pending", reason: "Created from billing module", createdBy: "Billing Ops" });
      setAdjustments((await fetchBillingWorkflowAdjustments() || []).map(normalizeAdjustment));
      showToast?.("Adjustment created");
    } catch (err) {
      setError(err.message || "Unable to create adjustment.");
    } finally {
      setSaving(false);
    }
  }

  const totalBalance = invoices.reduce((sum, row) => sum + Number(row.Balance || 0), 0);
  const selectedCustomerName = useMemo(() => invoices.find(row => row.InvoiceId === selectedInvoice)?.AccountName || selectedInvoiceDetail?.AccountName || "No invoice selected", [invoices, selectedInvoice, selectedInvoiceDetail]);

  return (
    <>
      <PageHeader title="Billing" description="API-backed invoices, workflow actions, adjustments, and billing customers." />
      {error && <div className="empty-state">{error}</div>}
      {loading ? <div className="empty-state">Loading billing workflows...</div> : (
        <>
          <section className="overview-grid">
            <MetricCard label="Customers" value={customers.length} delta="Billing accounts" />
            <MetricCard label="Invoices" value={invoices.length} delta="Workflow rows" />
            <MetricCard label="Open Balance" value={formatMoney(totalBalance)} delta="Outstanding" />
            <MetricCard label="Adjustments" value={adjustments.length} delta="Credits and charges" />
          </section>
          <div className="record-tabs" role="tablist">{["Invoices", "Actions", "Adjustments", "Customers"].map(item => <button key={item} className={item === tab ? "active" : ""} type="button" onClick={() => setTab(item)}>{item}</button>)}</div>
          {tab === "Invoices" && <Panel title="Invoices" description="Invoices from /api/billing-workflows/invoices.">{invoices.length ? <DataTable onRowClick={row => { setSelectedInvoice(row.InvoiceId); setTab("Actions"); }} columns={[{ key: "InvoiceNumber", label: "Invoice" }, { key: "AccountName", label: "Account" }, { key: "Amount", label: "Amount", render: row => formatMoney(row.Amount || 0) }, { key: "Balance", label: "Balance", render: row => formatMoney(row.Balance || 0) }, { key: "Status", label: "Status", render: row => <StatusTag tone={row.Status === "Paid" ? "success" : "warn"}>{row.Status}</StatusTag> }, { key: "DueDate", label: "Due" }, { key: "details", label: "", render: row => <button className="link-button compact-action" type="button" onClick={event => { event.stopPropagation(); setRoute?.(`details/invoice/${encodeURIComponent(row.InvoiceId)}`); }}>Details</button> }]} rows={invoices} /> : <div className="empty-state">No invoices returned by the billing workflow API.</div>}</Panel>}
          {tab === "Actions" && <Panel title="Invoice Actions" description={`Workflow actions for ${selectedCustomerName}.`} action={<GatedButton action="create:invoice-action" className="ghost-button" disabled={saving || !selectedInvoice} onClick={createSampleAction}>Create sample action</GatedButton>}>{loadingActions ? <div className="empty-state">Loading invoice actions...</div> : actions.length ? <DataTable columns={[{ key: "ActionType", label: "Action" }, { key: "Status", label: "Status" }, { key: "RequestedBy", label: "Requested By" }, { key: "Notes", label: "Notes" }, { key: "CreatedAtUtc", label: "Created" }]} rows={actions} /> : <div className="empty-state">Select an invoice or create the first action for this invoice.</div>}</Panel>}
          {tab === "Adjustments" && <Panel title="Adjustments" description="Billing adjustments from /api/billing-workflows/adjustments." action={<GatedButton action="create:adjustment" className="ghost-button" disabled={saving} onClick={createSampleAdjustment}>Create sample adjustment</GatedButton>}>{adjustments.length ? <DataTable columns={[{ key: "AdjustmentNumber", label: "Adjustment" }, { key: "AdjustmentType", label: "Type" }, { key: "Amount", label: "Amount", render: row => formatMoney(row.Amount || 0) }, { key: "Status", label: "Status" }, { key: "Reason", label: "Reason" }]} rows={adjustments} /> : <div className="empty-state">No adjustments returned by the billing workflow API.</div>}</Panel>}
          {tab === "Customers" && <Panel title="Billing Customers" description="Customer records from /api/billing/customers.">{customers.length ? <DataTable columns={[{ key: "CustomerNumber", label: "Customer #" }, { key: "CustomerName", label: "Customer" }, { key: "CustomerType", label: "Type" }, { key: "Region", label: "Region" }, { key: "Mrr", label: "MRR", render: row => formatMoney(row.Mrr || 0) }, { key: "Status", label: "Status" }, { key: "details", label: "", render: row => <button className="link-button compact-action" type="button" onClick={() => setRoute?.(`details/customer/${encodeURIComponent(row.CustomerNumber)}`)}>Details</button> }]} rows={customers} /> : <div className="empty-state">No billing customers returned by the API.</div>}</Panel>}
        </>
      )}
    </>
  );
}
