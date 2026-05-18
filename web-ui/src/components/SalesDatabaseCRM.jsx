import React, { useEffect, useState } from "react";
import { PageHeader } from "./Shell";
import { Icon } from "./Icons";
import { DataTable, Panel, StatusTag, formatMoney } from "./Primitives";
import {
  approveApproval,
  checkServiceability,
  createLead,
  createLeadActivity,
  createOpportunity,
  createOpportunityNote,
  createOpportunityProduct,
  createCustomPricing,
  createQuote,
  createQuoteLineItem,
  convertLead,
  deleteLead,
  deleteOpportunity,
  deleteOpportunityProduct,
  deleteCustomPricing,
  deleteQuoteLineItem,
  deleteContractFile,
  getContract,
  getSalesBootstrap,
  getLead,
  getOpportunity,
  getQuote,
  listAccounts,
  listApprovals,
  listBillingCustomers,
  listBillingCodes,
  listBillingElements,
  listBillingProductHierarchy,
  listBillingProducts,
  listContractFiles,
  listContractHistory,
  listContracts,
  listCustomPricing,
  listOffers,
  listLeads,
  listLeadActivities,
  listOpportunities,
  listOpportunityNotes,
  listOpportunityProducts,
  listPromotions,
  listQuoteLineItems,
  priceQuote,
  listRatePlans,
  rejectApproval,
  requestChangesApproval,
  submitCustomPricing,
  submitQuoteApproval,
  updateLead,
  updateOpportunity,
  updateOpportunityProduct,
  updateCustomPricing,
  updateQuote,
  updateQuoteLineItem,
  createContractFile,
  updateContract,
  listQuotes
} from "../utils/salesApi";

const salesTabs = ["Leads", "Opportunities", "Accounts", "Custom Pricing", "Approvals", "Contracts"];
const opportunityTabs = ["Overview", "Products/Services", "Pricing", "Quotes", "Activity", "Notes", "Approvals", "Contracts"];
const quoteTabs = ["Summary", "Line Items", "Pricing", "Approvals", "Contract"];
const contractTabs = ["Overview", "Files", "History", "Terms"];
const leadTabs = ["Qualification & Customer Info", "Activity"];
const leadCloseStatuses = ["Closed Loss", "Closed No Sale", "Cancel Lead"];
const leadVisibleStatuses = new Set(["Open", "Active"]);
const detailTopActions = ["Back", "Close"];

const owners = ["Sarah Johnson", "Tia Brooks", "Sam Malik", "Ari Fox", "Maya Ortiz"];
const stages = ["Open", "Discovery", "Solutioning", "Quote", "Approval", "Closed Won", "Closed Lost"];

const textMatch = (value, query) => String(value ?? "").toLowerCase().includes(String(query ?? "").trim().toLowerCase());
const matchAny = (item, query, fields) => !query.trim() || fields.some(field => textMatch(field(item), query));

function fieldValue(row, ...keys) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== "") return row[key];
  }
  return "";
}

function firstArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return value.split(",").map(item => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function textArray(value) {
  return firstArray(value).join(", ");
}

function parseTextArray(value) {
  if (Array.isArray(value)) return value;
  return String(value ?? "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function parseJsonField(value, fallback = {}) {
  if (!value && value !== 0) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function pageDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

function money(value) {
  const num = Number(value || 0);
  return Number.isNaN(num) ? "$0" : formatMoney(num);
}

function Modal({ title, subtitle, children, actions, onClose }) {
  return (
    <div className="modal-backdrop">
      <section className="modal workflow-modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div className="side-panel-header">
          <div>
            <strong id="modalTitle">{title}</strong>
            <span>{subtitle || "Telecom sales workflow"}</span>
          </div>
          <button className="icon-close" type="button" onClick={onClose}>x</button>
        </div>
        {children}
        <div className="modal-actions">{actions}</div>
      </section>
    </div>
  );
}

function Tabs({ tabs, active, onChange }) {
  return (
    <div className="record-tabs sales-record-tabs" role="tablist">
      {tabs.map(tab => (
        <button type="button" key={tab} className={tab === active ? "active" : ""} onClick={() => onChange(tab)}>{tab}</button>
      ))}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <label className="inline-search">
      <Icon name="search" className="button-icon" />
      <input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function Toolbar({ children, className = "" }) {
  return <div className={`module-toolbar sales-tab-toolbar ${className}`.trim()}>{children}</div>;
}

function ActionButton({ icon, children, className = "button", ...props }) {
  return (
    <button className={className} type="button" {...props}>
      {icon ? <Icon name={icon} className="button-icon" /> : null}
      <span>{children}</span>
    </button>
  );
}

function RecordHeader({ breadcrumb, title, status, subtitle, actions, meta }) {
  return (
    <section className="record-header">
      <div>
        <div className="breadcrumb">{breadcrumb.join(" / ")}</div>
        <div className="record-title-line">
          <h2>{title}</h2>
          {status && <StatusTag tone={["Rejected", "Changes Requested", "Pending", "Review"].includes(status) ? "warn" : ["Approved", "Completed", "Active", "Ready", "Open"].includes(status) ? "success" : "blue"}>{status}</StatusTag>}
        </div>
        {subtitle && <p>{subtitle}</p>}
        {meta && <div className="record-meta-row">{meta}</div>}
      </div>
      <div className="record-actions">{actions}</div>
    </section>
  );
}

function SummaryStrip({ items }) {
  return (
    <section className="summary-strip">
      {items.map(item => (
        <div className="mini-stat" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.note && <small>{item.note}</small>}
        </div>
      ))}
    </section>
  );
}

function detailBack(setRoute) {
  setRoute("sales");
}

function LoadingBars({ rows = 3 }) {
  return (
    <div className="sales-loading-list" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="sales-loading-row" key={index}>
          <div className="sales-loading-line short"></div>
          <div className="sales-loading-line"></div>
          <div className="sales-loading-line medium"></div>
        </div>
      ))}
    </div>
  );
}

function WorkQueue({ loading, warnings, leads, quotes, approvals, contracts, setRoute }) {
  const queueItems = [
    {
      title: "Leads to qualify",
      body: loading ? "Loading open leads from Azure SQL..." : `${leads.filter(item => (item.Status || item.status || item.Qualification || "") !== "Converted").length} open leads`,
      action: loading ? null : () => setRoute(`details/lead/${leads[0]?.LeadId || leads[0]?.LeadID || leads[0]?.id}`)
    },
    {
      title: "Approvals waiting",
      body: loading ? "Loading approval queue..." : `${approvals.filter(item => String(item.Status || "").toLowerCase() === "pending").length} pending approvals`,
      action: loading ? null : () => setRoute(`details/quote/${approvals[0]?.EntityId || quotes[0]?.QuoteId || quotes[0]?.QuoteID || quotes[0]?.id}`)
    },
    {
      title: "Contracts in play",
      body: loading ? "Loading contract activity..." : `${contracts.length} active contracts`,
      action: loading ? null : () => setRoute(`details/opportunity/${contracts[0]?.OpportunityId || contracts[0]?.OpportunityID || contracts[0]?.opportunityId}`)
    }
  ];

  return (
    <Panel title="Work Queue" description="Open commercial work, approvals, and follow-ups." className="sales-work-queue">
      {loading ? (
        <LoadingBars rows={3} />
      ) : (
        <div className="sales-work-queue-list">
          {queueItems.map(item => (
            <button key={item.title} className="sales-work-queue-item" type="button" onClick={() => item.action?.()}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.body}</span>
              </div>
              <Icon name="chevronRight" className="button-icon" />
            </button>
          ))}
        </div>
      )}
      {warnings.length ? (
        <div className="sales-warning-stack">
          {warnings.map(warning => <div key={warning} className="sales-warning-item">{warning}</div>)}
        </div>
      ) : null}
    </Panel>
  );
}

function TableLoadingState({ columns }) {
  return (
    <div className="sales-table-loading">
      <div className="sales-table-loading-head">
        {columns.map(column => <div key={column.key}>{column.label}</div>)}
      </div>
      <LoadingBars rows={4} />
    </div>
  );
}

