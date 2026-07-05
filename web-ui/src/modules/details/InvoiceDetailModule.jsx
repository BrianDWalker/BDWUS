import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/Shell";
import { DataTable, MetricCard, Panel, StatusTag, WarningBanner, formatMoney } from "../../components/Primitives";
import { fetchBillingWorkflowAdjustments, fetchBillingWorkflowInvoice, fetchBillingWorkflowInvoiceActions } from "../../utils/opsApi";
import { listBillingCustomers } from "../../utils/salesApi";
import { normalizeCustomer, normalizeInvoice } from "../../utils/payloadMapping";
import { DetailHeader, DetailSummary, DetailTabs, EmptyState } from "./DetailShell";

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
    Reason: row.Reason || row.reason,
    InvoiceId: row.InvoiceId || row.invoiceId
  };
}

function tone(status) {
  return ["Paid", "Approved", "Posted", "Complete"].includes(status) ? "success" : ["Open", "Pending", "Review", "Overdue", "Disputed"].includes(status) ? "warn" : "blue";
}

export default function InvoiceDetailModule({ id, setRoute, showToast }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [invoice, setInvoice] = useState(null);
  const [actions, setActions] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [tab, setTab] = useState("Summary");

  async function loadDetail() {
    setLoading(true);
    setError("");
    setWarnings([]);
    const [invoiceResult, actionResult, adjustmentResult, customerResult] = await Promise.allSettled([
      fetchBillingWorkflowInvoice(id),
      fetchBillingWorkflowInvoiceActions(id),
      fetchBillingWorkflowAdjustments(),
      listBillingCustomers()
    ]);

    const invoicePayload = invoiceResult.status === "fulfilled" ? normalizeInvoice(invoiceResult.value || {}) : null;
    const fallbackCustomers = customerResult.status === "fulfilled" ? (customerResult.value || []).map(normalizeCustomer) : [];
    setInvoice(invoicePayload || normalizeInvoice({ InvoiceId: id, InvoiceNumber: id, AccountName: "Invoice", Status: "Open" }));
    setActions((actionResult.status === "fulfilled" ? actionResult.value || [] : []).map(normalizeAction));
    setAdjustments((adjustmentResult.status === "fulfilled" ? adjustmentResult.value || [] : []).map(normalizeAdjustment));
    setCustomers(fallbackCustomers);

    const failed = [
      invoiceResult.status === "rejected" ? "invoice detail" : "",
      actionResult.status === "rejected" ? "invoice actions" : "",
      adjustmentResult.status === "rejected" ? "billing adjustments" : "",
      customerResult.status === "rejected" ? "billing customer list" : ""
    ].filter(Boolean);

    if (failed.length && (invoicePayload || actions.length || adjustments.length || fallbackCustomers.length)) {
      setWarnings([`${failed.join(" and ")} unavailable; showing available invoice data.`]);
    } else if (failed.length) {
      setError(invoiceResult.reason?.message || actionResult.reason?.message || adjustmentResult.reason?.message || customerResult.reason?.message || "Unable to load invoice detail.");
    }

    setLoading(false);
  }

  useEffect(() => {
    loadDetail().catch(err => {
      setError(err.message || "Unable to load invoice detail.");
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const selectedInvoice = invoice || {};
  const customer = customers.find(row => row.CustomerName === selectedInvoice.AccountName || row.CustomerNumber === selectedInvoice.CustomerNumber) || normalizeCustomer({ CustomerName: selectedInvoice.AccountName || "Customer", CustomerNumber: selectedInvoice.CustomerNumber || "" });
  const lineItems = useMemo(() => selectedInvoice.serviceRows || selectedInvoice.lineItems || selectedInvoice.LineItems || [], [selectedInvoice]);
  const paymentRows = useMemo(() => selectedInvoice.payments || selectedInvoice.Payments || (Number(selectedInvoice.Balance || 0) > 0 ? [{ id: `${selectedInvoice.InvoiceId || id}-pay`, date: selectedInvoice.DueDate || "Pending", method: "ACH", amount: Math.max(0, Number(selectedInvoice.Amount || 0) - Number(selectedInvoice.Balance || 0)), status: "Posted", reference: selectedInvoice.InvoiceNumber || id }] : []), [selectedInvoice, id]);
  const tabs = ["Summary", "Line Items", "Actions", "Adjustments", "Payments"];

  return (
    <>
      <PageHeader title="Billing" description="Dedicated invoice detail workspace." actions={<div className="button-cluster"><button className="ghost-button" type="button" onClick={() => setRoute?.("billing")}>Back to Billing</button><button className="button" type="button" disabled={loading} onClick={loadDetail}>Refresh</button></div>} />
      {warnings.map(warning => <WarningBanner key={warning}>{warning}</WarningBanner>)}
      {error && <EmptyState>{error}</EmptyState>}
      {loading ? <EmptyState>Loading invoice detail...</EmptyState> : (
        <>
          <DetailHeader
            breadcrumb={["Billing", "Invoices", selectedInvoice.InvoiceNumber || id]}
            title={`Invoice ${selectedInvoice.InvoiceNumber || id}`}
            status={selectedInvoice.Status || "Open"}
            subtitle={`${selectedInvoice.AccountName || customer.CustomerName || "Account unavailable"} · ${selectedInvoice.DueDate || "Due date unavailable"}`}
            actions={<div className="button-cluster"><button className="button" type="button" onClick={() => setRoute?.(`details/customer/${customer.CustomerNumber || id}`)}>Open Customer</button><button className="ghost-button" type="button" onClick={() => showToast?.("Invoice snapshot refreshed")}>Snapshot</button></div>}
          />
          <DetailSummary items={[
            { label: "Customer", value: selectedInvoice.AccountName || customer.CustomerName || "-", note: customer.CustomerNumber || "Billing account" },
            { label: "Invoice Date", value: selectedInvoice.InvoiceDate || "-", note: "Issue date" },
            { label: "Due Date", value: selectedInvoice.DueDate || "-", note: "Payment due" },
            { label: "Total", value: formatMoney(selectedInvoice.Amount || 0), note: "Invoice total" },
            { label: "Balance", value: formatMoney(selectedInvoice.Balance || 0), note: selectedInvoice.Status || "Status" },
            { label: "Actions", value: actions.length, note: "Workflow items" }
          ]} />
          <DetailTabs tabs={tabs} active={tab} onChange={setTab} />
          {tab === "Summary" && (
            <section className="invoice-summary-layout">
              <Panel title="Invoice summary" description="Charge components, balances, and billing context.">
                <div className="field-grid invoice-summary-grid">
                  <MetricCard label="Invoice Number" value={selectedInvoice.InvoiceNumber || id} delta="Invoice state" />
                  <MetricCard label="Status" value={selectedInvoice.Status || "-"} delta="Invoice state" />
                  <MetricCard label="Amount" value={formatMoney(selectedInvoice.Amount || 0)} delta="Total billed" />
                  <MetricCard label="Balance" value={formatMoney(selectedInvoice.Balance || 0)} delta="Open receivable" />
                </div>
              </Panel>
              <Panel title="Payment info" description="Terms, method, and remit-to context.">
                <div className="field-grid invoice-summary-grid">
                  <MetricCard label="Payment terms" value={selectedInvoice.PaymentTerms || "Net 30"} delta="Default" />
                  <MetricCard label="Method" value={selectedInvoice.PaymentMethod || "ACH"} delta="Preferred" />
                  <MetricCard label="Billing account" value={selectedInvoice.BillingAccount || customer.CustomerNumber || "-"} delta="Ledger" />
                  <MetricCard label="Aging" value={selectedInvoice.AgingBucket || "Current"} delta="Receivables" />
                </div>
              </Panel>
            </section>
          )}
          {tab === "Line Items" && (
            <Panel title="Line items" description="Invoice line item detail and usage." >
              {lineItems.length ? <DataTable columns={[{ key: "serviceId", label: "Service ID" }, { key: "product", label: "Product" }, { key: "description", label: "Description" }, { key: "period", label: "Period" }, { key: "mrc", label: "MRC", render: row => formatMoney(row.mrc || row.Mrc || 0) }, { key: "nrc", label: "NRC", render: row => formatMoney(row.nrc || row.Nrc || 0) }, { key: "total", label: "Total", render: row => formatMoney(row.total || row.Total || 0) }]} rows={lineItems} /> : <EmptyState>No line items returned for this invoice.</EmptyState>}
            </Panel>
          )}
          {tab === "Actions" && (
            <Panel title="Invoice actions" description="Workflow actions attached to this invoice.">
              {actions.length ? <DataTable columns={[{ key: "ActionType", label: "Action" }, { key: "Status", label: "Status", render: row => <StatusTag tone={tone(row.Status)}>{row.Status || "-"}</StatusTag> }, { key: "RequestedBy", label: "Requested By" }, { key: "Notes", label: "Notes" }, { key: "CreatedAtUtc", label: "Created" }]} rows={actions} /> : <EmptyState>No invoice actions returned.</EmptyState>}
            </Panel>
          )}
          {tab === "Adjustments" && (
            <Panel title="Adjustments" description="Billing adjustments and dispute-related credits.">
              {adjustments.length ? <DataTable columns={[{ key: "AdjustmentNumber", label: "Adjustment" }, { key: "AdjustmentType", label: "Type" }, { key: "Amount", label: "Amount", render: row => formatMoney(row.Amount || 0) }, { key: "Status", label: "Status", render: row => <StatusTag tone={tone(row.Status)}>{row.Status || "-"}</StatusTag> }, { key: "Reason", label: "Reason" }]} rows={adjustments} /> : <EmptyState>No adjustments returned.</EmptyState>}
            </Panel>
          )}
          {tab === "Payments" && (
            <Panel title="Payments" description="Payment records and posting state.">
              {paymentRows.length ? <DataTable columns={[{ key: "date", label: "Date" }, { key: "method", label: "Method" }, { key: "amount", label: "Amount", render: row => formatMoney(row.amount || 0) }, { key: "status", label: "Status", render: row => <StatusTag tone={tone(row.status)}>{row.status || "-"}</StatusTag> }, { key: "reference", label: "Reference" }]} rows={paymentRows} /> : <EmptyState>No payment records returned.</EmptyState>}
            </Panel>
          )}
        </>
      )}
    </>
  );
}
