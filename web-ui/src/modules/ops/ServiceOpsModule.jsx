import React, { useEffect, useState } from "react";
import { PageHeader } from "../../components/Shell";
import { DataTable, MetricCard, Panel, StatusTag, formatDate, formatMoney, statusTone } from "../../components/Primitives";
import { fetchCarrierSettlements, fetchNetworkEvents, fetchOpsBootstrap, fetchProvisioningJobs } from "../../utils/opsApi";
import { createCarrierSettlement, createNetworkEvent, createProvisioningJob } from "../../utils/opsMutations";
import { arrayField, normalizeNetworkEvent, normalizeProvisioningJob, normalizeSettlement } from "../../utils/payloadMapping";

const routeLabels = {
  network: "Network Events",
  "service-management": "Service Management",
  provisioning: "Provisioning",
  "carrier-settlement": "Carrier Settlement"
};

const normalizeOpsPayload = payload => ({
  networkEvents: arrayField(payload, "networkEvents", "NetworkEvents", "events").map(normalizeNetworkEvent),
  provisioningJobs: arrayField(payload, "provisioningJobs", "ProvisioningJobs", "jobs").map(normalizeProvisioningJob),
  settlements: arrayField(payload, "settlements", "carrierSettlements", "CarrierSettlements").map(normalizeSettlement)
});

export default function ServiceOpsModule({ route = "network", showToast }) {
  const [data, setData] = useState({ networkEvents: [], provisioningJobs: [], settlements: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadOps() {
    setLoading(true);
    setError("");
    try {
      const bootstrap = await fetchOpsBootstrap();
      setData(normalizeOpsPayload(bootstrap));
    } catch (err) {
      setError(err.message || "Unable to load service operations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOps();
  }, []);

  async function createSample(kind) {
    setSaving(true);
    try {
      if (kind === "network") {
        await createNetworkEvent({ market: "Midwest", type: "Capacity", impacted: "Backbone", severity: "Major", status: "Open", slaExposure: 25000 });
      } else if (kind === "provisioning") {
        await createProvisioningJob({ jobType: "Activation", ownerName: "Provisioning Ops", status: "Queued" });
      } else {
        await createCarrierSettlement({ partnerName: "Carrier Partner", billingPeriod: "Current", exposureAmount: 1000, status: "Open", claimType: "Dispute" });
      }
      const [networkEvents, provisioningJobs, settlements] = await Promise.all([fetchNetworkEvents(), fetchProvisioningJobs(), fetchCarrierSettlements()]);
      setData({
        networkEvents: (networkEvents || []).map(normalizeNetworkEvent),
        provisioningJobs: (provisioningJobs || []).map(normalizeProvisioningJob),
        settlements: (settlements || []).map(normalizeSettlement)
      });
      showToast?.("Service operation record created");
    } catch (err) {
      setError(err.message || "Unable to create service operation record.");
    } finally {
      setSaving(false);
    }
  }

  const title = routeLabels[route] || "Service Operations";
  const exposure = data.settlements.reduce((sum, row) => sum + Number(row.ExposureAmount || 0), 0);

  return (
    <>
      <PageHeader title={title} description="API-backed operations, network events, provisioning jobs, and carrier settlement." />
      {loading ? <div className="empty-state">Loading service operations...</div> : (
        <>
          <section className="overview-grid">
            <MetricCard label="Network Events" value={data.networkEvents.length} delta="Operational incidents" />
            <MetricCard label="Provisioning Jobs" value={data.provisioningJobs.length} delta="Activation queue" />
            <MetricCard label="Settlements" value={data.settlements.length} delta="Carrier records" />
            <MetricCard label="Exposure" value={formatMoney(exposure)} delta="Settlement amount" />
          </section>
          {(route === "network" || route === "service-management") && <Panel title="Network Events" description="Network events." action={<button className="ghost-button" disabled={saving} type="button" onClick={() => createSample("network")}>Create sample event</button>}>{data.networkEvents.length ? <DataTable columns={[{ key: "EventNumber", label: "Event" }, { key: "Market", label: "Market" }, { key: "Type", label: "Type" }, { key: "Impacted", label: "Impacted" }, { key: "Severity", label: "Severity", render: row => <StatusTag tone={statusTone(row.Severity, { warn: ["Major", "Critical"] })}>{row.Severity}</StatusTag> }, { key: "Status", label: "Status", render: row => <StatusTag tone={statusTone(row.Status)}>{row.Status}</StatusTag> }, { key: "SlaExposure", label: "SLA Exposure", render: row => formatMoney(row.SlaExposure || 0) }]} rows={data.networkEvents} /> : null}</Panel>}
          {(route === "provisioning" || route === "service-management") && <Panel title="Provisioning Jobs" description="Provisioning jobs." action={<button className="ghost-button" disabled={saving} type="button" onClick={() => createSample("provisioning")}>Create sample job</button>}>{data.provisioningJobs.length ? <DataTable columns={[{ key: "JobNumber", label: "Job" }, { key: "JobType", label: "Type" }, { key: "OwnerName", label: "Owner" }, { key: "Status", label: "Status", render: row => <StatusTag tone={statusTone(row.Status)}>{row.Status}</StatusTag> }, { key: "DueDate", label: "Due", render: row => formatDate(row.DueDate) }]} rows={data.provisioningJobs} /> : null}</Panel>}
          {route === "carrier-settlement" && <Panel title="Carrier Settlement" description="Carrier settlement records." action={<button className="ghost-button" disabled={saving} type="button" onClick={() => createSample("settlement")}>Create sample settlement</button>}>{data.settlements.length ? <DataTable columns={[{ key: "SettlementNumber", label: "Settlement" }, { key: "PartnerName", label: "Partner" }, { key: "BillingPeriod", label: "Period" }, { key: "ExposureAmount", label: "Exposure", render: row => formatMoney(row.ExposureAmount || 0) }, { key: "Status", label: "Status" }, { key: "ClaimType", label: "Claim" }]} rows={data.settlements} /> : null}</Panel>}
        </>
      )}
    </>
  );
}