function useSalesData() {
  const [state, setState] = useState({
    loading: true,
    error: "",
    warnings: [],
    leads: [],
    accounts: [],
    opportunities: [],
    quotes: [],
    customPricing: [],
    approvals: [],
    contracts: [],
    billingCustomers: [],
    billingProducts: [],
    billingProductHierarchy: [],
    billingCodes: [],
    billingElements: [],
    offers: [],
    promotions: [],
    ratePlans: [],
    dashboard: {}
  });

  async function refresh() {
    try {
      setState(current => ({ ...current, loading: true, error: "" }));
      const bootstrap = await getSalesBootstrap();
      setState({
        loading: false,
        error: "",
        warnings: [],
        dashboard: bootstrap.dashboard || {},
        leads: bootstrap.leads || [],
        accounts: bootstrap.accounts || [],
        opportunities: bootstrap.opportunities || [],
        quotes: bootstrap.quotes || [],
        customPricing: bootstrap.customPricing || [],
        approvals: bootstrap.approvals || [],
        contracts: bootstrap.contracts || [],
        billingCustomers: bootstrap.billingCustomers || [],
        billingProducts: bootstrap.billingProducts || [],
        billingProductHierarchy: bootstrap.billingProductHierarchy || [],
        billingCodes: bootstrap.billingCodes || [],
        billingElements: bootstrap.billingElements || [],
        offers: bootstrap.offers || [],
        promotions: bootstrap.promotions || [],
        ratePlans: bootstrap.ratePlans || []
      });
    } catch (error) {
      setState(current => ({ ...current, loading: false, error: error.message || "Unable to load sales data." }));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return { state, refresh, setState };
}

function DataDialog({ open, onClose, title, subtitle, fields, values, onSave }) {
  const [form, setForm] = useState(values || {});
  useEffect(() => setForm(values || {}), [values, open]);
  if (!open) return null;
  return (
    <Modal
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      actions={(
        <>
          <button className="button" type="button" onClick={() => onSave(form)}>Save</button>
          <button className="ghost-button" type="button" onClick={onClose}>Cancel</button>
        </>
      )}
    >
      <form className="modal-form">
        {fields.map(field => (
          <label key={field.key}>
            {field.label}
            {field.type === "textarea" ? (
              <textarea value={form[field.key] ?? ""} onChange={event => setForm(current => ({ ...current, [field.key]: event.target.value }))} />
            ) : field.type === "select" ? (
              <select value={form[field.key] ?? ""} onChange={event => setForm(current => ({ ...current, [field.key]: event.target.value }))}>
                {(field.options || []).map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            ) : (
              <input value={form[field.key] ?? ""} onChange={event => setForm(current => ({ ...current, [field.key]: event.target.value }))} />
            )}
          </label>
        ))}
      </form>
    </Modal>
  );
}

function SalesTable({ columns, rows }) {
  return <DataTable columns={columns} rows={rows} />;
}

export function SalesModule({ setRoute, showToast }) {
  const { state, refresh } = useSalesData();
  const loading = state.loading;
  const [tab, setTab] = useState("Leads");
  const [query, setQuery] = useState("");
  const [leadStatus, setLeadStatus] = useState("All statuses");
  const [stage, setStage] = useState("All stages");
  const [owner, setOwner] = useState("All owners");
  const [segment, setSegment] = useState("All segments");
  const [status, setStatus] = useState("All statuses");
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [newLead, setNewLead] = useState(false);
  const [newOpportunity, setNewOpportunity] = useState(false);
  const [newQuote, setNewQuote] = useState(false);
  const [selectedCustomPricing, setSelectedCustomPricing] = useState(null);
  const [approveModal, setApproveModal] = useState(null);
  const [activityModal, setActivityModal] = useState(null);
  const [serviceabilityModal, setServiceabilityModal] = useState(false);

  const leads = state.leads || [];
  const accounts = state.accounts || [];
  const opportunities = state.opportunities || [];
  const quotes = state.quotes || [];
  const customPricing = state.customPricing || [];
  const approvals = state.approvals || [];
  const contracts = state.contracts || [];
  const dashboard = state.dashboard || {};
  const warnings = state.warnings || [];
  const billingProducts = state.billingProducts || [];
  const billingProductHierarchy = state.billingProductHierarchy || [];
  const billingCodes = state.billingCodes || [];
  const billingElements = state.billingElements || [];
  const offers = state.offers || [];
  const promotions = state.promotions || [];
  const ratePlans = state.ratePlans || [];

  const filteredLeads = leads.filter(item => {
    const rowStatus = String(fieldValue(item, "Status")).trim();
    const rowQualification = String(fieldValue(item, "Qualification")).trim();
    const isVisible = leadVisibleStatuses.has(rowStatus) || leadVisibleStatuses.has(rowQualification);
    return isVisible
      && matchAny(item, query, [r => fieldValue(r, "LeadNumber"), r => fieldValue(r, "AccountNameResolved", "AccountName"), r => fieldValue(r, "ProductInterest"), r => fieldValue(r, "OwnerName")])
      && (leadStatus === "All statuses" || rowStatus === leadStatus);
  });
  const filteredOpps = opportunities.filter(item => matchAny(item, query, [r => fieldValue(r, "OpportunityNumber"), r => fieldValue(r, "OpportunityName"), r => fieldValue(r, "AccountNameResolved"), r => fieldValue(r, "ProductSummary"), r => fieldValue(r, "OwnerName")]) && (stage === "All stages" || fieldValue(item, "Stage") === stage) && (owner === "All owners" || fieldValue(item, "OwnerName") === owner));
  const filteredAccounts = accounts.filter(item => matchAny(item, query, [r => fieldValue(r, "AccountNumber"), r => fieldValue(r, "AccountName"), r => fieldValue(r, "Segment"), r => fieldValue(r, "Region")]) && (segment === "All segments" || fieldValue(item, "Segment") === segment));
  const filteredQuotes = quotes.filter(item => matchAny(item, query, [r => fieldValue(r, "QuoteNumber"), r => fieldValue(r, "AccountName"), r => fieldValue(r, "OpportunityName")]) && (status === "All statuses" || fieldValue(item, "Status") === status));
  const filteredApprovals = approvals.filter(item => matchAny(item, query, [r => fieldValue(r, "EntityType"), r => fieldValue(r, "StepName"), r => fieldValue(r, "Status")]) && (status === "All statuses" || fieldValue(item, "Status") === status));
  const filteredContracts = contracts.filter(item => matchAny(item, query, [r => fieldValue(r, "ContractNumber"), r => fieldValue(r, "ContractName"), r => fieldValue(r, "AccountName"), r => fieldValue(r, "OpportunityName")]) && (status === "All statuses" || fieldValue(item, "Status") === status));
  const filteredCustomPricing = customPricing.filter(row => matchAny(row, query, [r => fieldValue(r, "RequestNumber"), r => fieldValue(r, "Status"), r => fieldValue(r, "RequestedBy"), r => fieldValue(r, "Reason")]) && (status === "All statuses" || fieldValue(row, "Status") === status));
  const queueWarnings = loading ? ["Loading sales data from Azure SQL..."] : state.error ? [state.error] : state.warnings;

  const leadColumns = [
    { key: "LeadNumber", label: "Lead" },
    { key: "AccountName", label: "Account" },
    { key: "Source", label: "Source" },
    { key: "Qualification", label: "Qualification" },
    { key: "EstimatedValue", label: "Estimated Value", render: row => money(row.EstimatedValue) },
    { key: "OwnerName", label: "Owner" },
    { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/lead/${row.LeadId}`)}>Open</button><button className="link-button compact-action" type="button" onClick={() => setSelectedLead(row)}>Convert</button></div> }
  ];

  const oppColumns = [
    { key: "OpportunityNumber", label: "Opportunity" },
    { key: "OpportunityName", label: "Name" },
    { key: "AccountNameResolved", label: "Account" },
    { key: "Stage", label: "Stage" },
    { key: "EstimatedValue", label: "Value", render: row => money(row.EstimatedValue) },
    { key: "OwnerName", label: "Owner" },
    { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/opportunity/${row.OpportunityId}`)}>Open</button><button className="link-button compact-action" type="button" onClick={() => setActivityModal({ type: "opportunity", row })}>Log Activity</button><button className="link-button compact-action" type="button" onClick={() => setNewQuote(row)}>Create Quote</button></div> }
  ];

  const accountColumns = [
    { key: "AccountNumber", label: "Account Number" },
    { key: "AccountName", label: "Account" },
    { key: "Segment", label: "Segment" },
    { key: "Region", label: "Region" },
    { key: "Mrr", label: "MRR", render: row => money(row.Mrr) },
    { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/customer/${row.AccountId}`)}>Customer 360</button><button className="link-button compact-action" type="button" onClick={() => setSelectedAccount(row)}>New Opportunity</button></div> }
  ];

  const quoteColumns = [
    { key: "QuoteNumber", label: "Quote" },
    { key: "AccountName", label: "Account" },
    { key: "OpportunityName", label: "Opportunity" },
    { key: "TotalMrc", label: "MRC", render: row => money(row.TotalMrc) },
    { key: "MarginPct", label: "Margin", render: row => `${Number(row.MarginPct || 0).toFixed(1)}%` },
    { key: "ApprovalStatus", label: "Status" },
    { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/quote/${row.QuoteId}`)}>Review</button></div> }
  ];

  const approvalColumns = [
    { key: "EntityType", label: "Type" },
    { key: "StepName", label: "Step" },
    { key: "Status", label: "Status" },
    { key: "RequestedBy", label: "Requested By" },
    { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => setApproveModal(row)}>Approve</button><button className="link-button compact-action" type="button" onClick={async () => { await rejectApproval(row.ApprovalId, { approvedBy: "Admin" }); showToast("Rejected"); refresh(); }}>Reject</button><button className="link-button compact-action" type="button" onClick={() => setApproveModal({ ...row, requestChanges: true })}>Review</button></div> }
  ];

  const contractColumns = [
    { key: "ContractNumber", label: "Contract" },
    { key: "AccountName", label: "Account" },
    { key: "OpportunityName", label: "Opportunity" },
    { key: "QuoteNumber", label: "Quote" },
    { key: "Status", label: "Status" },
    { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/contract/${row.ContractId}`)}>Open Contract</button><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/quote/${row.QuoteId}`)}>Open Quote</button><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/opportunity/${row.OpportunityId}`)}>Open Opportunity</button></div> }
  ];

  return (
    <>
      <PageHeader
        title="Sales"
        description="Database-backed telecom sales, pricing, approvals, and contracts."
        actions={<div className="module-toolbar sales-header-actions"><ActionButton icon="leads" onClick={() => setNewLead(true)}>New Lead</ActionButton><ActionButton icon="opportunities" onClick={() => setNewOpportunity(true)}>New Opportunity</ActionButton></div>}
      />
      {queueWarnings.length ? (
        <Panel title="Sales sync status" description="Azure SQL connectivity and workspace loading status." className="sales-warning-panel">
          <div className="sales-warning-stack">
            {queueWarnings.map(warning => <div key={warning} className="sales-warning-item">{warning}</div>)}
          </div>
        </Panel>
      ) : null}
      <SummaryStrip items={[
        { label: "Leads", value: loading ? "..." : leads.length, note: "SQL-backed records" },
        { label: "Opportunities", value: loading ? "..." : opportunities.length, note: "Pipeline records" },
        { label: "Quotes", value: loading ? "..." : quotes.length, note: "Pricing records" },
        { label: "Contracts", value: loading ? "..." : contracts.length, note: "Active agreements" }
      ]} />
      <Tabs tabs={salesTabs} active={tab} onChange={setTab} />
      {tab === "Leads" && (
        <Panel title="Leads" description="Lead qualification, activities, and conversion." action={<Toolbar><SearchBox value={query} onChange={setQuery} placeholder="Search leads" /><label className="inline-search"><Icon name="workflow" className="button-icon" /><select value={leadStatus} onChange={event => setLeadStatus(event.target.value)}>{["All statuses", "Open", "Active"].map(option => <option key={option}>{option}</option>)}</select></label></Toolbar>}>
          {loading ? <TableLoadingState columns={leadColumns} /> : <SalesTable columns={leadColumns} rows={filteredLeads} />}
        </Panel>
      )}
      {tab === "Opportunities" && (
        <Panel title="Opportunities" description="Opportunity detail, products, services, pricing, and approvals." action={<Toolbar><SearchBox value={query} onChange={setQuery} placeholder="Search opportunities" /><label className="inline-search"><Icon name="workflow" className="button-icon" /><select value={stage} onChange={event => setStage(event.target.value)}>{["All stages", ...stages].map(option => <option key={option}>{option}</option>)}</select></label><label className="inline-search"><Icon name="customers" className="button-icon" /><select value={owner} onChange={event => setOwner(event.target.value)}>{["All owners", ...owners].map(option => <option key={option}>{option}</option>)}</select></label></Toolbar>}>
          {loading ? <TableLoadingState columns={oppColumns} /> : <SalesTable columns={oppColumns} rows={filteredOpps} />}
        </Panel>
      )}
      {tab === "Accounts" && (
        <Panel title="Accounts" description="Customer records and account growth motions." action={<Toolbar><SearchBox value={query} onChange={setQuery} placeholder="Search accounts" /><label className="inline-search"><Icon name="workflow" className="button-icon" /><select value={segment} onChange={event => setSegment(event.target.value)}>{["All segments", "Enterprise", "SMB", "MidMarket"].map(option => <option key={option}>{option}</option>)}</select></label></Toolbar>}>
          {loading ? <TableLoadingState columns={accountColumns} /> : <SalesTable columns={accountColumns} rows={filteredAccounts} />}
        </Panel>
      )}
      {tab === "Custom Pricing" && (
        <Panel title="Custom Pricing" description="Review custom pricing requests and quote overrides." action={<Toolbar><SearchBox value={query} onChange={setQuery} placeholder="Search custom pricing" /><label className="inline-search"><Icon name="workflow" className="button-icon" /><select value={status} onChange={event => setStatus(event.target.value)}>{["All statuses", "Draft", "Submitted", "Approved", "Rejected"].map(option => <option key={option}>{option}</option>)}</select></label></Toolbar>}>
          {loading ? <TableLoadingState columns={[{ key: "RequestNumber", label: "Request" }, { key: "Status", label: "Status" }, { key: "RequestedBy", label: "Requested By" }, { key: "Reason", label: "Reason" }]} /> : <SalesTable columns={[{ key: "RequestNumber", label: "Request" }, { key: "Status", label: "Status" }, { key: "RequestedBy", label: "Requested By" }, { key: "Reason", label: "Reason" }, { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => setSelectedCustomPricing(row)}>Review</button></div> }]} rows={filteredCustomPricing} />}
        </Panel>
      )}
      {tab === "Approvals" && (
        <Panel title="Approvals" description="Quote, pricing, and contract approvals." action={<Toolbar><SearchBox value={query} onChange={setQuery} placeholder="Search approvals" /><label className="inline-search"><Icon name="workflow" className="button-icon" /><select value={status} onChange={event => setStatus(event.target.value)}>{["All statuses", "Pending", "Approved", "Rejected", "Changes Requested"].map(option => <option key={option}>{option}</option>)}</select></label></Toolbar>}>
          {loading ? <TableLoadingState columns={approvalColumns} /> : <SalesTable columns={approvalColumns} rows={filteredApprovals} />}
        </Panel>
      )}
      {tab === "Contracts" && (
        <Panel title="Contracts" description="Contract files, history, and linked commercial records." action={<Toolbar><SearchBox value={query} onChange={setQuery} placeholder="Search contracts" /><label className="inline-search"><Icon name="workflow" className="button-icon" /><select value={status} onChange={event => setStatus(event.target.value)}>{["All statuses", "Open", "Generated", "Review", "Ready"].map(option => <option key={option}>{option}</option>)}</select></label></Toolbar>}>
          {loading ? <TableLoadingState columns={contractColumns} /> : <SalesTable columns={contractColumns} rows={filteredContracts} />}
        </Panel>
      )}

      {selectedLead && (
        <LeadConvertModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onSave={async values => {
            await convertLead(selectedLead.LeadId, values);
            showToast("Lead converted to opportunity");
            setSelectedLead(null);
            refresh();
          }}
        />
      )}

      {selectedAccount && (
        <DataDialog
          open={Boolean(selectedAccount)}
          onClose={() => setSelectedAccount(null)}
          title="New opportunity"
          subtitle="Create an opportunity from this account."
          fields={[
            { key: "opportunityName", label: "Opportunity Name" },
            { key: "ownerName", label: "Owner" },
            { key: "estimatedValue", label: "Estimated Value" },
            { key: "stage", label: "Stage", type: "select", options: stages }
          ]}
          values={{ opportunityName: `${selectedAccount.AccountName} expansion opportunity`, ownerName: selectedAccount.OwnerName || "Admin", estimatedValue: selectedAccount.Mrr || 0, stage: "Discovery", accountId: selectedAccount.AccountId, customerNumber: selectedAccount.CustomerNumber }}
          onSave={async values => {
            await createOpportunity({ ...values, accountId: selectedAccount.AccountId, customerNumber: selectedAccount.CustomerNumber });
            showToast("Opportunity created");
            setSelectedAccount(null);
            refresh();
          }}
        />
      )}

      {newLead && (
        <DataDialog
          open={newLead}
          onClose={() => setNewLead(false)}
          title="New lead"
          subtitle="Create a database-backed lead."
          fields={[
            { key: "accountName", label: "Account Name" },
            { key: "contactName", label: "Contact Name" },
            { key: "source", label: "Source" },
            { key: "productInterest", label: "Product Interest" },
            { key: "estimatedValue", label: "Estimated Value" },
            { key: "notes", label: "Notes", type: "textarea" }
          ]}
          values={{ source: "Website", productInterest: "Fiber 500", estimatedValue: 0 }}
          onSave={async values => {
            await createLead({ ...values, ownerName: "Admin", qualification: "Open", status: "Open" });
            showToast("Lead saved");
            setNewLead(false);
            refresh();
          }}
        />
      )}

      {newOpportunity && (
        <DataDialog
          open={newOpportunity}
          onClose={() => setNewOpportunity(false)}
          title="New opportunity"
          subtitle="Create a SQL-backed opportunity."
          fields={[
            { key: "accountId", label: "Account ID" },
            { key: "opportunityName", label: "Opportunity Name" },
            { key: "ownerName", label: "Owner" },
            { key: "estimatedValue", label: "Estimated Value" },
            { key: "stage", label: "Stage", type: "select", options: stages }
          ]}
          values={{ stage: "Discovery" }}
          onSave={async values => {
            await createOpportunity(values);
            showToast("Opportunity saved");
            setNewOpportunity(false);
            refresh();
          }}
        />
      )}

      {newQuote && (
        <DataDialog
          open={Boolean(newQuote)}
          onClose={() => setNewQuote(null)}
          title="Create quote"
          subtitle="Create quote line items from the selected opportunity."
          fields={[
            { key: "quoteNumber", label: "Quote Number" },
            { key: "targetMarginPct", label: "Target Margin" },
            { key: "manualAdjustmentPct", label: "Manual Adjustment" }
          ]}
          values={{ quoteNumber: "", targetMarginPct: 30, manualAdjustmentPct: 0, opportunityId: newQuote.OpportunityId }}
          onSave={async values => {
            await createQuote({ opportunityId: newQuote.OpportunityId, pricingInput: values, lineItems: [] });
            showToast("Quote created");
            setNewQuote(null);
            refresh();
          }}
        />
      )}

      {selectedCustomPricing && (
        <DataDialog
          open={Boolean(selectedCustomPricing)}
          onClose={() => setSelectedCustomPricing(null)}
          title={selectedCustomPricing.CustomPricingRequestId ? "Edit custom pricing" : "New custom pricing"}
          subtitle="Create or edit a custom pricing request."
          fields={[
            { key: "RequestNumber", label: "Request Number" },
            { key: "Reason", label: "Reason", type: "textarea" },
            { key: "RequestedBy", label: "Requested By" },
            { key: "Status", label: "Status", type: "select", options: ["Draft", "Submitted", "Approved", "Rejected"] }
          ]}
          values={selectedCustomPricing}
          onSave={async values => {
            if (selectedCustomPricing.CustomPricingRequestId) {
              await updateCustomPricing(selectedCustomPricing.CustomPricingRequestId, values);
            } else {
              await createCustomPricing(values);
            }
            showToast("Custom pricing saved");
            setSelectedCustomPricing(null);
            refresh();
          }}
        />
      )}

      {approveModal && (
        <Modal
          title={approveModal.requestChanges ? "Review approval" : "Approval decision"}
          subtitle="Approve, reject, or request changes."
          onClose={() => setApproveModal(null)}
          actions={(
            <>
              <button className="button" type="button" onClick={async () => {
                if (approveModal.requestChanges) {
                  await requestChangesApproval(approveModal.ApprovalId, { requestedChanges: "Please revise pricing and summary." });
                  showToast("Changes requested");
                } else {
                  await approveApproval(approveModal.ApprovalId, { approvedBy: "Admin" });
                  showToast("Approved");
                }
                setApproveModal(null);
                refresh();
              }}>{approveModal.requestChanges ? "Request Changes" : "Approve"}</button>
              <button className="ghost-button" type="button" onClick={async () => { await rejectApproval(approveModal.ApprovalId, { approvedBy: "Admin" }); showToast("Rejected"); setApproveModal(null); refresh(); }}>Reject</button>
              <button className="ghost-button" type="button" onClick={() => setApproveModal(null)}>Cancel</button>
            </>
          )}
        >
          <p>{approveModal.EntityType} approval for step {approveModal.StepName}.</p>
          <p>Status: {approveModal.Status}</p>
        </Modal>
      )}

      {activityModal && (
        <ActivityModal
          context={activityModal}
          onClose={() => setActivityModal(null)}
          onSave={async values => {
            if (activityModal.type === "opportunity") {
              await createOpportunityNote(activityModal.row.OpportunityId, values);
            }
            showToast("Activity logged");
            setActivityModal(null);
            refresh();
          }}
        />
      )}

    </>
  );
}

function LeadConvertModal({ lead, onClose, onSave }) {
  const [values, setValues] = useState({ opportunityName: `${lead.AccountName} expansion opportunity`, ownerName: lead.OwnerName, estimatedValue: lead.EstimatedValue, productInterest: lead.ProductInterest });
  return (
    <Modal
      title="Convert lead"
      subtitle="Create an opportunity from this lead."
      onClose={onClose}
      actions={(
        <>
          <button className="button" type="button" onClick={() => onSave(values)}>Convert</button>
          <button className="ghost-button" type="button" onClick={onClose}>Cancel</button>
        </>
      )}
    >
      <form className="modal-form">
        <label>Opportunity Name<input value={values.opportunityName} onChange={event => setValues(current => ({ ...current, opportunityName: event.target.value }))} /></label>
        <label>Owner<input value={values.ownerName} onChange={event => setValues(current => ({ ...current, ownerName: event.target.value }))} /></label>
        <label>Estimated Value<input value={values.estimatedValue} onChange={event => setValues(current => ({ ...current, estimatedValue: event.target.value }))} /></label>
        <label>Service Focus<input value={values.productInterest} onChange={event => setValues(current => ({ ...current, productInterest: event.target.value }))} /></label>
      </form>
    </Modal>
  );
}

function ActivityModal({ context, onClose, onSave }) {
  const [values, setValues] = useState({ activityDate: new Date().toISOString().slice(0, 10), activityType: "Call", outcome: "Connected", notes: "", nextStep: "" });
  return (
    <Modal
      title={context.type === "opportunity" ? "Log opportunity activity" : "Log activity"}
      subtitle="Capture calls, texts, emails, meetings, and next steps."
      onClose={onClose}
      actions={(
        <>
          <button className="button" type="button" onClick={() => onSave(values)}>Save</button>
          <button className="ghost-button" type="button" onClick={onClose}>Cancel</button>
        </>
      )}
    >
      <form className="modal-form">
        <label>Activity Date<input type="date" value={values.activityDate} onChange={event => setValues(current => ({ ...current, activityDate: event.target.value }))} /></label>
        <label>Activity Type<select value={values.activityType} onChange={event => setValues(current => ({ ...current, activityType: event.target.value }))}><option>Call</option><option>Text</option><option>Email</option><option>Meeting</option></select></label>
        <label>Outcome<input value={values.outcome} onChange={event => setValues(current => ({ ...current, outcome: event.target.value }))} /></label>
        <label>Notes<textarea value={values.notes} onChange={event => setValues(current => ({ ...current, notes: event.target.value }))} /></label>
        <label>Next Step<input value={values.nextStep} onChange={event => setValues(current => ({ ...current, nextStep: event.target.value }))} /></label>
      </form>
    </Modal>
  );
}

function LeadCloseModal({ onClose, onSave }) {
  return (
    <Modal
      title="Close lead"
      subtitle="Select the final lead status before closing it in Azure SQL."
      onClose={onClose}
      actions={(
        <button className="ghost-button" type="button" onClick={onClose}>Cancel</button>
      )}
    >
      <div className="sales-close-options">
        {leadCloseStatuses.map(status => (
          <button key={status} className="sales-close-option" type="button" onClick={() => onSave(status)}>
            <strong>{status}</strong>
            <span>Update the lead status and remove it from the active sales view.</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function OpportunityCloseModal({ onClose, onSave }) {
  return (
    <Modal
      title="Close opportunity"
      subtitle="Set the final opportunity status in Azure SQL."
      onClose={onClose}
      actions={(
        <button className="ghost-button" type="button" onClick={onClose}>Cancel</button>
      )}
    >
      <div className="sales-close-options">
        {["Closed Won", "Closed Lost", "Closed Cancelled"].map(status => (
          <button key={status} className="sales-close-option" type="button" onClick={() => onSave(status)}>
            <strong>{status}</strong>
            <span>Persist the opportunity outcome and keep the record for reporting.</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function SalesLeadDetail({ id, setRoute, showToast }) {
  const [lead, setLead] = useState(null);
  const [activities, setActivities] = useState([]);
  const [tab, setTab] = useState("Qualification & Customer Info");
  const [editModal, setEditModal] = useState(false);
  const [activityModal, setActivityModal] = useState(false);
  const [convertModal, setConvertModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);

  useEffect(() => {
    getLead(id).then(setLead);
    listLeadActivities(id).then(setActivities);
  }, [id]);

  if (!lead) {
    return (
      <div className="content-shell">
        <PageHeader title="Lead" description="Loading lead from Azure SQL..." />
        <Panel title="Loading lead workspace" description="The page frame is ready while the record loads.">
          <LoadingBars rows={4} />
        </Panel>
      </div>
    );
  }

  return (
    <>
      <RecordHeader
        breadcrumb={["Sales", "Leads", lead.LeadNumber]}
        title={lead.AccountName}
        status={lead.Status}
        subtitle={`${lead.Source} · ${lead.ProductInterest} · ${money(lead.EstimatedValue)} · ${lead.OwnerName}`}
        actions={<div className="module-toolbar sales-header-actions"><ActionButton icon="workflow" onClick={() => detailBack(setRoute)}>Back</ActionButton><ActionButton icon="close" onClick={() => setCloseModal(true)}>Close</ActionButton><ActionButton icon="leads" onClick={() => setConvertModal(true)}>Convert</ActionButton></div>}
      />
      <SummaryStrip items={[
        { label: "Qualification", value: lead.Qualification || "Open", note: "Lead status" },
        { label: "Estimated Value", value: money(lead.EstimatedValue), note: lead.OwnerName },
        { label: "Service Needs", value: firstArray(lead.ServiceNeedsJson).join(", ") || lead.ProductInterest || "N/A", note: "SQL-backed lead" },
        { label: "Activity Count", value: activities.length, note: "Logged interactions" }
      ]} />
      <Tabs tabs={leadTabs} active={tab} onChange={setTab} />
      {tab === "Qualification & Customer Info" && (
        <Panel
          title="Lead overview"
          description="Core lead details, customer context, and service needs."
          action={<Toolbar><ActionButton icon="workflow" onClick={() => setEditModal(true)}>Edit</ActionButton></Toolbar>}
        >
          <div className="sales-detail-summary">
            <div className="sales-detail-card">
              <span>Lead status</span>
              <strong>{lead.Qualification || "Open"}</strong>
              <small>{lead.Status || "Open"}</small>
            </div>
            <div className="sales-detail-card">
              <span>Customer</span>
              <strong>{lead.CustomerName || lead.AccountName}</strong>
              <small>{lead.CustomerNumber || "No customer number"}</small>
            </div>
            <div className="sales-detail-card">
              <span>Products</span>
              <strong>{lead.ProductInterest || "N/A"}</strong>
              <small>{firstArray(lead.ServiceNeedsJson).join(", ") || "Service needs not captured yet"}</small>
            </div>
            <div className="sales-detail-card">
              <span>Value</span>
              <strong>{money(lead.EstimatedValue)}</strong>
              <small>{lead.OwnerName}</small>
            </div>
          </div>
          <div className="sales-detail-grid">
            <div className="sales-detail-panel">
              <h3>Qualification</h3>
              <dl className="sales-detail-dl">
                <div><dt>Status</dt><dd>{lead.Status}</dd></div>
                <div><dt>Qualification</dt><dd>{lead.Qualification}</dd></div>
                <div><dt>Source</dt><dd>{lead.Source}</dd></div>
                <div><dt>Owner</dt><dd>{lead.OwnerName}</dd></div>
              </dl>
            </div>
            <div className="sales-detail-panel">
              <h3>Customer information</h3>
              <dl className="sales-detail-dl">
                <div><dt>Customer Number</dt><dd>{lead.CustomerNumber}</dd></div>
                <div><dt>Region</dt><dd>{lead.Region || "N/A"}</dd></div>
                <div><dt>Billing Profile</dt><dd>{lead.BillingProfile || "N/A"}</dd></div>
                <div><dt>Customer Type</dt><dd>{lead.CustomerType || "N/A"}</dd></div>
              </dl>
            </div>
          </div>
        </Panel>
      )}
      {tab === "Activity" && (
        <Panel
          title="Activity"
          description="Lead touchpoints and follow-ups."
          action={<Toolbar><ActionButton icon="activity" onClick={() => setActivityModal(true)}>Log Activity</ActionButton></Toolbar>}
        >
          <DataTable columns={[{ key: "ActivityDate", label: "Date", render: row => pageDate(row.ActivityDate) }, { key: "ActivityType", label: "Type" }, { key: "Outcome", label: "Outcome" }, { key: "Notes", label: "Notes" }, { key: "NextStep", label: "Next Step" }]} rows={activities} />
        </Panel>
      )}

      {editModal && (
        <DataDialog
          open={editModal}
          onClose={() => setEditModal(false)}
          title="Edit lead"
          subtitle="Qualification, status, estimated value, products, and services."
          fields={[
            { key: "AccountName", label: "Account Name" },
            { key: "ContactName", label: "Contact Name" },
            { key: "CustomerNumber", label: "Customer Number" },
            { key: "Qualification", label: "Qualification" },
            { key: "Status", label: "Status" },
            { key: "EstimatedValue", label: "Estimated Value" },
            { key: "ProductInterest", label: "Product Interest" },
            { key: "ServiceNeedsJson", label: "Service Needs", type: "textarea" },
            { key: "CustomerInfoJson", label: "Customer Info", type: "textarea" },
            { key: "Notes", label: "Notes", type: "textarea" }
          ]}
          values={{
            ...lead,
            ServiceNeedsJson: textArray(lead.ServiceNeedsJson),
            CustomerInfoJson: JSON.stringify(parseJsonField(lead.CustomerInfoJson, {}), null, 2)
          }}
          onSave={async values => {
            await updateLead(id, {
              ...values,
              serviceNeeds: parseTextArray(values.ServiceNeedsJson),
              customerInfo: parseJsonField(values.CustomerInfoJson, {}),
            });
            setLead(await getLead(id));
            showToast("Lead updated");
            setEditModal(false);
          }}
        />
      )}

      {activityModal && <ActivityModal context={{ type: "lead" }} onClose={() => setActivityModal(false)} onSave={async values => { await createLeadActivity(id, values); setActivities(await listLeadActivities(id)); showToast("Lead activity logged"); setActivityModal(false); }} />}
      {convertModal && <LeadConvertModal lead={lead} onClose={() => setConvertModal(false)} onSave={async values => { await convertLead(id, values); showToast("Lead converted"); setConvertModal(false); setRoute("sales"); }} />}
      {closeModal && (
        <LeadCloseModal
          onClose={() => setCloseModal(false)}
          onSave={async status => {
            await updateLead(id, { status, qualification: status });
            const updated = await getLead(id);
            setLead(updated);
            showToast(`Lead marked ${status}`);
            setCloseModal(false);
            setRoute("sales");
          }}
        />
      )}
    </>
  );
}

export function SalesOpportunityDetail({ id, setRoute, showToast }) {
  const [opportunity, setOpportunity] = useState(null);
  const [products, setProducts] = useState([]);
  const [notes, setNotes] = useState([]);
  const [quoteRows, setQuoteRows] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [billingProducts, setBillingProducts] = useState([]);
  const [billingHierarchy, setBillingHierarchy] = useState([]);
  const [billingCodes, setBillingCodes] = useState([]);
  const [billingElements, setBillingElements] = useState([]);
  const [offers, setOffers] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [ratePlans, setRatePlans] = useState([]);
  const [tab, setTab] = useState("Overview");
  const [editModal, setEditModal] = useState(false);
  const [activityModal, setActivityModal] = useState(false);
  const [productModal, setProductModal] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [noteModal, setNoteModal] = useState(null);
  const [quoteModal, setQuoteModal] = useState(false);
  const [quoteMode, setQuoteMode] = useState("Custom");
  const [serviceabilityModal, setServiceabilityModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);

  useEffect(() => {
    getOpportunity(id).then(setOpportunity);
    listOpportunityProducts(id).then(setProducts);
    listOpportunityNotes(id).then(setNotes);
    listQuotes().then(rows => setQuoteRows(rows.filter(row => String(row.OpportunityId) === String(id))));
    listContracts().then(rows => setContracts(rows.filter(row => String(row.OpportunityId) === String(id))));
    listBillingProducts().then(setBillingProducts);
    listBillingProductHierarchy().then(setBillingHierarchy);
    listBillingCodes().then(setBillingCodes);
    listBillingElements().then(setBillingElements);
    listOffers().then(setOffers);
    listPromotions().then(setPromotions);
    listRatePlans().then(setRatePlans);
  }, [id]);

  const hierarchyRows = products.map(product => {
    const billingProduct = billingProducts.find(item => item.ProductName === product.ProductName || item.BillingCode === product.BillingCode);
    const billingCode = billingCodes.find(item => item.Code === product.BillingCode);
    const billingElement = billingElements.find(item => String(item.BillingCode) === String(product.BillingCode) || String(item.BillingCode) === String(billingCode?.Code));
    return {
      ...product,
      productType: billingProduct?.Category || billingProduct?.ServiceCategory || "Service",
      billingName: billingCode?.Description || billingElement?.ElementName || "Billing reference",
      totalValue: Number(product.Mrc || 0) + Number(product.Nrc || 0)
    };
  });
  const activityRows = notes.filter(item => String(item.NoteType || "").toLowerCase() === "activity");
  const generalNotes = notes.filter(item => String(item.NoteType || "").toLowerCase() !== "activity");

  if (!opportunity) {
    return (
      <div className="content-shell">
        <PageHeader title="Opportunity" description="Loading opportunity from Azure SQL..." />
        <Panel title="Loading opportunity workspace" description="The page frame is ready while the record loads.">
          <LoadingBars rows={4} />
        </Panel>
      </div>
    );
  }

  return (
    <>
      <RecordHeader
        breadcrumb={["Sales", "Opportunities", opportunity.OpportunityNumber]}
        title={opportunity.OpportunityName}
        status={opportunity.Stage}
        subtitle={`${opportunity.AccountNameResolved || opportunity.AccountName} · ${money(opportunity.EstimatedValue)} · ${opportunity.OwnerName}`}
        actions={<div className="module-toolbar sales-header-actions"><ActionButton icon="workflow" onClick={() => detailBack(setRoute)}>Back</ActionButton><ActionButton icon="close" onClick={() => setCloseModal(true)}>Close</ActionButton><ActionButton icon="orders" onClick={() => setRoute("orders")}>Order</ActionButton></div>}
      />
      <SummaryStrip items={[
        { label: "Account", value: opportunity.AccountNameResolved || opportunity.AccountName, note: opportunity.AccountNumberResolved || opportunity.AccountNumber },
        { label: "Stage", value: opportunity.Stage, note: opportunity.ApprovalStatus || "Open" },
        { label: "Products", value: products.length, note: "Selected services" },
        { label: "Quotes", value: quoteRows.length, note: "Linked quotes" }
      ]} />
      <Tabs tabs={opportunityTabs} active={tab} onChange={setTab} />
      {tab === "Overview" && (
        <Panel
          title="Opportunity overview"
          description="SQL-backed opportunity record."
          action={<Toolbar><ActionButton icon="workflow" onClick={() => setEditModal(true)}>Edit</ActionButton></Toolbar>}
        >
          <div className="sales-overview-grid">
            <div className="sales-overview-main">
              <div className="sales-overview-hero">
                <div className="sales-overview-hero-copy">
                  <span>Commercial snapshot</span>
                  <h3>{opportunity.AccountNameResolved || opportunity.AccountName}</h3>
                  <p>{opportunity.ServiceSummary || opportunity.ProductSummary || "Opportunity summary captured in Azure SQL."}</p>
                </div>
                <div className="sales-overview-hero-stats">
                  <div>
                    <span>Stage</span>
                    <strong>{opportunity.Stage}</strong>
                  </div>
                  <div>
                    <span>Value</span>
                    <strong>{money(opportunity.EstimatedValue)}</strong>
                  </div>
                  <div>
                    <span>Margin</span>
                    <strong>{`${Number(opportunity.MarginPct || 0).toFixed(1)}%`}</strong>
                  </div>
                  <div>
                    <span>Approval</span>
                    <strong>{opportunity.ApprovalStatus || "Draft"}</strong>
                  </div>
                </div>
              </div>
              <div className="sales-overview-grid-columns">
                <div className="sales-overview-card">
                  <span>Account</span>
                  <strong>{opportunity.AccountNameResolved || opportunity.AccountName}</strong>
                  <small>{opportunity.AccountNumberResolved || opportunity.AccountNumber}</small>
                </div>
                <div className="sales-overview-card">
                  <span>Owner</span>
                  <strong>{opportunity.OwnerName}</strong>
                  <small>{opportunity.CloseDate ? pageDate(opportunity.CloseDate) : "No close date"}</small>
                </div>
                <div className="sales-overview-card">
                  <span>Serviceability</span>
                  <strong>{opportunity.ServiceSummary || "Review"}</strong>
                  <small>{opportunity.LocationCount || 0} locations</small>
                </div>
                <div className="sales-overview-card">
                  <span>Linked Quote</span>
                  <strong>{quoteRows[0]?.QuoteNumber || "None"}</strong>
                  <small>{quoteRows[0]?.ApprovalStatus || "No quote yet"}</small>
                </div>
              </div>
            </div>
            <div className="sales-overview-side">
              <div className="sales-overview-card sales-overview-note">
                <span>Recent notes</span>
                <strong>{generalNotes[0]?.NoteType || "Notes"}</strong>
                <p>{generalNotes[0]?.Note || "No notes captured yet."}</p>
              </div>
              <div className="sales-overview-card sales-overview-note">
                <span>Recent activity</span>
                <strong>{activityRows[0]?.ActivityType || "Activity"}</strong>
                <p>{activityRows[0]?.Notes || "No activity logged yet."}</p>
              </div>
            </div>
          </div>
        </Panel>
      )}
      {tab === "Products/Services" && (
        <Panel
          title="Products and services"
          description="Add, edit, or remove products and services."
          action={<Toolbar><ActionButton icon="products" onClick={() => { setSelectedProduct(null); setProductModal(true); }}>Add Service</ActionButton></Toolbar>}
        >
          <DataTable columns={[{ key: "ProductName", label: "Product" }, { key: "BillingCode", label: "Billing Code" }, { key: "Quantity", label: "Qty" }, { key: "Mrc", label: "MRC", render: row => money(row.Mrc) }, { key: "Nrc", label: "NRC", render: row => money(row.Nrc) }, { key: "Cost", label: "Cost", render: row => money(row.Cost) }, { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => { setSelectedProduct(row); setProductModal(true); }}>Edit</button><button className="link-button compact-action" type="button" onClick={async () => { await deleteOpportunityProduct(id, row.OpportunityProductId); setProducts(await listOpportunityProducts(id)); showToast("Service removed"); }}>Remove</button></div> }]} rows={products} />
        </Panel>
      )}
      {tab === "Pricing" && (
        <>
          <Panel title="Pricing" description="Pricing inputs, hierarchy, and reference billing data." action={<Toolbar><ActionButton icon="service" onClick={() => setServiceabilityModal(true)}>Run Address Check</ActionButton></Toolbar>}>
            <div className="sales-pricing-grid">
              <div className="sales-pricing-card">
                <span>Pricing summary</span>
                <strong>{money(opportunity.EstimatedValue)}</strong>
                <small>{`${Number(opportunity.MarginPct || 0).toFixed(1)}% margin · ${opportunity.LocationCount || 0} locations`}</small>
              </div>
              <div className="sales-pricing-card">
                <span>Billing codes</span>
                <strong>{billingCodes.length}</strong>
                <small>{billingElements.length} billing elements</small>
              </div>
              <div className="sales-pricing-card">
                <span>Offers / Promotions</span>
                <strong>{offers.length}</strong>
                <small>{promotions.length} promotions · {ratePlans.length} rate plans</small>
              </div>
              <div className="sales-pricing-card">
                <span>Serviceability</span>
                <strong>{opportunity.ServiceSummary || "Review"}</strong>
                <small>Use serviceability checks for address qualification.</small>
              </div>
            </div>
          </Panel>
          <Panel title="Product hierarchy" description="Reference hierarchy from billing data and opportunity services.">
            <div className="sales-pivot-table">
              <div className="sales-pivot-head">
                <span>Product Type</span>
                <span>Product</span>
                <span>Billing Code</span>
                <span>Billing Name</span>
                <span>Quantity</span>
                <span>Total Price</span>
                <span>Actions</span>
              </div>
              {hierarchyRows.length ? hierarchyRows.map(row => (
                <div key={`${row.OpportunityProductId}-${row.ProductName}`} className="sales-pivot-row">
                  <div className="pivot-cell pivot-emphasis">{row.productType}</div>
                  <div className="pivot-cell">
                    <strong>{row.ProductName}</strong>
                    <small>{row.ServiceId ? "Service linked" : "Opportunity product"}</small>
                  </div>
                  <div className="pivot-cell">{row.BillingCode}</div>
                  <div className="pivot-cell">{row.billingName}</div>
                  <div className="pivot-cell">{row.Quantity}</div>
                  <div className="pivot-cell">{money(row.totalValue)}</div>
                  <div className="pivot-cell pivot-actions">
                    <ActionButton className="link-button compact-action" icon="pricing" onClick={() => { setQuoteMode("dynamic"); setQuoteModal(true); }}>Dynamic Pricing</ActionButton>
                    <ActionButton className="link-button compact-action" icon="workflow" onClick={() => { setQuoteMode("custom"); setQuoteModal(true); }}>Custom Quote</ActionButton>
                  </div>
                </div>
              )) : <div className="empty-state">Add products and services to build the hierarchy.</div>}
            </div>
          </Panel>
        </>
      )}
      {tab === "Quotes" && <Panel title="Quotes" description="Quotes generated from this opportunity."><DataTable columns={[{ key: "QuoteNumber", label: "Quote" }, { key: "Status", label: "Status" }, { key: "TotalMrc", label: "MRC", render: row => money(row.TotalMrc) }, { key: "ApprovalStatus", label: "Approval" }, { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/quote/${row.QuoteId}`)}>Open Quote</button></div> }]} rows={quoteRows} /></Panel>}
      {tab === "Activity" && <Panel title="Activity" description="Opportunity call logs and follow-ups." action={<Toolbar><ActionButton icon="activity" onClick={() => setActivityModal(true)}>Log Activity</ActionButton></Toolbar>}><DataTable columns={[{ key: "ActivityDate", label: "Date", render: row => pageDate(row.CreatedAtUtc || row.ActivityDate) }, { key: "ActivityType", label: "Type", render: row => row.NoteType === "Activity" ? "Activity" : row.NoteType }, { key: "Outcome", label: "Outcome", render: row => row.NoteType === "Activity" ? "Logged" : "" }, { key: "Notes", label: "Notes", render: row => row.Note || row.Notes }, { key: "CreatedBy", label: "Created By" }]} rows={activityRows} /></Panel>}
      {tab === "Notes" && <Panel title="Notes" description="Opportunity notes and follow-up details." action={<Toolbar><ActionButton icon="workflow" onClick={() => setNoteModal({ noteType: "General" })}>Add Note</ActionButton></Toolbar>}><DataTable columns={[{ key: "NoteType", label: "Type" }, { key: "Note", label: "Note" }, { key: "CreatedBy", label: "Created By" }, { key: "CreatedAtUtc", label: "Created" }]} rows={generalNotes} /></Panel>}
      {tab === "Approvals" && <Panel title="Approvals" description="Approval routing is view-only by default."><DataTable columns={[{ key: "step", label: "Step" }, { key: "status", label: "Status" }, { key: "owner", label: "Owner" }]} rows={[{ id: 1, step: "Pricing", status: opportunity.ApprovalStatus || "Draft", owner: opportunity.OwnerName }, { id: 2, step: "Sales Manager", status: "Pending", owner: "Sales Manager" }, { id: 3, step: "Finance", status: "Pending", owner: "Finance" }]} /></Panel>}
      {tab === "Contracts" && <Panel title="Contracts" description="Contracts generated from approved quotes."><DataTable columns={[{ key: "ContractNumber", label: "Contract" }, { key: "Status", label: "Status" }, { key: "ContractName", label: "Name" }, { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/contract/${row.ContractId}`)}>Open Contract</button><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/quote/${row.QuoteId}`)}>Open Quote</button></div> }]} rows={contracts} /></Panel>}

      {editModal && (
        <DataDialog
          open={editModal}
          onClose={() => setEditModal(false)}
          title="Edit opportunity"
          subtitle="Update details, products, and customer context."
          fields={[
            { key: "OpportunityName", label: "Opportunity Name" },
            { key: "OwnerName", label: "Owner" },
            { key: "Stage", label: "Stage", type: "select", options: stages },
            { key: "EstimatedValue", label: "Estimated Value" },
            { key: "ProductSummary", label: "Product Summary" },
            { key: "ServiceSummary", label: "Service Summary" }
          ]}
          values={opportunity}
          onSave={async values => { await updateOpportunity(id, values); setOpportunity(await getOpportunity(id)); showToast("Opportunity updated"); setEditModal(false); }}
        />
      )}
      {productModal && (
        <DataDialog
          open={Boolean(productModal)}
          onClose={() => { setProductModal(null); setSelectedProduct(null); }}
          title={selectedProduct ? "Edit service" : "Add service"}
          subtitle="Attach product and billing details to the opportunity."
          fields={[
            { key: "productName", label: "Product Name" },
            { key: "billingCode", label: "Billing Code", type: "select", options: billingCodes.map(item => item.Code).filter(Boolean) },
            { key: "quantity", label: "Quantity" },
            { key: "mrc", label: "MRC" },
            { key: "nrc", label: "NRC" },
            { key: "cost", label: "Cost" },
            { key: "marginPct", label: "Margin %" }
          ]}
          values={selectedProduct ? {
            productName: selectedProduct.ProductName,
            billingCode: selectedProduct.BillingCode,
            quantity: selectedProduct.Quantity,
            mrc: selectedProduct.Mrc,
            nrc: selectedProduct.Nrc,
            cost: selectedProduct.Cost,
            marginPct: selectedProduct.MarginPct
          } : { productName: "", billingCode: billingCodes[0]?.Code || "", quantity: 1, mrc: 0, nrc: 0, cost: 0, marginPct: opportunity.MarginPct || 30 }}
          onSave={async values => {
            if (selectedProduct) {
              await updateOpportunityProduct(id, selectedProduct.OpportunityProductId, values);
            } else {
              await createOpportunityProduct(id, values);
            }
            setProducts(await listOpportunityProducts(id));
            showToast(selectedProduct ? "Service updated" : "Service added");
            setProductModal(null);
            setSelectedProduct(null);
          }}
        />
      )}
      {noteModal && (
        <DataDialog
          open={Boolean(noteModal)}
          onClose={() => setNoteModal(null)}
          title={noteModal.noteType === "Activity" ? "Log activity" : "Add note"}
          subtitle="Persist notes and call activity to Azure SQL."
          fields={[
            { key: "noteType", label: "Type", type: "select", options: ["General", "Activity", "Pricing", "Approval", "Customer"] },
            { key: "note", label: "Note", type: "textarea" },
            { key: "createdBy", label: "Created By" }
          ]}
          values={{ noteType: noteModal.noteType || "General", note: "", createdBy: "Admin" }}
          onSave={async values => {
            const payload = {
              noteType: values.noteType,
              note: values.note,
              createdBy: values.createdBy
            };
            await createOpportunityNote(id, payload);
            setNotes(await listOpportunityNotes(id));
            showToast("Note saved");
            setNoteModal(null);
          }}
        />
      )}
      {quoteModal && (
        <DataDialog
          open={quoteModal}
          onClose={() => setQuoteModal(false)}
          title={quoteMode === "dynamic" ? "Dynamic pricing" : "Custom quote"}
          subtitle={quoteMode === "dynamic" ? "Reprice the selected services and persist the result." : "Create a quote from the current opportunity services."}
          fields={[
            { key: "quoteNumber", label: "Quote Number" },
            { key: "targetMarginPct", label: "Target Margin" },
            { key: "manualAdjustmentPct", label: "Manual Adjustment" }
          ]}
          values={{ targetMarginPct: opportunity.MarginPct || 30, manualAdjustmentPct: 0 }}
          onSave={async values => {
            await createQuote({ opportunityId: id, lineItems: products.map(item => ({ productName: item.ProductName, billingCode: item.BillingCode, quantity: item.Quantity, mrc: item.Mrc, nrc: item.Nrc, cost: item.Cost, marginPct: item.MarginPct })), pricingInput: values });
            showToast("Quote created");
            setQuoteModal(false);
            setTab("Quotes");
          }}
        />
      )}
      {closeModal && (
        <OpportunityCloseModal
          onClose={() => setCloseModal(false)}
          onSave={async status => {
            await updateOpportunity(id, { status, stage: status, approvalStatus: status });
            const updated = await getOpportunity(id);
            setOpportunity(updated);
            showToast(`Opportunity marked ${status}`);
            setCloseModal(false);
            setRoute("sales");
          }}
        />
      )}
      {serviceabilityModal && (
        <DataDialog
          open={serviceabilityModal}
          onClose={() => setServiceabilityModal(false)}
          title="Run address check"
          subtitle="Store serviceability check results in Azure SQL."
          fields={[
            { key: "locationName", label: "Location Name" },
            { key: "addressLine1", label: "Address" },
            { key: "city", label: "City" },
            { key: "stateProvince", label: "State" },
            { key: "postalCode", label: "Postal Code" }
          ]}
          values={{ locationName: "Primary Site", city: opportunity.Region, stateProvince: "IL", postalCode: "" }}
          onSave={async values => { await checkServiceability({ opportunityId: id, customerNumber: opportunity.AccountNumberResolved || opportunity.AccountNumber, ...values }); showToast("Serviceability checked"); setServiceabilityModal(false); }}
        />
      )}
      {activityModal && (
        <ActivityModal
          context={{ type: "opportunity" }}
          onClose={() => setActivityModal(false)}
          onSave={async values => {
            await createOpportunityNote(id, {
              noteType: "Activity",
              note: `${values.activityType} | Outcome: ${values.outcome} | ${values.notes}${values.nextStep ? ` | Next step: ${values.nextStep}` : ""}`,
              createdBy: "Admin"
            });
            setNotes(await listOpportunityNotes(id));
            showToast("Activity logged");
            setActivityModal(false);
          }}
        />
      )}
    </>
  );
}

