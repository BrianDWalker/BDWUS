import React, { useMemo, useState } from "react";
import { PageHeader } from "./Shell";
import { Icon } from "./Icons";
import { DataTable, Panel, StatusTag, formatMoney } from "./Primitives";
import { customers, leads, opportunities, orders, quotes, services } from "../data/mockData";

const owners = ["Sarah Johnson", "Tia Brooks", "Sam Malik", "Ari Fox", "Maya Ortiz"];
const stages = ["New", "Discovery", "Solutioning", "Quote", "Approval", "Closed Won", "Closed Lost"];
const salesTabs = ["Command Center", "Opportunities", "Leads", "Accounts", "Quote Desk", "Custom Pricing", "Approvals", "Activities", "Contracts"];
const opportunityTabs = ["Summary", "Serviceability", "Quote Build", "Pricing", "Approvals", "Activities", "Contract", "Order Handoff"];
const quoteTabs = ["Quote Summary", "Line Items", "Pricing Waterfall", "Approvals", "PDF Preview", "Audit"];
const leadTabs = ["Qualification", "Account Fit", "Conversion Plan", "Activity"];

const sum = (items, selector) => items.reduce((total, item) => total + selector(item), 0);
const textMatch = (value, query) => String(value ?? "").toLowerCase().includes(query.trim().toLowerCase());
const customerName = id => customers.find(customer => customer.id === id)?.name || id;
const billingAccountNumber = customer => `BA-${customer.id.replace("CUST-", "")}-01`;

function matchAny(item, query, fields) {
  return !query.trim() || fields.some(field => textMatch(field(item), query));
}

function customerFor(id) {
  return customers.find(customer => customer.id === id) || customers[0];
}

function opportunityMeta(opportunity) {
  const customer = customerFor(opportunity.customerId);
  const index = opportunities.findIndex(item => item.id === opportunity.id);
  const serviceMix = customer.services.join(", ");
  const stage = stages[(index + 1) % 5];
  const estimatedMrc = Math.round(opportunity.value / 36);
  const estimatedNrc = 12500 + index * 4300;
  const margin = [39.8, 22.5, 35.7, 28.4][index % 4];
  return {
    ...opportunity,
    account: customer.name,
    accountNumber: customer.id,
    billingAccount: billingAccountNumber(customer),
    market: customer.region,
    segment: customer.segment,
    locations: [12, 34, 38, 8][index % 4],
    type: index % 2 ? "Expansion" : "New Logo",
    source: index % 2 ? "Account planning" : "Partner referral",
    serviceMix,
    productInterest: serviceMix,
    serviceability: ["On-net", "Wireless footprint", "Mixed on-net / near-net", "Requires engineering"][index % 4],
    estimatedMrc,
    estimatedNrc,
    tcv: opportunity.value + estimatedNrc,
    margin,
    pricingRisk: margin < 25 ? "High" : margin < 32 ? "Medium" : "Low",
    owner: owners[index % owners.length],
    nextStep: ["Discovery call", "Pricing review", "Quote approval", "Customer follow-up"][index % 4],
    stage,
    status: stage === "Approval" ? "Approval Required" : stage,
    solutionEngineer: owners[(index + 2) % owners.length],
    installComplexity: ["Low", "High", "Medium", "Medium"][index % 4]
  };
}

function quoteMeta(quote) {
  const customer = customerFor(quote.customerId);
  const opportunity = opportunities.find(item => item.id === quote.opportunityId) || opportunities[0];
  const opp = opportunityMeta(opportunity);
  const index = quotes.findIndex(item => item.id === quote.id);
  const mrc = Math.round(quote.value / 36);
  const nrc = 8200 + index * 2600;
  const discount = quote.customPrice ? 12 + index * 3 : 4;
  const approvalRequired = quote.margin < 30 || discount > 10;
  return {
    ...quote,
    account: customer.name,
    accountNumber: customer.id,
    billingAccount: billingAccountNumber(customer),
    opportunityName: opportunity.name,
    serviceability: opp.serviceability,
    locations: opp.locations,
    productPackage: quote.package,
    term: [36, 24, 48][index % 3],
    mrc,
    nrc,
    taxes: Math.round((mrc + nrc) * 0.084),
    discount,
    margin: quote.margin,
    expiration: ["2026-06-15", "2026-06-30", "2026-05-31"][index % 3],
    quoteDate: ["2026-05-12", "2026-05-08", "2026-05-01"][index % 3],
    owner: owners[(index + 1) % owners.length],
    tcv: quote.value + nrc,
    approvalRequired,
    approvalStatus: approvalRequired ? "Approval Required" : "Ready to Send",
    pricingRisk: quote.margin < 25 ? "High" : quote.margin < 31 ? "Medium" : "Low"
  };
}

function serviceLinesFor(opportunity) {
  const base = [
    { id: `${opportunity.id}-L1`, product: "Fiber / DIA Access", category: "Wireline", billingCode: "DIA-MRC", mrc: Math.round(opportunity.estimatedMrc * 0.58), nrc: Math.round(opportunity.estimatedNrc * 0.48), cost: Math.round(opportunity.estimatedMrc * 0.34), margin: 41, serviceability: opportunity.serviceability },
    { id: `${opportunity.id}-L2`, product: "Managed Router / CPE", category: "Managed", billingCode: "CPE-MRC", mrc: Math.round(opportunity.estimatedMrc * 0.18), nrc: Math.round(opportunity.estimatedNrc * 0.22), cost: Math.round(opportunity.estimatedMrc * 0.12), margin: 33, serviceability: "Install required" },
    { id: `${opportunity.id}-L3`, product: "Wireless Backup", category: "Wireless", billingCode: "WLS-BACKUP", mrc: Math.round(opportunity.estimatedMrc * 0.14), nrc: Math.round(opportunity.estimatedNrc * 0.12), cost: Math.round(opportunity.estimatedMrc * 0.08), margin: 43, serviceability: "Coverage check" },
    { id: `${opportunity.id}-L4`, product: "Install / Activation", category: "Professional Services", billingCode: "INSTALL-NRC", mrc: 0, nrc: Math.round(opportunity.estimatedNrc * 0.18), cost: Math.round(opportunity.estimatedNrc * 0.1), margin: 44, serviceability: "Field ops" }
  ];
  return base.filter((_, index) => index < (opportunity.locations > 10 ? 4 : 3));
}

