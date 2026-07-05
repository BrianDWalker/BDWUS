import React, { useEffect, useMemo, useState } from "react";
import { GatedButton } from "../../components/PermissionGate";
import { PageHeader } from "../../components/Shell";
import { DataTable, MetricCard, Panel, StatusTag } from "../../components/Primitives";
import { fetchOpsBootstrap, fetchOrders, fetchProvisioningJobs } from "../../utils/opsApi";
import { createOrder, createProvisioningJob, updateOrder } from "../../utils/opsMutations";
import { arrayField, normalizeOrder, normalizeProvisioningJob } from "../../utils/payloadMapping";

function statusTone(status) {
  return ["Completed", "Validated"].includes(status) ? "success" : ["Blocked", "Pending Network", "Provisioning", "In Progress"].includes(status) ? "warn" : "blue";
}

const normalizeOrders = rows => (rows || []).map(normalizeOrder);
const normalizeJobs = rows => (rows || []).map(normalizeProvisioningJob);

export default function OrdersModule({ setRoute, showToast }) {
  const [orders, setOrders] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadOrders() {
    setLoading(true);
    setError("");
    try {
      const bootstrap = await fetchOpsBootstrap();
      setOrders(normalizeOrders(arrayField(bootstrap, "orders", "Orders")));
      setJobs(normalizeJobs(arrayField(bootstrap, "provisioningJobs", "ProvisioningJobs", "jobs")));
    } catch (err) {
      setError(err.message || "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function createSampleOrder() {
    setSaving(true);
    try {
      await createOrder({ accountName: "New Customer", serviceName: "Fiber 1G", lifecycleStage: "Design", overallStatus: "Draft", slaStatus: "On Track" });
      setOrders(normalizeOrders(await fetchOrders()));
      showToast?.("Sample order created");
    } catch (err) {
      setError(err.message || "Unable to create order.");
    } finally {
      setSaving(false);
    }
  }

  async function progressOrder(order) {
    setSaving(true);
    try {
      await updateOrder(order.OrderId, { lifecycleStage: "Provisioning", overallStatus: "Provisioning", slaStatus: order.SlaStatus || "On Track" });
      await createProvisioningJob({ orderId: order.OrderId, jobType: "Provisioning", ownerName: order.AssignedTeam || "Provisioning Ops", status: "Queued" });
      const [orderRows, jobRows] = await Promise.all([fetchOrders(), fetchProvisioningJobs()]);
      setOrders(normalizeOrders(orderRows));
      setJobs(normalizeJobs(jobRows));
      showToast?.("Order moved to provisioning");
    } catch (err) {
      setError(err.message || "Unable to update order.");
    } finally {
      setSaving(false);
    }
  }

  const atRisk = useMemo(() => orders.filter(row => row.SlaStatus !== "On Track").length, [orders]);

  return (
    <section className="orders-compact">
      <PageHeader title="Orders" description="API-backed service delivery queue, provisioning jobs, and order mutations." actions={<div className="button-cluster"><button className="ghost-button" disabled={loading || saving} type="button" onClick={loadOrders}>Refresh</button><GatedButton action="create:order" disabled={saving} onClick={createSampleOrder}>New Order</GatedButton></div>} />
      {error && <div className="empty-state">{error}</div>}
      {loading ? <div className="empty-state">Loading orders...</div> : (
        <>
          <section className="overview-grid">
            <MetricCard label="Orders" value={orders.length} delta="Delivery queue" />
            <MetricCard label="Provisioning Jobs" value={jobs.length} delta="Active jobs" />
            <MetricCard label="At Risk" value={atRisk} delta="SLA watch" />
            <MetricCard label="Teams" value={new Set(orders.map(row => row.AssignedTeam).filter(Boolean)).size} delta="Assigned teams" />
          </section>
          <section className="record-main-layout">
            <Panel title="Orders" description="Orders returned by /api/ops/orders.">{orders.length ? <DataTable columns={[{ key: "OrderNumber", label: "Order" }, { key: "AccountName", label: "Account" }, { key: "ServiceName", label: "Service" }, { key: "LifecycleStage", label: "Stage" }, { key: "OverallStatus", label: "Status", render: row => <StatusTag tone={statusTone(row.OverallStatus)}>{row.OverallStatus}</StatusTag> }, { key: "SlaStatus", label: "SLA", render: row => <StatusTag tone={statusTone(row.SlaStatus)}>{row.SlaStatus}</StatusTag> }, { key: "DueDate", label: "Due" }, { key: "details", label: "", render: row => <button className="link-button compact-action" type="button" onClick={() => setRoute?.(`details/order/${encodeURIComponent(row.OrderId)}`)}>Details</button> }, { key: "action", label: "", render: row => <GatedButton action="create:provisioning-job" className="link-button compact-action" disabled={saving} onClick={() => progressOrder(row)}>Provision</GatedButton> }]} rows={orders} /> : <div className="empty-state">No orders returned by the ops API.</div>}</Panel>
            <Panel title="Provisioning Jobs" description="Jobs returned by /api/ops/provisioning-jobs.">{jobs.length ? <DataTable columns={[{ key: "JobNumber", label: "Job" }, { key: "JobType", label: "Type" }, { key: "OwnerName", label: "Owner" }, { key: "Status", label: "Status" }, { key: "DueDate", label: "Due" }]} rows={jobs} /> : <div className="empty-state">No provisioning jobs returned by the ops API.</div>}</Panel>
          </section>
        </>
      )}
    </section>
  );
}
