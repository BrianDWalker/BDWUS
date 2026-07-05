import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/Shell";
import { DataTable, MetricCard, Panel, StatusTag, formatMoney } from "../../components/Primitives";
import { fetchBillingWorkflowAdjustments, fetchBillingWorkflowInvoice, fetchBillingWorkflowInvoiceActions, fetchBillingWorkflowInvoices } from "../../utils/opsApi";
import { createBillingAdjustment, createInvoiceAction } from "../../utils/opsMutations";
import { listBillingCustomers } from "../../utils/salesApi";

export default function BillingModule({ showToast }) {
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
      setCustomers(customerRows || []);
      setInvoices(invoiceRows || []);
      setAdjustments(adjustmentRows || []);
      setSelectedInvoice(current => current || invoiceRows?.[0]?.InvoiceId || "");
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
        setSelectedInvoiceDetail(invoiceDetail);
        setActions(actionRows || []);
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
      setActions(await fetchBillingWorkflowInvoiceActions(selectedInvoice));
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
      setAdjustments(await fetchBillingWorkflowAdjustments());
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
      <PageHeader title="Billing" description="API-backed invoices, workflow actions, adjustments, and billing customers." actions={<button className="button" disabled={loading || saving} type="button" onClick={loadBilling}>Refresh</button>} />
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
          {tab === "Invoices" && <Panel title="Invoices" description="Invoices from /api/billing-workflows/invoices.">{invoices.length ? <DataTable onRowClick={row => { setSelectedInvoice(row.InvoiceId); setTab("Actions"); }} columns={[{ key: "InvoiceNumber", label: "Invoice" }, { key: "AccountName", label: "Account" }, { key: "Amount", label: "Amount", render: row => formatMoney(row.Amount || 0) }, { key: "Balance", label: "Balance", render: row => formatMoney(row.Balance || 0) }, { key: "Status", label: "Status", render: row => <StatusTag tone={row.Status === "Paid" ? "success" : "warn"}>{row.Status}</StatusTag> }, { key: "DueDate", label: "Due" }]} rows={invoices} /> : <div className="empty-state">No invoices returned by the billing workflow API.</div>}</Panel>}
          {tab === "Actions" && <Panel title="Invoice Actions" description={`Workflow actions for ${selectedCustomerName}.`} action={<button className="ghost-button" disabled={saving || !selectedInvoice} type="button" onClick={createSampleAction}>Create sample action</button>}>{loadingActions ? <div className="empty-state">Loading invoice actions...</div> : actions.length ? <DataTable columns={[{ key: "ActionType", label: "Action" }, { key: "Status", label: "Status" }, { key: "RequestedBy", label: "Requested By" }, { key: "Notes", label: "Notes" }, { key: "CreatedAtUtc", label: "Created" }]} rows={actions} /> : <div className="empty-state">Select an invoice or create the first action for this invoice.</div>}</Panel>}
          {tab === "Adjustments" && <Panel title="Adjustments" description="Billing adjustments from /api/billing-workflows/adjustments." action={<button className="ghost-button" disabled={saving} type="button" onClick={createSampleAdjustment}>Create sample adjustment</button>}>{adjustments.length ? <DataTable columns={[{ key: "AdjustmentNumber", label: "Adjustment" }, { key: "AdjustmentType", label: "Type" }, { key: "Amount", label: "Amount", render: row => formatMoney(row.Amount || 0) }, { key: "Status", label: "Status" }, { key: "Reason", label: "Reason" }]} rows={adjustments} /> : <div className="empty-state">No adjustments returned by the billing workflow API.</div>}</Panel>}
          {tab === "Customers" && <Panel title="Billing Customers" description="Customer records from /api/billing/customers.">{customers.length ? <DataTable columns={[{ key: "CustomerNumber", label: "Customer #" }, { key: "CustomerName", label: "Customer" }, { key: "CustomerType", label: "Type" }, { key: "Region", label: "Region" }, { key: "Mrr", label: "MRR", render: row => formatMoney(row.Mrr || 0) }, { key: "Status", label: "Status" }]} rows={customers} /> : <div className="empty-state">No billing customers returned by the API.</div>}</Panel>}
        </>
      )}
    </>
  );
}
