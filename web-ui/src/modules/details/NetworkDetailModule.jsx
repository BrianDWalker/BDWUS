import React, { useEffect, useState } from "react";
import { PageHeader } from "../../components/Shell";
import { DataTable, MetricCard, Panel, StatusTag, formatMoney, statusTone } from "../../components/Primitives";
import { fetchOpsBootstrap } from "../../utils/opsApi";
import { arrayField, normalizeNetworkEvent } from "../../utils/payloadMapping";

export default function NetworkDetailModule({ id, setRoute }) {
  const [event, setEvent] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadNetworkDetail() {
    setLoading(true);
    setError("");
    try {
      const payload = await fetchOpsBootstrap();
      const rows = arrayField(payload, "networkEvents", "NetworkEvents", "events").map(normalizeNetworkEvent);
      setEvents(rows);
      setEvent(rows.find(row => row.EventId === id || row.EventNumber === id) || rows[0] || null);
    } catch (err) {
      setError(err.message || "Unable to load network detail.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNetworkDetail();
  }, [id]);

  const title = event?.EventNumber || event?.EventId || "Network Detail";

  return (
    <>
      <PageHeader title={title} description="Modern ServiceOps network event detail route." actions={<div className="button-cluster"><button className="ghost-button" type="button" onClick={() => setRoute?.("network")}>Back to Network</button></div>} />
      {error && <div className="empty-state">{error}</div>}
      {loading ? <div className="empty-state">Loading network event...</div> : !event ? <div className="empty-state">Network event not found.</div> : (
        <>
          <section className="overview-grid">
            <MetricCard label="Market" value={event.Market || "-"} delta="Impacted region" />
            <MetricCard label="Severity" value={event.Severity || "-"} delta="Event severity" />
            <MetricCard label="Status" value={event.Status || "-"} delta="Current state" />
            <MetricCard label="SLA Exposure" value={formatMoney(event.SlaExposure || 0)} delta="Estimated exposure" />
          </section>
          <section className="record-main-layout">
            <Panel title="Impact Summary" description={event.Type || "Network event"}>
              <div className="field-grid">
                <MetricCard label="Impacted" value={event.Impacted || event.AccountName || "-"} delta="Affected service/customer" />
                <MetricCard label="Customer" value={event.AccountName || "-"} delta={event.CustomerNumber || "Customer"} />
                <MetricCard label="Customer Reported" value={event.CustomerReported ? "Yes" : "No"} delta="Source" />
                <MetricCard label="State" value={<StatusTag tone={statusTone(event.Status, { warn: ["Breached"] })}>{event.Status}</StatusTag>} delta="Ops status" />
              </div>
            </Panel>
            <Panel title="Related Network Events" description="Other events returned by the operations API.">
              {events.length ? <DataTable columns={[{ key: "EventNumber", label: "Event" }, { key: "Market", label: "Market" }, { key: "Type", label: "Type" }, { key: "Severity", label: "Severity", render: row => <StatusTag tone={statusTone(row.Severity, { warn: ["Major", "Critical", "Breached"] })}>{row.Severity}</StatusTag> }, { key: "Status", label: "Status" }]} rows={events.slice(0, 8)} /> : <div className="empty-state">No related events returned.</div>}
            </Panel>
          </section>
        </>
      )}
    </>
  );
}
