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
  convertLead,
  deleteLead,
  deleteOpportunity,
  deleteOpportunityProduct,
  deleteCustomPricing,
  deleteQuoteLineItem,
  getLead,
  getOpportunity,
  getQuote,
  listApprovals,
  listBillingCustomers,
  listContracts,
  listCustomPricing,
  listLeads,
  listLeadActivities,
  listOpportunities,
  listOpportunityNotes,
  listOpportunityProducts,
  listQuoteLineItems,
  priceQuote,
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
  listQuotes
} from "../utils/salesApi";

const salesTabs = ["Leads", "Opportunities", "Accounts", "Custom Pricing", "Approvals", "Contracts"];
const opportunityTabs = ["Overview", "Products/Services", "Pricing", "Quotes", "Activity/Notes", "Approvals", "Contracts"];
const quoteTabs = ["Summary", "Line Items", "Pricing", "Approvals", "Contract"];
const leadTabs = ["Qualification", "Customer Info", "Activity"];

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
    <div className="record-tabs" role="tablist">
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

function Toolbar({ children }) {
  return <div className="module-toolbar sales-tab-toolbar">{children}</div>;
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
    dashboard: {}
  });

  async function refresh() {
    try {
      setState(current => ({ ...current, loading: true, error: "" }));
      const responses = await Promise.allSettled([
        getSalesDashboard(),
        listLeads(),
        listAccounts(),
        listOpportunities(),
        listQuotes(),
        listCustomPricing(),
        listApprovals(),
        listContracts(),
        listBillingCustomers()
      ]);
      const [dashboardResult, leadsResult, accountsResult, opportunitiesResult, quotesResult, customPricingResult, approvalsResult, contractsResult, billingCustomersResult] = responses;
      const warnings = responses
        .map((result, index) => {
          if (result.status === "fulfilled") return "";
          const labels = ["dashboard", "leads", "accounts", "opportunities", "quotes", "custom pricing", "approvals", "contracts", "billing customers"];
          return `Could not load ${labels[index]} (${result.reason?.message || "request failed"})`;
        })
        .filter(Boolean);
      setState({
        loading: false,
        error: "",
        warnings,
        dashboard: dashboardResult.status === "fulfilled" ? dashboardResult.value : {},
        leads: leadsResult.status === "fulfilled" ? leadsResult.value : [],
        accounts: accountsResult.status === "fulfilled" ? accountsResult.value : [],
        opportunities: opportunitiesResult.status === "fulfilled" ? opportunitiesResult.value : [],
        quotes: quotesResult.status === "fulfilled" ? quotesResult.value : [],
        customPricing: customPricingResult.status === "fulfilled" ? customPricingResult.value : [],
        approvals: approvalsResult.status === "fulfilled" ? approvalsResult.value : [],
        contracts: contractsResult.status === "fulfilled" ? contractsResult.value : [],
        billingCustomers: billingCustomersResult.status === "fulfilled" ? billingCustomersResult.value : []
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
  const [tab, setTab] = useState("Leads");
  const [query, setQuery] = useState("");
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
  const [selectedContract, setSelectedContract] = useState(null);

  const leads = state.leads || [];
  const accounts = state.accounts || [];
  const opportunities = state.opportunities || [];
  const quotes = state.quotes || [];
  const customPricing = state.customPricing || [];
  const approvals = state.approvals || [];
  const contracts = state.contracts || [];
  const dashboard = state.dashboard || {};
  const warnings = state.warnings || [];

  const filteredLeads = leads.filter(item => matchAny(item, query, [r => fieldValue(r, "LeadNumber"), r => fieldValue(r, "AccountNameResolved", "AccountName"), r => fieldValue(r, "ProductInterest"), r => fieldValue(r, "OwnerName")]) && (stage === "All stages" || fieldValue(item, "Qualification", "Status") === stage));
  const filteredOpps = opportunities.filter(item => matchAny(item, query, [r => fieldValue(r, "OpportunityNumber"), r => fieldValue(r, "OpportunityName"), r => fieldValue(r, "AccountNameResolved"), r => fieldValue(r, "ProductSummary"), r => fieldValue(r, "OwnerName")]) && (stage === "All stages" || fieldValue(item, "Stage") === stage) && (owner === "All owners" || fieldValue(item, "OwnerName") === owner));
  const filteredAccounts = accounts.filter(item => matchAny(item, query, [r => fieldValue(r, "AccountNumber"), r => fieldValue(r, "AccountName"), r => fieldValue(r, "Segment"), r => fieldValue(r, "Region")]) && (segment === "All segments" || fieldValue(item, "Segment") === segment));
  const filteredQuotes = quotes.filter(item => matchAny(item, query, [r => fieldValue(r, "QuoteNumber"), r => fieldValue(r, "AccountName"), r => fieldValue(r, "OpportunityName")]) && (status === "All statuses" || fieldValue(item, "Status") === status));
  const filteredApprovals = approvals.filter(item => matchAny(item, query, [r => fieldValue(r, "EntityType"), r => fieldValue(r, "StepName"), r => fieldValue(r, "Status")]) && (status === "All statuses" || fieldValue(item, "Status") === status));
  const filteredContracts = contracts.filter(item => matchAny(item, query, [r => fieldValue(r, "ContractNumber"), r => fieldValue(r, "ContractName"), r => fieldValue(r, "AccountName"), r => fieldValue(r, "OpportunityName")]) && (status === "All statuses" || fieldValue(item, "Status") === status));

  if (state.loading) return <div className="content-shell"><PageHeader title="Sales" description="Loading database-backed sales data..." /></div>;

  if (state.error) {
    return <div className="content-shell"><PageHeader title="Sales" description="Unable to load sales data." /><Panel title="Error"><p>{state.error}</p></Panel></div>;
  }

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
    { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/quote/${row.QuoteId}`)}>Open Quote</button><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/opportunity/${row.OpportunityId}`)}>Open Opportunity</button><button className="link-button compact-action" type="button" onClick={() => setSelectedContract(row)}>Open Contract</button></div> }
  ];

  return (
    <>
      <PageHeader
        title="Sales"
        description="Database-backed telecom sales, pricing, approvals, and contracts."
        actions={<div className="module-toolbar"><button className="button" type="button" onClick={() => setNewLead(true)}>New Lead</button><button className="button" type="button" onClick={() => setNewOpportunity(true)}>New Opportunity</button></div>}
      />
      {warnings.length ? (
        <Panel title="Load warnings" description="Some supporting datasets could not be loaded, but the Sales module is available.">
          <ul className="warning-list">
            {warnings.map(warning => <li key={warning}>{warning}</li>)}
          </ul>
        </Panel>
      ) : null}
      <SummaryStrip items={[
        { label: "Pipeline", value: money(dashboard.PipelineValue || 0), note: "SQL-backed opportunities" },
        { label: "Quotes", value: quotes.length, note: "Pricing records" },
        { label: "Approvals", value: approvals.length, note: "Approval queue" },
        { label: "Contracts", value: contracts.length, note: "Active agreements" }
      ]} />
      <Tabs tabs={salesTabs} active={tab} onChange={setTab} />
      {tab === "Leads" && (
        <Panel title="Leads" description="Lead qualification, activities, and conversion." action={<Toolbar><SearchBox value={query} onChange={setQuery} placeholder="Search leads" /><label className="inline-search"><Icon name="workflow" className="button-icon" /><select value={stage} onChange={event => setStage(event.target.value)}>{["All stages", "Open", "Qualified", "Converted"].map(option => <option key={option}>{option}</option>)}</select></label></Toolbar>}>
          <SalesTable columns={leadColumns} rows={filteredLeads} />
        </Panel>
      )}
      {tab === "Opportunities" && (
        <Panel title="Opportunities" description="Opportunity detail, products, services, pricing, and approvals." action={<Toolbar><SearchBox value={query} onChange={setQuery} placeholder="Search opportunities" /><label className="inline-search"><Icon name="workflow" className="button-icon" /><select value={stage} onChange={event => setStage(event.target.value)}>{["All stages", ...stages].map(option => <option key={option}>{option}</option>)}</select></label><label className="inline-search"><Icon name="customers" className="button-icon" /><select value={owner} onChange={event => setOwner(event.target.value)}>{["All owners", ...owners].map(option => <option key={option}>{option}</option>)}</select></label></Toolbar>}>
          <SalesTable columns={oppColumns} rows={filteredOpps} />
        </Panel>
      )}
      {tab === "Accounts" && (
        <Panel title="Accounts" description="Customer records and account growth motions." action={<Toolbar><SearchBox value={query} onChange={setQuery} placeholder="Search accounts" /><label className="inline-search"><Icon name="workflow" className="button-icon" /><select value={segment} onChange={event => setSegment(event.target.value)}>{["All segments", "Enterprise", "SMB", "MidMarket"].map(option => <option key={option}>{option}</option>)}</select></label></Toolbar>}>
          <SalesTable columns={accountColumns} rows={filteredAccounts} />
        </Panel>
      )}
      {tab === "Custom Pricing" && (
        <Panel title="Custom Pricing" description="Review custom pricing requests and quote overrides." action={<Toolbar><button className="button" type="button" onClick={() => setSelectedCustomPricing({ Status: "Draft", RequestedBy: "Admin" })}>New Request</button><SearchBox value={query} onChange={setQuery} placeholder="Search custom pricing" /><label className="inline-search"><Icon name="workflow" className="button-icon" /><select value={status} onChange={event => setStatus(event.target.value)}>{["All statuses", "Draft", "Submitted", "Approved", "Rejected"].map(option => <option key={option}>{option}</option>)}</select></label></Toolbar>}>
          <SalesTable columns={[{ key: "RequestNumber", label: "Request" }, { key: "Status", label: "Status" }, { key: "RequestedBy", label: "Requested By" }, { key: "Reason", label: "Reason" }, { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/quote/${row.QuoteId || quotes[0]?.QuoteId}`)}>Review</button><button className="link-button compact-action" type="button" onClick={() => setSelectedCustomPricing(row)}>Edit</button><button className="link-button compact-action" type="button" onClick={async () => { await deleteCustomPricing(row.CustomPricingRequestId); refresh(); }}>Delete</button><button className="link-button compact-action" type="button" onClick={async () => { await submitCustomPricing(row.CustomPricingRequestId, { requestedBy: "Admin" }); refresh(); }}>Submit</button></div> }]} rows={customPricing.filter(row => matchAny(row, query, [r => fieldValue(r, "RequestNumber"), r => fieldValue(r, "Status"), r => fieldValue(r, "RequestedBy"), r => fieldValue(r, "Reason")]) && (status === "All statuses" || fieldValue(row, "Status") === status))} />
        </Panel>
      )}
      {tab === "Approvals" && (
        <Panel title="Approvals" description="Quote, pricing, and contract approvals." action={<Toolbar><SearchBox value={query} onChange={setQuery} placeholder="Search approvals" /><label className="inline-search"><Icon name="workflow" className="button-icon" /><select value={status} onChange={event => setStatus(event.target.value)}>{["All statuses", "Pending", "Approved", "Rejected", "Changes Requested"].map(option => <option key={option}>{option}</option>)}</select></label></Toolbar>}>
          <SalesTable columns={approvalColumns} rows={filteredApprovals} />
        </Panel>
      )}
      {tab === "Contracts" && (
        <Panel title="Contracts" description="Contract files, history, and linked commercial records." action={<Toolbar><SearchBox value={query} onChange={setQuery} placeholder="Search contracts" /><label className="inline-search"><Icon name="workflow" className="button-icon" /><select value={status} onChange={event => setStatus(event.target.value)}>{["All statuses", "Open", "Generated", "Review", "Ready"].map(option => <option key={option}>{option}</option>)}</select></label></Toolbar>}>
          <SalesTable columns={contractColumns} rows={filteredContracts} />
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
  const [values, setValues] = useState({ activityType: "Call", outcome: "Connected", notes: "", nextStep: "" });
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
        <label>Activity Type<select value={values.activityType} onChange={event => setValues(current => ({ ...current, activityType: event.target.value }))}><option>Call</option><option>Text</option><option>Email</option><option>Meeting</option></select></label>
        <label>Outcome<input value={values.outcome} onChange={event => setValues(current => ({ ...current, outcome: event.target.value }))} /></label>
        <label>Notes<textarea value={values.notes} onChange={event => setValues(current => ({ ...current, notes: event.target.value }))} /></label>
        <label>Next Step<input value={values.nextStep} onChange={event => setValues(current => ({ ...current, nextStep: event.target.value }))} /></label>
      </form>
    </Modal>
  );
}

export function SalesLeadDetail({ id, setRoute, showToast }) {
  const [lead, setLead] = useState(null);
  const [activities, setActivities] = useState([]);
  const [tab, setTab] = useState("Qualification");
  const [editModal, setEditModal] = useState(false);
  const [activityModal, setActivityModal] = useState(false);
  const [convertModal, setConvertModal] = useState(false);

  useEffect(() => {
    getLead(id).then(setLead);
    listLeadActivities(id).then(setActivities);
  }, [id]);

  if (!lead) return <Panel title="Loading lead..." description="Fetching from Azure SQL." />;

  return (
    <>
      <RecordHeader
        breadcrumb={["Sales", "Leads", lead.LeadNumber]}
        title={lead.AccountName}
        status={lead.Status}
        subtitle={`${lead.Source} · ${lead.ProductInterest} · ${money(lead.EstimatedValue)} · ${lead.OwnerName}`}
        actions={<div className="module-toolbar"><button className="button" type="button" onClick={() => setActivityModal(true)}>Log Activity</button><button className="button" type="button" onClick={() => setEditModal(true)}>Edit Lead</button><button className="button" type="button" onClick={() => setConvertModal(true)}>Convert</button></div>}
      />
      <SummaryStrip items={[
        { label: "Qualification", value: lead.Qualification || "Open", note: "Lead status" },
        { label: "Estimated Value", value: money(lead.EstimatedValue), note: lead.OwnerName },
        { label: "Service Needs", value: firstArray(lead.ServiceNeedsJson).join(", ") || lead.ProductInterest || "N/A", note: "SQL-backed lead" },
        { label: "Activity Count", value: activities.length, note: "Logged interactions" }
      ]} />
      <Tabs tabs={leadTabs} active={tab} onChange={setTab} />
      {tab === "Qualification" && <Panel title="Lead overview" description="Core lead details and general qualification status."><div className="field-grid"><div className="mini-stat"><span>Account</span><strong>{lead.AccountName}</strong><small>{lead.CustomerNumber}</small></div><div className="mini-stat"><span>Source</span><strong>{lead.Source}</strong><small>{lead.Qualification}</small></div><div className="mini-stat"><span>Interest</span><strong>{lead.ProductInterest}</strong><small>{firstArray(lead.ServiceNeedsJson).join(", ")}</small></div></div></Panel>}
      {tab === "Customer Info" && <Panel title="Customer information" description="General customer information and services that could be obtained."><DataTable columns={[{ key: "field", label: "Field" }, { key: "value", label: "Value" }]} rows={[{ id: 1, field: "Customer Number", value: lead.CustomerNumber }, { id: 2, field: "Customer Name", value: lead.CustomerName }, { id: 3, field: "Region", value: lead.Region }, { id: 4, field: "Billing Profile", value: lead.BillingProfile }, { id: 5, field: "Customer Type", value: lead.CustomerType }]} /></Panel>}
      {tab === "Activity" && <Panel title="Activity" description="Lead touchpoints and follow-ups."><DataTable columns={[{ key: "ActivityDate", label: "Date", render: row => pageDate(row.ActivityDate) }, { key: "ActivityType", label: "Type" }, { key: "Outcome", label: "Outcome" }, { key: "Notes", label: "Notes" }, { key: "NextStep", label: "Next Step" }]} rows={activities} /></Panel>}

      {editModal && (
        <DataDialog
          open={editModal}
          onClose={() => setEditModal(false)}
          title="Edit lead"
          subtitle="Qualification, status, estimated value, products, and services."
          fields={[
            { key: "AccountName", label: "Account Name" },
            { key: "Qualification", label: "Qualification" },
            { key: "Status", label: "Status" },
            { key: "EstimatedValue", label: "Estimated Value" },
            { key: "ProductInterest", label: "Product Interest" },
            { key: "Notes", label: "Notes", type: "textarea" }
          ]}
          values={lead}
          onSave={async values => {
            await updateLead(id, values);
            setLead(await getLead(id));
            showToast("Lead updated");
            setEditModal(false);
          }}
        />
      )}

      {activityModal && <ActivityModal context={{ type: "lead" }} onClose={() => setActivityModal(false)} onSave={async values => { await createLeadActivity(id, values); setActivities(await listLeadActivities(id)); showToast("Lead activity logged"); setActivityModal(false); }} />}
      {convertModal && <LeadConvertModal lead={lead} onClose={() => setConvertModal(false)} onSave={async values => { await convertLead(id, values); showToast("Lead converted"); setConvertModal(false); setRoute("sales"); }} />}
    </>
  );
}

export function SalesOpportunityDetail({ id, setRoute, showToast }) {
  const [opportunity, setOpportunity] = useState(null);
  const [products, setProducts] = useState([]);
  const [notes, setNotes] = useState([]);
  const [quoteRows, setQuoteRows] = useState([]);
  const [tab, setTab] = useState("Overview");
  const [editModal, setEditModal] = useState(false);
  const [activityModal, setActivityModal] = useState(false);
  const [productModal, setProductModal] = useState(false);
  const [noteModal, setNoteModal] = useState(false);
  const [quoteModal, setQuoteModal] = useState(false);
  const [serviceabilityModal, setServiceabilityModal] = useState(false);

  useEffect(() => {
    getOpportunity(id).then(setOpportunity);
    listOpportunityProducts(id).then(setProducts);
    listOpportunityNotes(id).then(setNotes);
    listQuotes().then(rows => setQuoteRows(rows.filter(row => row.OpportunityId === id)));
  }, [id]);

  if (!opportunity) return <Panel title="Loading opportunity..." description="Fetching from Azure SQL." />;

  return (
    <>
      <RecordHeader
        breadcrumb={["Sales", "Opportunities", opportunity.OpportunityNumber]}
        title={opportunity.OpportunityName}
        status={opportunity.Stage}
        subtitle={`${opportunity.AccountNameResolved || opportunity.AccountName} · ${money(opportunity.EstimatedValue)} · ${opportunity.OwnerName}`}
        actions={<div className="module-toolbar"><button className="button" type="button" onClick={() => setActivityModal(true)}>Log Activity</button><button className="button" type="button" onClick={() => setEditModal(true)}>Edit Details</button><button className="button" type="button" onClick={() => setProductModal(true)}>Add Service</button><button className="button" type="button" onClick={() => setQuoteModal(true)}>Generate Quote</button><button className="button" type="button" onClick={() => setServiceabilityModal(true)}>Run Address Check</button></div>}
      />
      <SummaryStrip items={[
        { label: "Account", value: opportunity.AccountNameResolved || opportunity.AccountName, note: opportunity.AccountNumberResolved || opportunity.AccountNumber },
        { label: "Stage", value: opportunity.Stage, note: opportunity.ApprovalStatus || "Open" },
        { label: "Products", value: products.length, note: "Selected services" },
        { label: "Quotes", value: quoteRows.length, note: "Linked quotes" }
      ]} />
      <Tabs tabs={opportunityTabs} active={tab} onChange={setTab} />
      {tab === "Overview" && <Panel title="Opportunity overview" description="SQL-backed opportunity record."><div className="field-grid"><div className="mini-stat"><span>Account</span><strong>{opportunity.AccountNameResolved || opportunity.AccountName}</strong><small>{opportunity.Region}</small></div><div className="mini-stat"><span>Stage</span><strong>{opportunity.Stage}</strong><small>{opportunity.Status}</small></div><div className="mini-stat"><span>Value</span><strong>{money(opportunity.EstimatedValue)}</strong><small>{opportunity.MarginPct}% margin</small></div></div></Panel>}
      {tab === "Products/Services" && <Panel title="Products and services" description="Add or remove products and services."><DataTable columns={[{ key: "ProductName", label: "Product" }, { key: "BillingCode", label: "Billing Code" }, { key: "Quantity", label: "Qty" }, { key: "Mrc", label: "MRC", render: row => money(row.Mrc) }, { key: "Nrc", label: "NRC", render: row => money(row.Nrc) }, { key: "Cost", label: "Cost", render: row => money(row.Cost) }, { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => deleteOpportunityProduct(id, row.OpportunityProductId).then(() => listOpportunityProducts(id).then(setProducts))}>Remove</button></div> }]} rows={products} /></Panel>}
      {tab === "Pricing" && <Panel title="Pricing" description="Pricing inputs and workflow."><DataTable columns={[{ key: "field", label: "Field" }, { key: "value", label: "Value" }]} rows={[{ id: 1, field: "Margin", value: `${opportunity.MarginPct || 0}%` }, { id: 2, field: "Serviceability", value: opportunity.ServiceSummary }, { id: 3, field: "Status", value: opportunity.ApprovalStatus }]} /></Panel>}
      {tab === "Quotes" && <Panel title="Quotes" description="Quotes generated from this opportunity."><DataTable columns={[{ key: "QuoteNumber", label: "Quote" }, { key: "Status", label: "Status" }, { key: "TotalMrc", label: "MRC", render: row => money(row.TotalMrc) }, { key: "ApprovalStatus", label: "Approval" }, { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/quote/${row.QuoteId}`)}>Open Quote</button></div> }]} rows={quoteRows} /></Panel>}
      {tab === "Activity/Notes" && <Panel title="Notes" description="Opportunity notes."><DataTable columns={[{ key: "NoteType", label: "Type" }, { key: "Note", label: "Note" }, { key: "CreatedBy", label: "Created By" }, { key: "CreatedAtUtc", label: "Created" }]} rows={notes} /></Panel>}
      {tab === "Approvals" && <Panel title="Approvals" description="Approval routing is view-only by default."><DataTable columns={[{ key: "step", label: "Step" }, { key: "status", label: "Status" }, { key: "owner", label: "Owner" }]} rows={[{ id: 1, step: "Pricing", status: opportunity.ApprovalStatus || "Draft", owner: opportunity.OwnerName }, { id: 2, step: "Sales Manager", status: "Pending", owner: "Sales Manager" }, { id: 3, step: "Finance", status: "Pending", owner: "Finance" }]} /></Panel>}
      {tab === "Contracts" && <Panel title="Contracts" description="Contracts generated from approved quotes."><DataTable columns={[{ key: "ContractNumber", label: "Contract" }, { key: "Status", label: "Status" }, { key: "ContractName", label: "Name" }, { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/quote/${row.QuoteId}`)}>Open Quote</button></div> }]} rows={[]} /></Panel>}

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
          open={productModal}
          onClose={() => setProductModal(false)}
          title="Add service"
          subtitle="Attach product/service to opportunity."
          fields={[
            { key: "productName", label: "Product Name" },
            { key: "billingCode", label: "Billing Code" },
            { key: "quantity", label: "Quantity" },
            { key: "mrc", label: "MRC" },
            { key: "nrc", label: "NRC" },
            { key: "cost", label: "Cost" }
          ]}
          values={{ productName: "", billingCode: "", quantity: 1, mrc: 0, nrc: 0, cost: 0 }}
          onSave={async values => { await createOpportunityProduct(id, values); setProducts(await listOpportunityProducts(id)); showToast("Service added"); setProductModal(false); }}
        />
      )}
      {noteModal && <></>}
      {quoteModal && (
        <DataDialog
          open={quoteModal}
          onClose={() => setQuoteModal(false)}
          title="Generate quote"
          subtitle="Create a quote with pricing from selected products and services."
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
      {selectedContract && (
        <Modal
          title={`Contract ${selectedContract.ContractNumber}`}
          subtitle="Open PDF of contract and related records."
          onClose={() => setSelectedContract(null)}
          actions={(
            <>
              <button className="button" type="button" onClick={() => { showToast("Contract PDF opened"); setSelectedContract(null); }}>Open PDF</button>
              <button className="ghost-button" type="button" onClick={() => setSelectedContract(null)}>Close</button>
            </>
          )}
        >
          <p>{selectedContract.ContractName}</p>
          <p>Opportunity: {selectedContract.OpportunityName}</p>
          <p>Quote: {selectedContract.QuoteNumber}</p>
          <p>Status: {selectedContract.Status}</p>
        </Modal>
      )}
    </>
  );
}

export function SalesQuoteDetail({ id, setRoute, showToast }) {
  const [quote, setQuote] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [tab, setTab] = useState("Summary");
  const [editModal, setEditModal] = useState(false);
  const [priceModal, setPriceModal] = useState(false);
  const [approvalModal, setApprovalModal] = useState(false);
  const [contractModal, setContractModal] = useState(false);

  useEffect(() => {
    getQuote(id).then(setQuote);
    listQuoteLineItems(id).then(setLineItems);
  }, [id]);

  if (!quote) return <Panel title="Loading quote..." description="Fetching from Azure SQL." />;

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
      {tab === "Summary" && <Panel title="Quote summary" description="Commercial quote details."><DataTable columns={[{ key: "field", label: "Field" }, { key: "value", label: "Value" }]} rows={[{ id: 1, field: "Account", value: quote.AccountName }, { id: 2, field: "Opportunity", value: quote.OpportunityName }, { id: 3, field: "Status", value: quote.Status }, { id: 4, field: "Approval", value: quote.ApprovalStatus }]} /></Panel>}
      {tab === "Line Items" && <Panel title="Line items" description="Products and services pulled from the opportunity."><DataTable columns={[{ key: "ProductName", label: "Product" }, { key: "BillingCode", label: "Billing Code" }, { key: "Quantity", label: "Qty" }, { key: "Mrc", label: "MRC", render: row => money(row.Mrc) }, { key: "Nrc", label: "NRC", render: row => money(row.Nrc) }, { key: "Cost", label: "Cost", render: row => money(row.Cost) }, { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={async () => { await deleteQuoteLineItem(id, row.QuoteLineItemId); setLineItems(await listQuoteLineItems(id)); }}>Remove</button></div> }]} rows={lineItems} /></Panel>}
      {tab === "Pricing" && <Panel title="Pricing" description="Quote pricing and results."><div className="field-grid"><div className="mini-stat"><span>Total MRC</span><strong>{money(quote.TotalMrc)}</strong></div><div className="mini-stat"><span>Total NRC</span><strong>{money(quote.TotalNrc)}</strong></div><div className="mini-stat"><span>Margin</span><strong>{Number(quote.MarginPct || 0).toFixed(1)}%</strong></div><div className="mini-stat"><span>Approval</span><strong>{quote.ApprovalStatus}</strong></div></div></Panel>}
      {tab === "Approvals" && <Panel title="Approvals" description="Approval route for this quote."><DataTable columns={[{ key: "step", label: "Step" }, { key: "status", label: "Status" }, { key: "owner", label: "Owner" }]} rows={[{ id: 1, step: "Pricing", status: quote.ApprovalStatus, owner: "Pricing Desk" }, { id: 2, step: "Finance", status: quote.ApprovalStatus === "Approved" ? "Approved" : "Pending", owner: "Finance" }]} /></Panel>}
      {tab === "Contract" && <Panel title="Contract" description="Contract generation after approval."><p>If approved, the backend will create a contract record automatically. Use the Contracts tab to review files and history.</p></Panel>}

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
    </>
  );
}
