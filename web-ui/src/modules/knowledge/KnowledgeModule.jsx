import React, { useMemo, useState } from "react";
import { PageHeader } from "../../components/Shell";
import { KnowledgeAssistant } from "../../components/KnowledgeAssistant";
import { DataTable, MetricCard, Panel, StatusTag } from "../../components/Primitives";
import { knowledgeDocuments, knowledgeTopics } from "../../data/mockData";

function match(value, query) {
  return String(value || "").toLowerCase().includes(query.trim().toLowerCase());
}

function docStatusTone(status) {
  if (["Current", "Approved", "Active"].includes(status)) return "success";
  if (["Review", "Draft", "Needs Update"].includes(status)) return "warn";
  return "blue";
}

export default function KnowledgeModule({ setRoute }) {
  const [query, setQuery] = useState("");
  const filteredDocs = useMemo(() => {
    return (knowledgeDocuments || []).filter(doc => !query.trim() || [doc.title, doc.category, doc.owner, doc.status, doc.summary, doc.tags?.join(" ")].some(value => match(value, query)));
  }, [query]);
  const currentDocs = filteredDocs.filter(doc => ["Current", "Approved", "Active"].includes(doc.status));
  const reviewDocs = filteredDocs.filter(doc => ["Review", "Draft", "Needs Update"].includes(doc.status));

  return (
    <>
      <PageHeader
        title="Knowledge"
        description="Extracted knowledge workspace with article search, topic coverage, and the platform assistant preserved."
        actions={<div className="module-toolbar"><button className="ghost-button" type="button" onClick={() => setRoute?.("reports")}>Open Reports</button><button className="button" type="button" onClick={() => setRoute?.("administration")}>Admin Settings</button></div>}
      />
      <section className="overview-grid">
        <MetricCard label="Documents" value={knowledgeDocuments?.length || 0} delta="Knowledge records" />
        <MetricCard label="Topics" value={knowledgeTopics?.length || 0} delta="Coverage areas" />
        <MetricCard label="Current" value={currentDocs.length} delta="Approved/current docs" />
        <MetricCard label="Needs Review" value={reviewDocs.length} delta="Draft or review docs" tone={reviewDocs.length ? "warn" : ""} />
      </section>
      <section className="record-main-layout">
        <Panel title="Knowledge Search" description="Search products, policies, promotions, procedures, and operational runbooks." action={<label className="inline-search"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search knowledge documents" /></label>}>
          {filteredDocs.length ? <DataTable columns={[
            { key: "title", label: "Document" },
            { key: "category", label: "Category" },
            { key: "owner", label: "Owner" },
            { key: "status", label: "Status", render: row => <StatusTag tone={docStatusTone(row.status)}>{row.status}</StatusTag> },
            { key: "updated", label: "Updated" }
          ]} rows={filteredDocs.slice(0, 12)} /> : <div className="empty-state">No knowledge documents match the current search.</div>}
        </Panel>
        <Panel title="Topic Coverage" description="Knowledge areas available to the assistant and support teams.">
          <div className="menu-actions">
            {(knowledgeTopics || []).map(topic => <button className="menu-action" type="button" key={topic.id || topic.label || topic.name} onClick={() => setQuery(topic.label || topic.name || topic.id)}><strong>{topic.label || topic.name || topic.id}</strong><span>{topic.description || topic.summary || "Knowledge topic"}</span></button>)}
          </div>
        </Panel>
      </section>
      <Panel title="Knowledge Assistant" description="Existing assistant integration preserved outside LegacyPortal.">
        <KnowledgeAssistant context={{ route: "knowledge", pageTitle: "Knowledge", pageSummary: "Extracted knowledge workspace" }} />
      </Panel>
    </>
  );
}
