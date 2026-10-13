import React from "react";
import { PageHeader } from "../../components/Shell";
import { MetricCard, Panel, StatusTag } from "../../components/Primitives";

function detailParts(id = "") {
  const value = decodeURIComponent(id || "record");
  const [prefix, ...rest] = value.split(":");
  return {
    recordType: rest.length ? prefix : "record",
    recordId: rest.length ? rest.join(":") : value
  };
}

export default function RecordDetailModule({ id, setRoute }) {
  const { recordType, recordId } = detailParts(id);
  return (
    <>
      <PageHeader
        title="Record Detail"
        description="Modern safe fallback for generic or stale record detail links."
        actions={<div className="button-cluster"><button className="ghost-button" type="button" onClick={() => setRoute?.("dashboard")}>Back Home</button><button className="button" type="button" onClick={() => setRoute?.("reports")}>Open Reports</button></div>}
      />
      <section className="overview-grid">
        <MetricCard label="Record Type" value={recordType} delta="Fallback detail" />
        <MetricCard label="Record ID" value={recordId} delta="Route identifier" />
        <MetricCard label="Status" value={<StatusTag tone="blue">Compatibility</StatusTag>} delta="Modern fallback" />
        <MetricCard label="Next Step" value="Review source route" delta="Route ownership" />
      </section>
      <Panel title="Generic Record Fallback" description="This page prevents stale links from dropping into the old portal while preserving navigation safety.">
        <div className="empty-state">No dedicated detail module exists for this record type yet. Use Reports, Home, or the source module to continue.</div>
      </Panel>
    </>
  );
}
