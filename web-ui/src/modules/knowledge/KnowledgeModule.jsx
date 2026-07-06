import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/Shell";
import { DataTable, MetricCard, Panel, StatusTag, WarningBanner, statusTone } from "../../components/Primitives";
import { fetchKnowledgeBootstrap } from "../../utils/platformApi";

function match(value, query) {
  return String(value || "").toLowerCase().includes(query.trim().toLowerCase());
}

function normalizeKnowledgeDocument(doc = {}) {
  const status = doc.status || doc.Status || "Current";
  const audience = doc.audience || doc.Audience || "Internal";
  const category = doc.category || doc.Category || "General";
  const owner = doc.owner || doc.Owner || "Knowledge Ops";
  const tags = Array.isArray(doc.tags) && doc.tags.length ? doc.tags : [category, audience, owner]
    .flatMap(value => String(value || "").split(","))
    .map(value => value.trim())
    .filter(Boolean);
  return {
    id: doc.id || doc.DocumentId || doc.title || "knowledge-doc",
    title: doc.title || doc.Title || "Untitled knowledge document",
    category,
    audience,
    owner,
    status,
    updated: doc.updated || doc.UpdatedAtUtc || doc.updatedAt || "Unscheduled",
    summary: doc.summary || doc.Summary || "No summary captured for this knowledge document.",
    tags
  };
}

export default function KnowledgeModule({ setRoute }) {
  const [query, setQuery] = useState("");
  const [knowledgePayload, setKnowledgePayload] = useState({ documents: [], topics: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState([]);
  const docs = useMemo(() => (knowledgePayload.documents || []).map(normalizeKnowledgeDocument), [knowledgePayload.documents]);
  const topics = knowledgePayload.topics || [];

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setWarnings([]);
    fetchKnowledgeBootstrap()
      .then(payload => {
        if (!active) return;
        const missingEndpoint = payload?.__httpStatus === 404;
        setKnowledgePayload({
          documents: payload?.documents || [],
          topics: payload?.topics || [],
          summary: payload?.summary || {}
        });
        setWarnings(missingEndpoint ? ["Knowledge bootstrap is unavailable in this environment; showing the Knowledge shell without document data."] : []);
      })
      .catch(err => {
        if (!active) return;
        setKnowledgePayload({ documents: [], topics: [], summary: {} });
        setError(err.message || "Unable to load knowledge records.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredDocs = useMemo(() => {
    return docs.filter(doc => !query.trim() || [doc.title, doc.category, doc.audience, doc.owner, doc.status, doc.summary, doc.tags.join(" ")].some(value => match(value, query)));
  }, [docs, query]);
  const currentDocs = docs.filter(doc => ["Current", "Approved", "Active"].includes(doc.status));
  const reviewDocs = docs.filter(doc => ["Review", "Draft", "Needs Update"].includes(doc.status));

  return (
    <>
      <PageHeader
        title="Knowledge"
        description="Extracted knowledge workspace with article search, topic coverage, and the platform assistant preserved."
        actions={<div className="module-toolbar"><button className="ghost-button" type="button" onClick={() => setRoute?.("reports")}>Open Reports</button><button className="button" type="button" onClick={() => setRoute?.("administration")}>Admin Settings</button></div>}
      />
      {warnings.map(warning => <WarningBanner key={warning}>{warning}</WarningBanner>)}
      {error && <div className="empty-state">{error}</div>}
      {loading && <div className="empty-state">Loading knowledge records…</div>}
      <section className="overview-grid">
        <MetricCard label="Documents" value={knowledgePayload.summary?.documentCount ?? docs.length} delta="Knowledge records" />
        <MetricCard label="Topics" value={knowledgePayload.summary?.topicCount ?? topics.length} delta="Coverage areas" />
        <MetricCard label="Current" value={knowledgePayload.summary?.currentCount ?? currentDocs.length} delta="Approved/current docs" />
        <MetricCard label="Needs Review" value={knowledgePayload.summary?.reviewCount ?? reviewDocs.length} delta="Draft or review docs" tone={reviewDocs.length ? "warn" : ""} />
      </section>
      <section className="record-main-layout">
        <Panel title="Knowledge Search" description="Search products, policies, promotions, procedures, and operational runbooks." action={<label className="inline-search"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search knowledge documents" /></label>}>
          {filteredDocs.length ? <DataTable columns={[
            { key: "title", label: "Document" },
            { key: "category", label: "Category" },
            { key: "audience", label: "Audience" },
            { key: "owner", label: "Owner" },
            { key: "status", label: "Status", render: row => <StatusTag tone={statusTone(row.status)}>{row.status}</StatusTag> },
            { key: "updated", label: "Updated" }
          ]} rows={filteredDocs.slice(0, 12)} /> : <div className="empty-state">No knowledge documents match the current search.</div>}
        </Panel>
        <Panel title="Topic Coverage" description="Knowledge areas available to the assistant and support teams.">
          <div className="menu-actions">
            {(topics || []).map(topic => <button className="menu-action" type="button" key={topic.id || topic.label || topic.name} onClick={() => setQuery(topic.label || topic.name || topic.id)}><strong>{topic.label || topic.name || topic.id}</strong><span>{topic.description || topic.summary || "Knowledge topic"}</span></button>)}
          </div>
        </Panel>
      </section>
    </>
  );
}