function activityRows(recordId) {
  return [
    { id: `${recordId}-A1`, date: "2026-05-12", type: "Discovery", owner: "Sarah Johnson", note: "Confirmed service mix, locations, contract timing, and decision process." },
    { id: `${recordId}-A2`, date: "2026-05-13", type: "Serviceability", owner: "Network Ops", note: "Wireline footprint and wireless backup review completed." },
    { id: `${recordId}-A3`, date: "2026-05-14", type: "Pricing", owner: "Pricing Desk", note: "Custom pricing package prepared with margin guardrails." }
  ];
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <label className="inline-search">
      <Icon name="search" className="button-icon" />
      <input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function MiniStat({ label, value, note }) {
  return (
    <div className="mini-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

function SummaryStrip({ items }) {
  return <section className="summary-strip">{items.map(item => <MiniStat key={item.label} {...item} />)}</section>;
}

function Tabs({ tabs, active, onChange }) {
  return <div className="record-tabs" role="tablist">{tabs.map(tab => <button key={tab} type="button" className={tab === active ? "active" : ""} onClick={() => onChange(tab)}>{tab}</button>)}</div>;
}

function Modal({ title, subtitle = "Telecom sales workflow", children, actions, onClose }) {
  return (
    <div className="sales-crm-modal-backdrop">
      <section className="sales-crm-modal" role="dialog" aria-modal="true">
        <header>
          <div><strong>{title}</strong><span>{subtitle}</span></div>
          <button type="button" className="sales-crm-close" onClick={onClose}>×</button>
        </header>
        <div className="sales-crm-modal-body">{children}</div>
        <footer>{actions}</footer>
      </section>
    </div>
  );
}

function ActionButton({ children, onClick, variant = "ghost-button", icon = "workflow" }) {
  return (
    <button className={variant} type="button" onClick={onClick}>
      <Icon name={icon} className="button-icon" />
      {children}
    </button>
  );
}

function SalesModalForm({ type }) {
  if (type === "quote") {
    return (
      <form className="sales-crm-form compact">
        <label>Account Number<input defaultValue="CUST-1001" /></label>
        <label>Opportunity<input defaultValue="OPP-812" /></label>
        <label>Quote Type<select><option>Custom Pricing</option><option>Standard</option><option>Renewal</option></select></label>
        <label>Term<select><option>36 months</option><option>24 months</option><option>12 months</option></select></label>
        <label>Target MRC<input defaultValue="$12,000" /></label>
        <label>Target Margin<input defaultValue="32%" /></label>
        <label className="full">Pricing Notes<textarea defaultValue="Multi-location access, wireless backup, install waiver, and contract ramp requested." /></label>
      </form>
    );
  }
  return (
    <form className="sales-crm-form">
      <label>Account Number<input defaultValue="CUST-1001" /></label>
      <label>Opportunity Name<input placeholder="Multi-site fiber and wireless expansion" /></label>
      <label>Service Family<select><option>Wireline / Fiber</option><option>Wireless / Mobility</option><option>Transitional Services</option><option>Managed Network</option><option>Voice / UCaaS</option></select></label>
      <label>Locations<input placeholder="12" /></label>
      <label>Estimated MRC<input placeholder="$12,000" /></label>
      <label>Estimated NRC<input placeholder="$12,500" /></label>
      <label>Contract Term<select><option>36 months</option><option>24 months</option><option>12 months</option><option>Month to month</option></select></label>
      <label>Sales Stage<select><option>Discovery</option><option>Solutioning</option><option>Quote</option><option>Custom Pricing</option><option>Approval</option></select></label>
      <label className="full">Customer Need<textarea placeholder="Bandwidth expansion, wireless backup, managed router, installation constraints..." /></label>
    </form>
  );
}

function TelecomCommandCenter({ opportunities: opps, setRoute, openModal }) {
  const totalTcv = sum(opps, item => item.tcv);
  const exceptions = opps.filter(item => item.pricingRisk !== "Low").length;
  const orderReady = quotes.map(quoteMeta).filter(item => !item.approvalRequired).length;
  return (
    <section className="sales-crm-command-center">
      <div className="sales-crm-command-copy">
        <span>Telecom CRM Command Center</span>
        <h2>Sales, quote desk, serviceability, and custom pricing in one workflow.</h2>
        <p>Manage wireless, wireline, voice, managed services, transitional services, pricing approvals, and quote-to-order handoff from one Sales workspace.</p>
      </div>
      <div className="sales-crm-command-actions">
        <ActionButton icon="opportunities" variant="button" onClick={() => openModal("opportunity")}>New Opportunity</ActionButton>
        <ActionButton icon="pricing" onClick={() => openModal("quote")}>Create Quote</ActionButton>
        <ActionButton icon="workflow" onClick={() => setRoute(`details/opportunity/${opps[0]?.id || "OPP-812"}`)}>Open Deal Desk</ActionButton>
      </div>
      <div className="sales-crm-kpis">
        <div><span>Telecom Pipeline</span><strong>{formatMoney(totalTcv)}</strong><small>Wireline, wireless, managed services</small></div>
        <div><span>Pricing Exceptions</span><strong>{exceptions}</strong><small>Margin or discount review</small></div>
        <div><span>Serviceability Reviews</span><strong>{opps.length}</strong><small>On-net / near-net / wireless</small></div>
        <div><span>Order Ready</span><strong>{orderReady}</strong><small>Approved quote conversion</small></div>
      </div>
    </section>
  );
}

export function SalesModule({ setRoute, showToast }) {
  const [modal, setModal] = useState(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("Command Center");
  const [stageFilter, setStageFilter] = useState("All stages");
  const [view, setView] = useState("Table");
  const opps = useMemo(() => opportunities.map(opportunityMeta), []);
  const quoteRows = useMemo(() => quotes.map(quoteMeta), []);
  const filteredOpps = opps.filter(item => matchAny(item, query, [row => row.id, row => row.account, row => row.serviceMix, row => row.quote]) && (stageFilter === "All stages" || item.stage === stageFilter));
  const filteredQuotes = quoteRows.filter(item => matchAny(item, query, [row => row.id, row => row.account, row => row.productPackage, row => row.opportunityName]));
  const filteredLeads = leads.filter(item => matchAny(item, query, [row => row.id, row => row.account, row => row.product, row => row.stage]));
  const filteredCustomers = customers.filter(item => matchAny(item, query, [row => row.id, row => row.name, row => row.segment, row => row.region]));
  const pipeline = sum(filteredOpps, item => item.tcv);
  const weighted = sum(filteredOpps, item => item.tcv * item.probability / 100);

  function closeModal(message) {
    setModal(null);
    if (message) showToast(message);
  }

  return (
    <>
      <PageHeader
        title="Sales"
        description="Telecom CRM for opportunity tracking, serviceability, quote desk, custom pricing, approvals, contracts, and quote-to-order handoff."
        actions={<><ActionButton icon="opportunities" variant="button" onClick={() => setModal("opportunity")}>New Opportunity</ActionButton><ActionButton icon="pricing" onClick={() => setModal("quote")}>Create Quote</ActionButton></>}
      />
      <TelecomCommandCenter opportunities={opps} setRoute={setRoute} openModal={setModal} />
      <SummaryStrip items={[
        { label: "Pipeline Value", value: formatMoney(pipeline), note: "TCV across open telecom deals" },
        { label: "Weighted Pipeline", value: formatMoney(weighted), note: "Probability adjusted" },
        { label: "Open Opportunities", value: filteredOpps.length, note: "Sales-owned opportunities" },
        { label: "Approvals", value: filteredQuotes.filter(item => item.approvalRequired).length, note: "Pricing and finance queue" },
        { label: "Serviceability", value: opps.length, note: "Footprint checks in motion" }
      ]} />
      <div className="sales-crm-toolbar">
        <SearchBox value={query} onChange={setQuery} placeholder="Search account, opportunity, quote, product, stage" />
        <label className="inline-search"><Icon name="workflow" className="button-icon" /><select value={stageFilter} onChange={event => setStageFilter(event.target.value)}>{["All stages", ...stages].map(stage => <option key={stage}>{stage}</option>)}</select></label>
        <button className="tiny-button" type="button" onClick={() => setView(view === "Table" ? "Kanban" : "Table")}>{view === "Table" ? "Kanban view" : "Table view"}</button>
      </div>
      <Tabs tabs={salesTabs} active={tab} onChange={setTab} />

      {tab === "Command Center" && (
        <section className="sales-crm-grid">
          <Panel title="Telecom opportunity work queue" description="Prioritize deals by serviceability, quote status, pricing risk, and next action.">
            <div className="sales-crm-cards">
              {filteredOpps.map(item => (
                <button type="button" className="sales-crm-card" key={item.id} onClick={() => setRoute(`details/opportunity/${item.id}`)}>
                  <div><strong>{item.account}</strong><span>{item.id} · {item.accountNumber} · {quotes.find(q => q.opportunityId === item.id)?.id || "No quote"}</span></div>
                  <p>{item.serviceMix}</p>
                  <div className="sales-crm-card-meta"><span>{item.locations} locations</span><span>{item.serviceability}</span><span className={`risk-${item.pricingRisk.toLowerCase()}`}>{item.pricingRisk} risk</span></div>
                  <div className="sales-crm-card-footer"><b>{formatMoney(item.tcv)}</b><small>{item.nextStep}</small></div>
                </button>
              ))}
            </div>
          </Panel>
          <section className="sales-crm-side-stack">
            <Panel title="Quote desk tools" description="Actions a telecom seller/pricer needs during deal review.">
              <div className="sales-crm-tool-list">
                <button type="button" onClick={() => setModal("quote")}>Run custom pricing<span>Open workflow</span></button>
                <button type="button" onClick={() => setTab("Custom Pricing")}>Apply eligible promo<span>Review offers</span></button>
                <button type="button" onClick={() => setRoute(`details/opportunity/${filteredOpps[0]?.id || opps[0].id}`)}>Check serviceability<span>Footprint review</span></button>
                <button type="button" onClick={() => setTab("Approvals")}>Submit approval<span>Route exception</span></button>
                <button type="button" onClick={() => { setRoute("orders"); showToast("Order draft created from approved quote"); }}>Create order draft<span>Quote-to-order</span></button>
              </div>
            </Panel>
            <Panel title="Serviceability snapshot" description="Quote quality depends on availability, cost, and install complexity.">
              <div className="sales-crm-serviceability"><div><span>On-net</span><b>1</b></div><div><span>Near-net</span><b>1</b></div><div><span>Wireless</span><b>1</b></div><div><span>Requires SE</span><b>2</b></div></div>
            </Panel>
          </section>
        </section>
      )}

      {tab === "Opportunities" && (
        <Panel title="Opportunities" description="Telecom pipeline records connected to accounts, locations, services, quotes, pricing, and order conversion.">
          {view === "Kanban" ? (
            <div className="pipeline-kanban">
              {stages.map(stage => <div className="kanban-stage" key={stage}><strong>{stage}</strong>{filteredOpps.filter(item => item.stage === stage).map(item => <button className="pipeline-card focus-card" type="button" key={item.id} onClick={() => setRoute(`details/opportunity/${item.id}`)}><span>{item.id} · {item.account}</span><strong>{item.name}</strong><small>{formatMoney(item.estimatedMrc)} MRC · {item.probability}% · {item.nextStep}</small></button>)}</div>)}
            </div>
          ) : (
            <DataTable columns={[{ key: "id", label: "Opportunity" }, { key: "account", label: "Account" }, { key: "serviceMix", label: "Services" }, { key: "locations", label: "Locations" }, { key: "stage", label: "Stage", render: row => <StatusTag tone={row.stage === "Approval" ? "warn" : "blue"}>{row.stage}</StatusTag> }, { key: "serviceability", label: "Serviceability" }, { key: "estimatedMrc", label: "MRC", render: row => formatMoney(row.estimatedMrc) }, { key: "tcv", label: "TCV", render: row => formatMoney(row.tcv) }, { key: "margin", label: "Margin", render: row => `${row.margin}%` }, { key: "owner", label: "Owner" }, { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/opportunity/${row.id}`)}>Open</button><button className="link-button compact-action" type="button" onClick={() => setModal("quote")}>Quote</button><button className="link-button compact-action" type="button" onClick={() => { setRoute("orders"); showToast("Order draft opened"); }}>Order</button></div> }]} rows={filteredOpps} />
          )}
        </Panel>
      )}

      {tab === "Leads" && <Panel title="Leads" description="Lead qualification for telecom accounts and product interest."><DataTable columns={[{ key: "id", label: "Lead" }, { key: "account", label: "Account" }, { key: "source", label: "Source" }, { key: "stage", label: "Stage", render: row => <StatusTag>{row.stage}</StatusTag> }, { key: "product", label: "Product Interest" }, { key: "estValue", label: "Estimated Value", render: row => formatMoney(row.estValue) }, { key: "owner", label: "Owner" }, { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/lead/${row.id}`)}>Qualify</button><button className="link-button compact-action" type="button" onClick={() => setModal("opportunity")}>Convert</button></div> }]} rows={filteredLeads} /></Panel>}

      {tab === "Accounts" && <Panel title="Accounts" description="Account-centric CRM view with revenue, region, health, and open sales work."><DataTable columns={[{ key: "id", label: "Account Number" }, { key: "name", label: "Account" }, { key: "segment", label: "Segment" }, { key: "region", label: "Region" }, { key: "services", label: "Active Services", render: row => row.services.join(", ") }, { key: "mrr", label: "MRR", render: row => formatMoney(row.mrr) }, { key: "health", label: "Health" }, { key: "churnRisk", label: "Risk", render: row => <StatusTag tone={row.churnRisk === "High" ? "warn" : "blue"}>{row.churnRisk}</StatusTag> }, { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/customer/${row.id}`)}>Customer 360</button><button className="link-button compact-action" type="button" onClick={() => setModal("opportunity")}>New Opp</button></div> }]} rows={filteredCustomers} /></Panel>}

      {tab === "Quote Desk" && <Panel title="Quote Desk" description="Quote creation, product package selection, margin review, and serviceability-aware pricing."><DataTable columns={[{ key: "id", label: "Quote" }, { key: "account", label: "Account" }, { key: "opportunityName", label: "Opportunity" }, { key: "productPackage", label: "Package" }, { key: "locations", label: "Locations" }, { key: "mrc", label: "MRC", render: row => formatMoney(row.mrc) }, { key: "nrc", label: "NRC", render: row => formatMoney(row.nrc) }, { key: "margin", label: "Margin" }, { key: "approvalStatus", label: "Status", render: row => <StatusTag tone={row.approvalRequired ? "warn" : "success"}>{row.approvalStatus}</StatusTag> }, { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/quote/${row.id}`)}>Open</button><button className="link-button compact-action" type="button" onClick={() => setModal("quote")}>Edit</button><button className="link-button compact-action" type="button" onClick={() => setTab("Approvals")}>Approval</button></div> }]} rows={filteredQuotes} /></Panel>}

      {tab === "Custom Pricing" && <section className="sales-crm-quote-grid"><Panel title="Custom pricing queue" description="Deal desk work for discounts, promos, term exceptions, and competitive responses."><DataTable columns={[{ key: "id", label: "Quote" }, { key: "account", label: "Account" }, { key: "pricingRisk", label: "Risk", render: row => <StatusTag tone={row.pricingRisk === "High" ? "warn" : "blue"}>{row.pricingRisk}</StatusTag> }, { key: "discount", label: "Discount", render: row => `${row.discount}%` }, { key: "margin", label: "Margin", render: row => `${row.margin}%` }, { key: "term", label: "Term", render: row => `${row.term} mo` }, { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/quote/${row.id}`)}>Review</button><button className="link-button compact-action" type="button" onClick={() => setModal("quote")}>Reprice</button></div> }]} rows={filteredQuotes.filter(row => row.customPrice || row.approvalRequired)} /></Panel><Panel title="Pricing waterfall" description="Example pricing mechanics used by the quote desk."><div className="sales-crm-waterfall"><div><span>List MRC</span><strong>{formatMoney(12000)}</strong></div><div className="negative"><span>Promo / offer credit</span><strong>{formatMoney(-1200)}</strong></div><div className="negative"><span>Term discount</span><strong>{formatMoney(-600)}</strong></div><div><span>Regional uplift</span><strong>{formatMoney(450)}</strong></div><div className="final"><span>Recommended MRC</span><strong>{formatMoney(10650)}</strong></div></div></Panel></section>}

      {tab === "Approvals" && <Panel title="Approvals" description="Pricing, margin, promo, contract, and quote approval queue."><DataTable columns={[{ key: "id", label: "Quote" }, { key: "account", label: "Account" }, { key: "approvalStatus", label: "Approval" }, { key: "discount", label: "Discount", render: row => `${row.discount}%` }, { key: "margin", label: "Margin", render: row => `${row.margin}%` }, { key: "owner", label: "Owner" }, { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/quote/${row.id}`)}>Review</button><button className="link-button compact-action" type="button" onClick={() => showToast("Approval routed to finance")}>Route</button><button className="link-button compact-action" type="button" onClick={() => showToast("Quote approved")}>Approve</button></div> }]} rows={filteredQuotes.filter(row => row.approvalRequired)} /></Panel>}

      {tab === "Activities" && <Panel title="Activities" description="Sales activity timeline across leads, opportunities, quotes, and customer follow-up."><DataTable columns={[{ key: "date", label: "Date" }, { key: "type", label: "Type" }, { key: "owner", label: "Owner" }, { key: "note", label: "Note" }]} rows={opps.flatMap(item => activityRows(item.id)).slice(0, 8)} /></Panel>}

      {tab === "Contracts" && <Panel title="Contracts" description="Contract term, MSA, order form, ramp, install terms, and renewal tracking."><DataTable columns={[{ key: "id", label: "Contract" }, { key: "account", label: "Account" }, { key: "term", label: "Term" }, { key: "mrc", label: "MRC", render: row => formatMoney(row.mrc) }, { key: "expiration", label: "Expiration" }, { key: "status", label: "Status", render: row => <StatusTag tone={row.approvalRequired ? "warn" : "success"}>{row.approvalRequired ? "Needs Approval" : "Ready"}</StatusTag> }, { key: "actions", label: "Actions", render: row => <button className="link-button compact-action" type="button" onClick={() => setRoute(`details/quote/${row.id}`)}>Open Terms</button> }]} rows={filteredQuotes} /></Panel>}

      {modal && <Modal title={modal === "quote" ? "Create / edit telecom quote" : "New telecom opportunity"} onClose={() => setModal(null)} actions={<><button className="button" type="button" onClick={() => closeModal(modal === "quote" ? "Quote saved" : "Opportunity saved")}>Save</button><button className="ghost-button" type="button" onClick={() => closeModal("Draft saved")}>Save Draft</button><button className="ghost-button" type="button" onClick={() => setModal(null)}>Cancel</button></>}><SalesModalForm type={modal} /></Modal>}
    </>
  );
}

function RecordHeader({ breadcrumb, title, status, subtitle, actions, meta }) {
  return (
    <section className="record-header">
      <div>
        <div className="breadcrumb">{breadcrumb.join(" / ")}</div>
        <div className="record-title-line"><h2>{title}</h2>{status && <StatusTag tone={["Approval Required", "At Risk", "High"].includes(status) ? "warn" : ["Approved", "Ready", "Active"].includes(status) ? "success" : "blue"}>{status}</StatusTag>}</div>
        {subtitle && <p>{subtitle}</p>}
        {meta && <div className="record-meta-row">{meta}</div>}
      </div>
      <div className="record-actions">{actions}</div>
    </section>
  );
}

export function SalesOpportunityDetail({ id, setRoute, showToast }) {
  const opportunity = opportunityMeta(opportunities.find(item => item.id === id) || opportunities[0]);
  const [tab, setTab] = useState("Summary");
  const [modal, setModal] = useState(null);
  const quote = quotes.map(quoteMeta).find(item => item.opportunityId === opportunity.id) || quotes.map(quoteMeta)[0];
  const lines = serviceLinesFor(opportunity);
  return (
    <>
      <RecordHeader breadcrumb={["Sales", "Opportunities", opportunity.id]} title={opportunity.name} status={opportunity.status} subtitle={`${opportunity.account} · ${opportunity.accountNumber} · ${opportunity.serviceMix}`} actions={<><ActionButton icon="pricing" variant="button" onClick={() => setModal("quote")}>Create Quote</ActionButton><ActionButton icon="orders" onClick={() => { setRoute("orders"); showToast("Order draft opened from opportunity"); }}>Convert to Order</ActionButton><ActionButton icon="workflow" onClick={() => showToast("Activity logged")}>Log Activity</ActionButton></>} meta={<div className="record-meta-chips"><StatusTag tone="blue">{opportunity.serviceability}</StatusTag><StatusTag tone={opportunity.pricingRisk === "High" ? "warn" : "blue"}>{opportunity.pricingRisk} pricing risk</StatusTag><StatusTag tone="blue">{opportunity.owner}</StatusTag><StatusTag tone="blue">SE: {opportunity.solutionEngineer}</StatusTag></div>} />
      <section className="sales-crm-status-board"><div><span>TCV</span><strong>{formatMoney(opportunity.tcv)}</strong></div><div><span>MRC</span><strong>{formatMoney(opportunity.estimatedMrc)}</strong></div><div><span>NRC</span><strong>{formatMoney(opportunity.estimatedNrc)}</strong></div><div><span>Margin</span><strong>{opportunity.margin}%</strong></div></section>
      <Tabs tabs={opportunityTabs} active={tab} onChange={setTab} />
      {tab === "Summary" && <section className="sales-crm-detail-grid"><Panel title="Opportunity summary" description="Core sales, account, and commercial details."><div className="field-grid"><MiniStat label="Account" value={opportunity.account} note={opportunity.accountNumber} /><MiniStat label="Billing Account" value={opportunity.billingAccount} /><MiniStat label="Segment" value={opportunity.segment} /><MiniStat label="Market" value={opportunity.market} /><MiniStat label="Locations" value={opportunity.locations} /><MiniStat label="Next Step" value={opportunity.nextStep} /></div></Panel><Panel title="Related work" description="Connected quote, serviceability, and order context."><div className="list"><div className="list-item"><div><div className="title">Quote</div><div className="subtitle">{quote.id} · {quote.approvalStatus}</div></div><button className="link-button compact-action" onClick={() => setRoute(`details/quote/${quote.id}`)}>Open</button></div><div className="list-item"><div><div className="title">Order handoff</div><div className="subtitle">Ready after quote approval</div></div><StatusTag tone="blue">Draft</StatusTag></div><div className="list-item"><div><div className="title">Customer 360</div><div className="subtitle">Account, services, billing, tickets</div></div><button className="link-button compact-action" onClick={() => setRoute(`details/customer/${opportunity.accountNumber}`)}>Open</button></div></div></Panel></section>}
      {tab === "Serviceability" && <section className="sales-crm-detail-grid"><Panel title="Serviceability by location" description="Wireline footprint, wireless coverage, install complexity, and engineering work."><div className="sales-crm-location-list">{["HQ", "Branch North", "Branch South", "Warehouse"].map((loc, index) => <div className="sales-crm-location-row" key={loc}><strong>{loc}</strong><span>{index === 0 ? "On-net fiber" : index === 1 ? "Near-net" : index === 2 ? "Wireless backup" : "Engineering review"}</span><span>{index + 1} circuits</span><StatusTag tone={index === 3 ? "warn" : "success"}>{index === 3 ? "Review" : "Serviceable"}</StatusTag><button className="link-button compact-action" onClick={() => showToast("Serviceability detail opened")}>View</button></div>)}</div></Panel><Panel title="Network readiness" description="Pre-order feasibility for quote accuracy."><div className="field-grid compact-fields"><MiniStat label="Fiber Footprint" value="Available" /><MiniStat label="Wireless Coverage" value="Strong" /><MiniStat label="CPE" value="Required" /><MiniStat label="SE Review" value={opportunity.installComplexity === "High" ? "Required" : "Optional"} /></div></Panel></section>}
      {tab === "Quote Build" && <Panel title="Quote build" description="Products, billing codes, MRC, NRC, cost, and margin by service line."><DataTable columns={[{ key: "product", label: "Product" }, { key: "category", label: "Category" }, { key: "billingCode", label: "Billing Code" }, { key: "mrc", label: "MRC", render: row => formatMoney(row.mrc) }, { key: "nrc", label: "NRC", render: row => formatMoney(row.nrc) }, { key: "cost", label: "Cost", render: row => formatMoney(row.cost) }, { key: "margin", label: "Margin", render: row => `${row.margin}%` }, { key: "serviceability", label: "Serviceability" }]} rows={lines} /></Panel>}
      {tab === "Pricing" && <section className="sales-crm-quote-grid"><Panel title="Pricing waterfall" description="How list, cost, promos, term, and discount become the recommended deal price."><div className="sales-crm-waterfall"><div><span>List MRC</span><strong>{formatMoney(opportunity.estimatedMrc)}</strong></div><div className="negative"><span>Promo / offer credit</span><strong>{formatMoney(-Math.round(opportunity.estimatedMrc * 0.08))}</strong></div><div className="negative"><span>Term discount</span><strong>{formatMoney(-Math.round(opportunity.estimatedMrc * 0.05))}</strong></div><div><span>Regional uplift</span><strong>{formatMoney(Math.round(opportunity.estimatedMrc * 0.03))}</strong></div><div className="final"><span>Recommended MRC</span><strong>{formatMoney(Math.round(opportunity.estimatedMrc * 0.9))}</strong></div></div></Panel><Panel title="Guardrails" description="Approval thresholds and pricing controls."><div className="field-grid compact-fields"><MiniStat label="Minimum Margin" value="28%" /><MiniStat label="Discount Limit" value="12%" /><MiniStat label="Competitor Pressure" value="Medium" /><MiniStat label="Approval" value={opportunity.pricingRisk === "Low" ? "Not required" : "Required"} /></div></Panel></section>}
      {tab === "Approvals" && <Panel title="Approval routing" description="Pricing, margin, discount, promo, and contract approval status."><DataTable columns={[{ key: "step", label: "Step" }, { key: "owner", label: "Owner" }, { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Approved" ? "success" : row.status === "Pending" ? "warn" : "blue"}>{row.status}</StatusTag> }, { key: "notes", label: "Notes" }]} rows={[{ id: "A1", step: "Pricing review", owner: "Pricing Desk", status: "Approved", notes: "Floor price validated" }, { id: "A2", step: "Sales manager", owner: opportunity.owner, status: "Pending", notes: "Discount exception" }, { id: "A3", step: "Finance", owner: "Finance Ops", status: "Queued", notes: "Margin review" }]} /></Panel>}
      {tab === "Activities" && <Panel title="Activity timeline" description="Discovery, pricing, customer, and serviceability events."><DataTable columns={[{ key: "date", label: "Date" }, { key: "type", label: "Type" }, { key: "owner", label: "Owner" }, { key: "note", label: "Note" }]} rows={activityRows(opportunity.id)} /></Panel>}
      {tab === "Contract" && <Panel title="Contract terms" description="MSA, order form, renewal, ramp, install terms, and commercial clauses."><div className="field-grid"><MiniStat label="Term" value="36 months" /><MiniStat label="MSA" value="Existing" /><MiniStat label="Ramp" value="90 day" /><MiniStat label="Install Waiver" value="Eligible" /><MiniStat label="Renewal Type" value="Co-termed" /><MiniStat label="SLA" value="Premium" /></div></Panel>}
      {tab === "Order Handoff" && <Panel title="Quote-to-order handoff" description="Operational package for Orders, provisioning, billing, and service activation."><DataTable columns={[{ key: "item", label: "Handoff Item" }, { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Ready" ? "success" : "warn"}>{row.status}</StatusTag> }, { key: "owner", label: "Owner" }]} rows={[{ id: "H1", item: "Approved quote", status: quote.approvalRequired ? "Pending" : "Ready", owner: "Sales" }, { id: "H2", item: "Serviceability package", status: "Ready", owner: "Network" }, { id: "H3", item: "Billing codes", status: "Ready", owner: "Pricing" }, { id: "H4", item: "Install notes", status: "Ready", owner: "Sales Engineering" }]} /></Panel>}
      {modal && <Modal title="Create telecom quote" onClose={() => setModal(null)} actions={<><button className="button" onClick={() => { setModal(null); showToast("Quote saved"); }}>Save Quote</button><button className="ghost-button" onClick={() => setModal(null)}>Cancel</button></>}><SalesModalForm type="quote" /></Modal>}
    </>
  );
}

export function SalesQuoteDetail({ id, setRoute, showToast }) {
  const quote = quoteMeta(quotes.find(item => item.id === id) || quotes[0]);
  const opportunity = opportunityMeta(opportunities.find(item => item.id === quote.opportunityId) || opportunities[0]);
  const [tab, setTab] = useState("Quote Summary");
  const lines = serviceLinesFor(opportunity);
  return (
    <>
      <RecordHeader breadcrumb={["Sales", "Quotes", quote.id]} title={`${quote.account} quote`} status={quote.approvalStatus} subtitle={`${quote.productPackage} · ${quote.opportunityName}`} actions={<><ActionButton icon="pricing" variant="button" onClick={() => showToast("Quote saved")}>Save Quote</ActionButton><ActionButton icon="workflow" onClick={() => showToast("Approval routed")}>Submit Approval</ActionButton><ActionButton icon="orders" onClick={() => { setRoute("orders"); showToast("Order draft created"); }}>Convert to Order</ActionButton></>} meta={<div className="record-meta-chips"><StatusTag tone="blue">{quote.term} mo</StatusTag><StatusTag tone={quote.approvalRequired ? "warn" : "success"}>{quote.margin}% margin</StatusTag><StatusTag tone="blue">Expires {quote.expiration}</StatusTag></div>} />
      <section className="sales-crm-status-board"><div><span>TCV</span><strong>{formatMoney(quote.tcv)}</strong></div><div><span>MRC</span><strong>{formatMoney(quote.mrc)}</strong></div><div><span>NRC</span><strong>{formatMoney(quote.nrc)}</strong></div><div><span>Discount</span><strong>{quote.discount}%</strong></div></section>
      <Tabs tabs={quoteTabs} active={tab} onChange={setTab} />
      {tab === "Quote Summary" && <section className="sales-crm-detail-grid"><Panel title="Quote summary" description="Commercial quote details, account, opportunity, term, and status."><div className="field-grid"><MiniStat label="Account" value={quote.account} note={quote.accountNumber} /><MiniStat label="Opportunity" value={quote.opportunityName} /><MiniStat label="Package" value={quote.productPackage} /><MiniStat label="Term" value={`${quote.term} months`} /><MiniStat label="Serviceability" value={quote.serviceability} /><MiniStat label="Owner" value={quote.owner} /></div></Panel><Panel title="Quote actions" description="Sales actions available for this quote."><div className="sales-crm-tool-list"><button onClick={() => showToast("Pricing recalculated")}>Recalculate pricing<span>Refresh waterfall</span></button><button onClick={() => showToast("Promo eligibility checked")}>Check promos<span>Eligibility</span></button><button onClick={() => showToast("Quote sent to customer")}>Send quote<span>Customer delivery</span></button><button onClick={() => setRoute(`details/opportunity/${opportunity.id}`)}>Open opportunity<span>Deal workspace</span></button></div></Panel></section>}
      {tab === "Line Items" && <Panel title="Quote line items" description="Product, billing code, MRC, NRC, cost, and margin."><DataTable columns={[{ key: "product", label: "Product" }, { key: "category", label: "Category" }, { key: "billingCode", label: "Billing Code" }, { key: "mrc", label: "MRC", render: row => formatMoney(row.mrc) }, { key: "nrc", label: "NRC", render: row => formatMoney(row.nrc) }, { key: "cost", label: "Cost", render: row => formatMoney(row.cost) }, { key: "margin", label: "Margin", render: row => `${row.margin}%` }]} rows={lines} /></Panel>}
      {tab === "Pricing Waterfall" && <Panel title="Pricing waterfall" description="List price, costs, promos, discounts, margin, and recommended customer rate."><div className="sales-crm-waterfall"><div><span>List MRC</span><strong>{formatMoney(quote.mrc)}</strong></div><div className="negative"><span>Promo Credit</span><strong>{formatMoney(-Math.round(quote.mrc * 0.06))}</strong></div><div className="negative"><span>Custom Discount</span><strong>{formatMoney(-Math.round(quote.mrc * quote.discount / 100))}</strong></div><div><span>Taxes/Surcharges</span><strong>{formatMoney(quote.taxes)}</strong></div><div className="final"><span>Customer MRC</span><strong>{formatMoney(Math.round(quote.mrc * (1 - quote.discount / 100)))}</strong></div></div></Panel>}
      {tab === "Approvals" && <Panel title="Quote approvals" description="Approval route and approval decisions."><DataTable columns={[{ key: "step", label: "Step" }, { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Approved" ? "success" : "warn"}>{row.status}</StatusTag> }, { key: "owner", label: "Owner" }, { key: "notes", label: "Notes" }]} rows={[{ id: "QA1", step: "Pricing", status: quote.approvalRequired ? "Pending" : "Approved", owner: "Pricing Desk", notes: "Margin guardrail" }, { id: "QA2", step: "Finance", status: quote.approvalRequired ? "Queued" : "Approved", owner: "Finance", notes: "Discount review" }, { id: "QA3", step: "Sales Manager", status: "Approved", owner: quote.owner, notes: "Customer strategy" }]} /></Panel>}
      {tab === "PDF Preview" && <Panel title="Quote PDF preview" description="Customer-facing telecom quote structure."><div className="sales-crm-quote-document"><div className="sales-crm-quote-document-header"><div><span>Northstar Telecom Quote</span><h3>{quote.id}</h3><p>{quote.account} · {quote.accountNumber}</p></div><strong>{formatMoney(quote.tcv)}</strong></div><DataTable columns={[{ key: "product", label: "Product" }, { key: "mrc", label: "Monthly", render: row => formatMoney(row.mrc) }, { key: "nrc", label: "One-time", render: row => formatMoney(row.nrc) }, { key: "serviceability", label: "Serviceability" }]} rows={lines} /></div></Panel>}
      {tab === "Audit" && <Panel title="Quote audit" description="Quote changes, approvals, pricing edits, and customer delivery events."><DataTable columns={[{ key: "date", label: "Date" }, { key: "type", label: "Type" }, { key: "owner", label: "Owner" }, { key: "note", label: "Note" }]} rows={activityRows(quote.id)} /></Panel>}
    </>
  );
}

export function SalesLeadDetail({ id, setRoute, showToast }) {
  const lead = leads.find(item => item.id === id) || leads[0];
  const [tab, setTab] = useState("Qualification");
  return (
    <>
      <RecordHeader breadcrumb={["Sales", "Leads", lead.id]} title={lead.account} status={lead.stage} subtitle={`${lead.source} · ${lead.product}`} actions={<><ActionButton icon="opportunities" variant="button" onClick={() => showToast("Lead converted to opportunity")}>Convert</ActionButton><ActionButton icon="workflow" onClick={() => showToast("Activity logged")}>Log Activity</ActionButton></>} />
      <Tabs tabs={leadTabs} active={tab} onChange={setTab} />
      {tab === "Qualification" && <Panel title="Lead qualification" description="Telecom-specific qualification for product fit, budget, authority, timing, and location scope."><div className="field-grid"><MiniStat label="Product Interest" value={lead.product} /><MiniStat label="Estimated Value" value={formatMoney(lead.estValue)} /><MiniStat label="Source" value={lead.source} /><MiniStat label="Owner" value={lead.owner} /><MiniStat label="Need" value="Connectivity / managed services" /><MiniStat label="Timing" value="30-90 days" /></div></Panel>}
      {tab === "Account Fit" && <Panel title="Account fit" description="Segment, region, serviceability, and potential services."><DataTable columns={[{ key: "area", label: "Area" }, { key: "result", label: "Result" }, { key: "notes", label: "Notes" }]} rows={[{ id: "F1", area: "Wireline", result: "Potential", notes: "Footprint review required" }, { id: "F2", area: "Wireless", result: "Strong", notes: "Coverage available" }, { id: "F3", area: "Managed Services", result: "Good fit", notes: "Router and SD-WAN attach" }]} /></Panel>}
      {tab === "Conversion Plan" && <Panel title="Conversion plan" description="Steps to convert lead into opportunity and quote."><DataTable columns={[{ key: "step", label: "Step" }, { key: "owner", label: "Owner" }, { key: "status", label: "Status" }]} rows={[{ id: "C1", step: "Confirm account and locations", owner: lead.owner, status: "Open" }, { id: "C2", step: "Run serviceability", owner: "Sales Engineering", status: "Queued" }, { id: "C3", step: "Create opportunity", owner: lead.owner, status: "Next" }]} /></Panel>}
      {tab === "Activity" && <Panel title="Lead activity" description="Lead touchpoints and qualification notes."><DataTable columns={[{ key: "date", label: "Date" }, { key: "type", label: "Type" }, { key: "owner", label: "Owner" }, { key: "note", label: "Note" }]} rows={activityRows(lead.id)} /></Panel>}
    </>
  );
}
