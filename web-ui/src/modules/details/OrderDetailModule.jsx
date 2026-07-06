import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/Shell";
import { DataTable, MetricCard, Panel, StatusTag, WarningBanner, formatMoney } from "../../components/Primitives";
import { fetchOpsBootstrap, fetchOrders, fetchProvisioningJobs } from "../../utils/opsApi";
import { normalizeOrder, normalizeProvisioningJob } from "../../utils/payloadMapping";
import { DetailHeader, DetailSummary, DetailTabs, EmptyState } from "./DetailShell";

function tone(status) {
  return ["Completed", "Validated"].includes(status) ? "success" : ["Blocked", "Pending Network", "Provisioning", "In Progress", "Draft"].includes(status) ? "warn" : "blue";
}

function matchesId(row, id) {
  return [row?.OrderId, row?.OrderNumber, row?.id, row?.number].filter(Boolean).some(value => String(value) === String(id));
}

export default function OrderDetailModule({ id, setRoute, showToast }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [order, setOrder] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [tab, setTab] = useState("Overview");

  async function loadDetail() {
    setLoading(true);
    setError("");
    setWarnings([]);
    const [bootstrapResult, ordersResult, jobsResult] = await Promise.allSettled([
      fetchOpsBootstrap(),
      fetchOrders(),
      fetchProvisioningJobs()
    ]);

    const bootstrap = bootstrapResult.status === "fulfilled" ? bootstrapResult.value || {} : {};
    const orderRows = ordersResult.status === "fulfilled" ? (ordersResult.value || []).map(normalizeOrder) : [];
    const jobRows = jobsResult.status === "fulfilled" ? (jobsResult.value || []).map(normalizeProvisioningJob) : [];
    const selected = orderRows.find(row => matchesId(row, id)) || normalizeOrder(bootstrap.orders?.find(row => matchesId(row, id)) || orderRows[0] || { OrderId: id, OrderNumber: id, AccountName: "Order", OverallStatus: "Draft", SlaStatus: "On Track" });

    setOrder(selected);
    setJobs(jobRows.filter(row => !selected.OrderId || !row.OrderId || String(row.OrderId) === String(selected.OrderId)));

    const failed = [
      bootstrapResult.status === "rejected" ? "bootstrap data" : "",
      ordersResult.status === "rejected" ? "orders" : "",
      jobsResult.status === "rejected" ? "provisioning jobs" : ""
    ].filter(Boolean);

    if (failed.length && (bootstrap.orders?.length || orderRows.length || jobRows.length)) {
      setWarnings([]);
    } else if (failed.length) {
      setError(bootstrapResult.reason?.message || ordersResult.reason?.message || jobsResult.reason?.message || "Unable to load order detail.");
    }

    setLoading(false);
  }

  useEffect(() => {
    loadDetail().catch(err => {
      setError(err.message || "Unable to load order detail.");
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const selectedOrder = order || {};
  const tasks = useMemo(() => ([
    { id: "design", task: "Design approval", phase: "Design", owner: "Order Ops", status: "Complete" },
    { id: "reservation", task: "Circuit reservation", phase: "Provisioning", owner: "Network Ops", status: "Queued" },
    { id: "install", task: "Installation scheduling", phase: "Field", owner: "Field Ops", status: "Planned" },
    { id: "activation", task: "Activation", phase: "Service", owner: "Provisioning", status: selectedOrder.OverallStatus || "Draft" }
  ]), [selectedOrder.OverallStatus]);

  const auditRows = useMemo(() => ([
    { id: "audit-1", when: "2026-07-01 09:12", action: "Status update", detail: `Order moved to ${selectedOrder.OverallStatus || "Draft"}` },
    { id: "audit-2", when: "2026-07-02 10:30", action: "Team assignment", detail: selectedOrder.AssignedTeam || "Provisioning Ops" },
    { id: "audit-3", when: "2026-07-03 11:45", action: "SLA review", detail: selectedOrder.SlaStatus || "On Track" }
  ]), [selectedOrder.AssignedTeam, selectedOrder.OverallStatus, selectedOrder.SlaStatus]);

  const tabs = ["Overview", "Tasks", "Provisioning", "Audit"];

  return (
    <>
      <PageHeader title="Orders" description="Dedicated order and provisioning detail workspace." actions={<div className="button-cluster"><button className="ghost-button" type="button" onClick={() => setRoute?.("orders")}>Back to Orders</button></div>} />
      {warnings.map(warning => <WarningBanner key={warning}>{warning}</WarningBanner>)}
      {error && <EmptyState>{error}</EmptyState>}
      {loading ? <EmptyState>Loading order detail...</EmptyState> : (
        <>
          <DetailHeader
            breadcrumb={["Orders", selectedOrder.OrderNumber || id]}
            title={selectedOrder.OrderNumber || id}
            status={selectedOrder.OverallStatus || "Draft"}
            subtitle={`${selectedOrder.AccountName || "Account unavailable"} · ${selectedOrder.ServiceName || "Service unavailable"}`}
            actions={<div className="button-cluster"><button className="button" type="button" onClick={() => setRoute?.(selectedOrder.CustomerNumber ? `details/customer/${selectedOrder.CustomerNumber}` : "customer-360")}>Open Customer</button><button className="ghost-button" type="button" onClick={() => showToast?.("Order snapshot refreshed")}>Snapshot</button></div>}
          />
          <DetailSummary items={[
            { label: "Account", value: selectedOrder.AccountName || "-", note: "Customer" },
            { label: "Service", value: selectedOrder.ServiceName || "-", note: "Requested service" },
            { label: "Lifecycle", value: selectedOrder.LifecycleStage || "-", note: "Delivery stage" },
            { label: "Status", value: selectedOrder.OverallStatus || "-", note: selectedOrder.SlaStatus || "SLA" },
            { label: "SLA", value: selectedOrder.SlaStatus || "-", note: "Delivery health" },
            { label: "Jobs", value: jobs.length, note: "Provisioning queue" }
          ]} />
          <DetailTabs tabs={tabs} active={tab} onChange={setTab} />
          {tab === "Overview" && (
            <section className="order-detail-layout">
              <Panel title="Order summary" description="Lifecycle, fulfillment, and customer context.">
                <div className="field-grid compact-fields">
                  <MetricCard label="Order Number" value={selectedOrder.OrderNumber || id} delta="Order status" />
                  <MetricCard label="Customer" value={selectedOrder.AccountName || "-"} delta={selectedOrder.AssignedTeam || "Team"} />
                  <MetricCard label="Due Date" value={selectedOrder.DueDate || "-"} delta="Target date" />
                  <MetricCard label="Assigned Team" value={selectedOrder.AssignedTeam || "-"} delta="Owner" />
                </div>
              </Panel>
              <Panel title="Delivery context" description="Core fields for the fulfillment workflow.">
                <div className="field-grid compact-fields">
                  <MetricCard label="Status" value={selectedOrder.OverallStatus || "-"} delta="Delivery state" />
                  <MetricCard label="Stage" value={selectedOrder.LifecycleStage || "-"} delta="Lifecycle" />
                  <MetricCard label="Service" value={selectedOrder.ServiceName || "-"} delta="Product" />
                  <MetricCard label="Order ID" value={selectedOrder.OrderId || id} delta="Record identifier" />
                </div>
              </Panel>
            </section>
          )}
          {tab === "Tasks" && (
            <Panel title="Task summary" description="Fulfillment tasks and phase ownership.">
              <DataTable columns={[{ key: "task", label: "Task" }, { key: "phase", label: "Phase" }, { key: "owner", label: "Owner" }, { key: "status", label: "Status", render: row => <StatusTag tone={tone(row.status)}>{row.status}</StatusTag> }]} rows={tasks} />
            </Panel>
          )}
          {tab === "Provisioning" && (
            <Panel title="Provisioning jobs" description="Jobs tied to this order and downstream delivery.">
              {jobs.length ? <DataTable columns={[{ key: "JobNumber", label: "Job" }, { key: "JobType", label: "Type" }, { key: "OwnerName", label: "Owner" }, { key: "Status", label: "Status", render: row => <StatusTag tone={tone(row.Status)}>{row.Status || "-"}</StatusTag> }, { key: "DueDate", label: "Due" }]} rows={jobs} /> : null}
            </Panel>
          )}
          {tab === "Audit" && (
            <Panel title="Audit history" description="Recent state changes and operational checkpoints.">
              <DataTable columns={[{ key: "when", label: "When" }, { key: "action", label: "Action" }, { key: "detail", label: "Detail" }]} rows={auditRows} />
            </Panel>
          )}
        </>
      )}
    </>
  );
}