export function SalesQuoteDetail({ id, setRoute, showToast }) {
  const [quote, setQuote] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [billingProducts, setBillingProducts] = useState([]);
  const [billingCodes, setBillingCodes] = useState([]);
  const [tab, setTab] = useState("Summary");
  const [editModal, setEditModal] = useState(false);
  const [priceModal, setPriceModal] = useState(false);
  const [approvalModal, setApprovalModal] = useState(false);
  const [contractModal, setContractModal] = useState(false);
  const [lineItemModal, setLineItemModal] = useState(null);
  const [selectedLineItem, setSelectedLineItem] = useState(null);

  useEffect(() => {
    getQuote(id).then(setQuote);
    listQuoteLineItems(id).then(setLineItems);
    listContracts().then(rows => setContracts(rows.filter(row => String(row.QuoteId) === String(id))));
    listBillingProducts().then(setBillingProducts);
    listBillingCodes().then(setBillingCodes);
  }, [id]);

  if (!quote) {
    return (
      <div className="content-shell">
        <PageHeader title="Quote" description="Loading quote from Azure SQL..." />
        <Panel title="Loading quote workspace" description="The page frame is ready while the record loads.">
          <LoadingBars rows={4} />
        </Panel>
      </div>
    );
  }

  return (
    <>
      <RecordHeader
        breadcrumb={["Sales", "Quotes", quote.QuoteNumber]}
        title={quote.AccountName}
        status={quote.ApprovalStatus}
        subtitle={`${quote.OpportunityName} · ${money(quote.TotalMrc)} MRC`}
        actions={<div className="module-toolbar"><button className="button" type="button" onClick={() => setPriceModal(true)}>Review</button><button className="button" type="button" onClick={() => setEditModal(true)}>Edit Quote</button><button className="button" type="button" onClick={() => setApprovalModal(true)}>Submit Approval</button><button className="button" type="button" onClick={() => setContractModal(true)}>Create Order</button></div>}
      />
      <SummaryStrip items={[
        { label: "Opportunity", value: quote.OpportunityName, note: quote.QuoteNumber },
        { label: "MRC", value: money(quote.TotalMrc), note: "SQL-backed quote" },
        { label: "Margin", value: `${Number(quote.MarginPct || 0).toFixed(1)}%`, note: `Discount ${Number(quote.DiscountPct || 0).toFixed(1)}%` },
        { label: "Line Items", value: lineItems.length, note: "Products and services" }
      ]} />
      <Tabs tabs={quoteTabs} active={tab} onChange={setTab} />
      {tab === "Summary" && <Panel title="Quote summary" description="Commercial quote details." action={<Toolbar><button className="button" type="button" onClick={() => setLineItemModal({})}>Add Line Item</button></Toolbar>}><DataTable columns={[{ key: "field", label: "Field" }, { key: "value", label: "Value" }]} rows={[{ id: 1, field: "Account", value: quote.AccountName }, { id: 2, field: "Opportunity", value: quote.OpportunityName }, { id: 3, field: "Status", value: quote.Status }, { id: 4, field: "Approval", value: quote.ApprovalStatus }]} /></Panel>}
      {tab === "Line Items" && <Panel title="Line items" description="Products and services pulled from the opportunity." action={<Toolbar><button className="button" type="button" onClick={() => { setSelectedLineItem(null); setLineItemModal({}); }}>Add Line Item</button></Toolbar>}><DataTable columns={[{ key: "ProductName", label: "Product" }, { key: "BillingCode", label: "Billing Code" }, { key: "Quantity", label: "Qty" }, { key: "Mrc", label: "MRC", render: row => money(row.Mrc) }, { key: "Nrc", label: "NRC", render: row => money(row.Nrc) }, { key: "Cost", label: "Cost", render: row => money(row.Cost) }, { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => { setSelectedLineItem(row); setLineItemModal(row); }}>Edit</button><button className="link-button compact-action" type="button" onClick={async () => { await deleteQuoteLineItem(id, row.QuoteLineItemId); setLineItems(await listQuoteLineItems(id)); showToast("Line item removed"); }}>Remove</button></div> }]} rows={lineItems} /></Panel>}
      {tab === "Pricing" && <Panel title="Pricing" description="Quote pricing and results."><div className="field-grid"><div className="mini-stat"><span>Total MRC</span><strong>{money(quote.TotalMrc)}</strong></div><div className="mini-stat"><span>Total NRC</span><strong>{money(quote.TotalNrc)}</strong></div><div className="mini-stat"><span>Margin</span><strong>{Number(quote.MarginPct || 0).toFixed(1)}%</strong></div><div className="mini-stat"><span>Approval</span><strong>{quote.ApprovalStatus}</strong></div></div><Panel title="Billing references" description="Products and codes for pricing decisions."><DataTable columns={[{ key: "ProductName", label: "Product" }, { key: "ProductCode", label: "Code" }, { key: "BillingCode", label: "Billing Code" }]} rows={billingProducts} /></Panel></Panel>}
      {tab === "Approvals" && <Panel title="Approvals" description="Approval route for this quote."><DataTable columns={[{ key: "step", label: "Step" }, { key: "status", label: "Status" }, { key: "owner", label: "Owner" }]} rows={[{ id: 1, step: "Pricing", status: quote.ApprovalStatus, owner: "Pricing Desk" }, { id: 2, step: "Finance", status: quote.ApprovalStatus === "Approved" ? "Approved" : "Pending", owner: "Finance" }]} /></Panel>}
      {tab === "Contract" && <Panel title="Contract" description="Contract generation after approval."><DataTable columns={[{ key: "ContractNumber", label: "Contract" }, { key: "Status", label: "Status" }, { key: "ContractName", label: "Name" }, { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/contract/${row.ContractId}`)}>Open Contract</button></div> }]} rows={contracts} /><p>If approved, the backend will create a contract record automatically. Use the Contracts tab to review files and history.</p></Panel>}

      {editModal && (
        <DataDialog
          open={editModal}
          onClose={() => setEditModal(false)}
          title="Edit quote"
          subtitle="Update quote pricing and status."
          fields={[
            { key: "Status", label: "Status" },
            { key: "MarginPct", label: "Margin %" },
            { key: "DiscountPct", label: "Discount %" },
            { key: "ManualAdjustmentPct", label: "Manual Adjustment %" }
          ]}
          values={quote}
          onSave={async values => { await updateQuote(id, values); setQuote(await getQuote(id)); showToast("Quote updated"); setEditModal(false); }}
        />
      )}
      {priceModal && (
        <DataDialog
          open={priceModal}
          onClose={() => setPriceModal(false)}
          title="Review pricing"
          subtitle="Recalculate pricing from the current line items."
          fields={[
            { key: "targetMarginPct", label: "Target Margin %" },
            { key: "manualAdjustmentPct", label: "Manual Adjustment %" },
            { key: "contractTermMonths", label: "Term (Months)" }
          ]}
          values={{ targetMarginPct: quote.MarginPct || 30, manualAdjustmentPct: quote.ManualAdjustmentPct || 0, contractTermMonths: 36 }}
          onSave={async values => {
            await priceQuote(id, { ...values, customerType: quote.AccountName });
            setQuote(await getQuote(id));
            showToast("Pricing updated");
            setPriceModal(false);
          }}
        />
      )}
      {approvalModal && (
        <Modal
          title="Submit approval"
          subtitle="Create an approval request for this quote."
          onClose={() => setApprovalModal(false)}
          actions={(
            <>
              <button className="button" type="button" onClick={async () => { await submitQuoteApproval(id, { requestedBy: "Admin" }); setQuote(await getQuote(id)); showToast("Approval submitted"); setApprovalModal(false); }}>Submit</button>
              <button className="ghost-button" type="button" onClick={() => setApprovalModal(false)}>Cancel</button>
            </>
          )}
        >
          <p>Approval will be stored in Azure SQL and linked to this quote.</p>
        </Modal>
      )}
      {contractModal && (
        <Modal
          title="Create order"
          subtitle="Begin entering order details."
          onClose={() => setContractModal(false)}
          actions={(
            <>
              <button className="button" type="button" onClick={() => { showToast("Order creation started"); setRoute("orders"); }}>Create</button>
              <button className="ghost-button" type="button" onClick={() => setContractModal(false)}>Cancel</button>
            </>
          )}
        >
          <p>This starts the order flow from the quote.</p>
        </Modal>
      )}
      {lineItemModal && (
        <DataDialog
          open={Boolean(lineItemModal)}
          onClose={() => { setLineItemModal(null); setSelectedLineItem(null); }}
          title={selectedLineItem ? "Edit line item" : "Add line item"}
          subtitle="Attach product, billing, and pricing detail to the quote."
          fields={[
            { key: "productName", label: "Product Name", type: "select", options: billingProducts.map(item => item.ProductName).filter(Boolean) },
            { key: "serviceName", label: "Service Name" },
            { key: "billingCode", label: "Billing Code", type: "select", options: billingCodes.map(item => item.Code).filter(Boolean) },
            { key: "lineType", label: "Line Type", type: "select", options: ["Recurring", "One-time", "Discount", "Tax", "Fee"] },
            { key: "quantity", label: "Quantity" },
            { key: "mrc", label: "MRC" },
            { key: "nrc", label: "NRC" },
            { key: "cost", label: "Cost" },
            { key: "marginPct", label: "Margin %" },
            { key: "discountPct", label: "Discount %" },
            { key: "notes", label: "Notes", type: "textarea" }
          ]}
          values={selectedLineItem ? {
            productName: selectedLineItem.ProductName,
            serviceName: selectedLineItem.ServiceName,
            billingCode: selectedLineItem.BillingCode,
            lineType: selectedLineItem.LineType,
            quantity: selectedLineItem.Quantity,
            mrc: selectedLineItem.Mrc,
            nrc: selectedLineItem.Nrc,
            cost: selectedLineItem.Cost,
            marginPct: selectedLineItem.MarginPct,
            discountPct: selectedLineItem.DiscountPct,
            notes: selectedLineItem.Notes
          } : {
            productName: billingProducts[0]?.ProductName || "",
            serviceName: "",
            billingCode: billingCodes[0]?.Code || "",
            lineType: "Recurring",
            quantity: 1,
            mrc: 0,
            nrc: 0,
            cost: 0,
            marginPct: quote.MarginPct || 30,
            discountPct: quote.DiscountPct || 0,
            notes: ""
          }}
          onSave={async values => {
            if (selectedLineItem) {
              await updateQuoteLineItem(id, selectedLineItem.QuoteLineItemId, values);
            } else {
              await createQuoteLineItem(id, values);
            }
            setLineItems(await listQuoteLineItems(id));
            showToast(selectedLineItem ? "Line item updated" : "Line item added");
            setLineItemModal(null);
            setSelectedLineItem(null);
          }}
        />
      )}
    </>
  );
}

export function SalesContractDetail({ id, setRoute, showToast }) {
  const [contract, setContract] = useState(null);
  const [files, setFiles] = useState([]);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState("Overview");
  const [editModal, setEditModal] = useState(false);
  const [fileModal, setFileModal] = useState(false);

  useEffect(() => {
    getContract(id).then(setContract);
    listContractFiles(id).then(setFiles);
    listContractHistory(id).then(setHistory);
  }, [id]);

  if (!contract) {
    return (
      <div className="content-shell">
        <PageHeader title="Contract" description="Loading contract from Azure SQL..." />
        <Panel title="Loading contract workspace" description="The page frame is ready while the record loads.">
          <LoadingBars rows={4} />
        </Panel>
      </div>
    );
  }

  return (
    <>
      <RecordHeader
        breadcrumb={["Sales", "Contracts", contract.ContractNumber]}
        title={contract.ContractName}
        status={contract.Status}
        subtitle={`${contract.AccountName || contract.OpportunityName || "Contract"} · ${contract.QuoteNumber || "No quote"} · ${contract.ContractNumber}`}
        actions={<div className="module-toolbar"><button className="button" type="button" onClick={() => setFileModal(true)}>Upload File</button><button className="button" type="button" onClick={() => setEditModal(true)}>Edit Details</button><button className="button" type="button" onClick={() => contract.OpportunityId && setRoute(`details/opportunity/${contract.OpportunityId}`)}>Open Opportunity</button><button className="button" type="button" onClick={() => contract.QuoteId && setRoute(`details/quote/${contract.QuoteId}`)}>Open Quote</button></div>}
      />
      <SummaryStrip items={[
        { label: "Opportunity", value: contract.OpportunityName || "N/A", note: contract.OpportunityNumber || contract.OpportunityId },
        { label: "Quote", value: contract.QuoteNumber || "N/A", note: contract.Status },
        { label: "Files", value: files.length, note: "Uploaded metadata" },
        { label: "History", value: history.length, note: "Tracked events" }
      ]} />
      <Tabs tabs={contractTabs} active={tab} onChange={setTab} />
      {tab === "Overview" && (
        <Panel title="Contract overview" description="Linked commercial records and contract terms.">
          <div className="field-grid">
            <div className="mini-stat"><span>Account</span><strong>{contract.AccountName || "N/A"}</strong><small>Azure SQL contract</small></div>
            <div className="mini-stat"><span>Opportunity</span><strong>{contract.OpportunityName || "N/A"}</strong><small>{contract.FileCount || 0} files</small></div>
            <div className="mini-stat"><span>Quote</span><strong>{contract.QuoteNumber || "N/A"}</strong><small>{contract.Status}</small></div>
            <div className="mini-stat"><span>Signed</span><strong>{pageDate(contract.SignedDate) || "Pending"}</strong><small>{contract.ContractNumber}</small></div>
          </div>
        </Panel>
      )}
      {tab === "Files" && (
        <Panel title="Contract files" description="Upload and remove contract file metadata." action={<Toolbar><button className="button" type="button" onClick={() => setFileModal(true)}>Upload File</button></Toolbar>}>
          <DataTable columns={[
            { key: "FileName", label: "File" },
            { key: "FileType", label: "Type" },
            { key: "StorageUrl", label: "Storage URL" },
            { key: "CreatedAtUtc", label: "Uploaded" },
            { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => row.StorageUrl && window.open(row.StorageUrl, "_blank", "noopener,noreferrer")}>Open</button><button className="link-button compact-action" type="button" onClick={async () => { await deleteContractFile(id, row.ContractFileId); setFiles(await listContractFiles(id)); showToast("File metadata removed"); }}>Remove</button></div> }
          ]} rows={files} />
        </Panel>
      )}
      {tab === "History" && (
        <Panel title="Contract history" description="Audit trail for contract activity.">
          <DataTable columns={[
            { key: "EventType", label: "Event" },
            { key: "Notes", label: "Notes" },
            { key: "CreatedBy", label: "Created By" },
            { key: "CreatedAtUtc", label: "Created" }
          ]} rows={history} />
        </Panel>
      )}
      {tab === "Terms" && (
        <Panel title="Terms" description="Contract terms stored in Azure SQL.">
          <pre className="code-block">{JSON.stringify(parseJsonField(contract.TermsJson, {}), null, 2)}</pre>
        </Panel>
      )}
      {editModal && (
        <DataDialog
          open={editModal}
          onClose={() => setEditModal(false)}
          title="Edit contract"
          subtitle="Update contract name, status, and terms."
          fields={[
            { key: "ContractName", label: "Contract Name" },
            { key: "Status", label: "Status" },
            { key: "OpportunityId", label: "Opportunity ID" },
            { key: "QuoteId", label: "Quote ID" },
            { key: "SignedDate", label: "Signed Date" },
            { key: "TermsJson", label: "Terms", type: "textarea" }
          ]}
          values={{
            ...contract,
            TermsJson: JSON.stringify(parseJsonField(contract.TermsJson, {}), null, 2)
          }}
          onSave={async values => {
            await updateContract(id, {
              ...values,
              terms: parseJsonField(values.TermsJson, {})
            });
            setContract(await getContract(id));
            showToast("Contract updated");
            setEditModal(false);
          }}
        />
      )}
      {fileModal && (
        <DataDialog
          open={fileModal}
          onClose={() => setFileModal(false)}
          title="Upload contract file metadata"
          subtitle="Store file metadata now; document storage can be wired later."
          fields={[
            { key: "fileName", label: "File Name" },
            { key: "fileType", label: "File Type" },
            { key: "storageUrl", label: "Storage URL" },
            { key: "fileSizeBytes", label: "File Size (Bytes)" },
            { key: "notes", label: "Notes", type: "textarea" }
          ]}
          values={{ fileName: "Contract.pdf", fileType: "application/pdf", storageUrl: "", fileSizeBytes: 0, notes: "" }}
          onSave={async values => {
            await createContractFile(id, values);
            setFiles(await listContractFiles(id));
            setHistory(await listContractHistory(id));
            showToast("File metadata saved");
            setFileModal(false);
          }}
        />
      )}
    </>
  );
}
