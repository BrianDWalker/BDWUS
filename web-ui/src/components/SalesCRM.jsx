import React, { useMemo, useState } from "react";
import { PageHeader } from "./Shell";
import { Icon } from "./Icons";
import { DataTable, Panel, StatusTag, formatMoney } from "./Primitives";
import { customers, leads, opportunities, quotes, contracts } from "../data/legacyMockData";

const owners = ["Sarah Johnson", "Tia Brooks", "Sam Malik", "Ari Fox", "Maya Ortiz"];
const stages = ["New", "Discovery", "Solutioning", "Quote", "Approval", "Closed Won", "Closed Lost"];
const salesTabs = ["Leads", "Opportunities", "Accounts", "Custom Pricing", "Approvals", "Contracts"];
const opportunityTabs = ["Summary", "Serviceability", "Quote Build", "Pricing", "Approvals", "Activities", "Contract", "Order Handoff"];
const quoteTabs = ["Quote Summary", "Line Items", "Pricing Waterfall", "Approvals", "PDF Preview", "Audit"];
const leadTabs = ["Qualification", "Account Fit", "Conversion Plan", "Activity"];

const sum = (items, selector) => items.reduce((total, item) => total + selector(item), 0);
const textMatch = (value, query) => String(value ?? "").toLowerCase().includes(query.trim().toLowerCase());
const matchAny = (item, query, fields) => !query.trim() || fields.some(field => textMatch(field(item), query));
const billingAccountNumber = customer => `BA-${customer.id.replace("CUST-", "")}-01`;
const customerFor = id => customers.find(customer => customer.id === id) || customers[0];

function leadMeta(lead) {
  const customer = customerFor(lead.customerId);
  const index = leads.findIndex(item => item.id === lead.id);
  const serviceNeeds = [lead.product, ...customer.services].filter(Boolean);
  return {
    ...lead,
    account: customer.name,
    accountNumber: customer.id,
    customerProfile: `${customer.segment} · ${customer.region} · ${customer.contact}`,
    customer,
    generalInformation: [
      `Primary contact: ${customer.contact}`,
      `Billing profile: ${customer.billingProfile}`,
      `Current services: ${customer.services.join(", ")}`
    ],
    serviceNeeds,
    qualification: ["Open", "Discovery", "Needs analysis", "Qualified"][index % 4],
    nextStep: ["Confirm use case", "Schedule discovery", "Review service fit", "Create opportunity"][index % 4],
    servicesSummary: customer.services.join(", "),
    status: lead.stage === "Qualified" ? "Open" : lead.stage
  };
}

function opportunityMeta(opportunity) {
  const customer = customerFor(opportunity.customerId);
  const index = opportunities.findIndex(item => item.id === opportunity.id);
  const estimatedMrc = Math.round(opportunity.value / 36);
  const estimatedNrc = 12500 + index * 4300;
  const margin = [39.8, 22.5, 35.7, 28.4][index % 4];
  const stage = stages[(index + 1) % 5];
  return {
    ...opportunity,
    account: customer.name,
    accountNumber: customer.id,
    billingAccount: billingAccountNumber(customer),
    market: customer.region,
    segment: customer.segment,
    serviceMix: customer.services.join(", "),
    serviceability: ["On-net", "Wireless footprint", "Mixed on-net / near-net", "Requires engineering"][index % 4],
    estimatedMrc,
    estimatedNrc,
    tcv: opportunity.value + estimatedNrc,
    margin,
    pricingRisk: margin < 25 ? "High" : margin < 32 ? "Medium" : "Low",
    owner: owners[index % owners.length],
    nextStep: ["Discovery call", "Pricing review", "Quote approval", "Customer follow-up"][index % 4],
    stage,
    status: stage === "Approval" ? "Approval Required" : stage
  };
}

function quoteMeta(quote) {
  const customer = customerFor(quote.customerId);
  const opportunity = opportunities.find(item => item.id === quote.opportunityId) || opportunities[0];
  const opportunityRecord = opportunityMeta(opportunity);
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
    opportunityId: opportunity.id,
    serviceability: opportunityRecord.serviceability,
    productPackage: quote.package,
    term: [36, 24, 48][index % 3],
    mrc,
    nrc,
    taxes: Math.round((mrc + nrc) * 0.084),
    discount,
    expiration: ["2026-06-15", "2026-06-30", "2026-05-31"][index % 3],
    owner: owners[(index + 1) % owners.length],
    tcv: quote.value + nrc,
    approvalRequired,
    approvalStatus: approvalRequired ? "Approval Required" : "Ready to Send",
    pricingRisk: quote.margin < 25 ? "High" : quote.margin < 31 ? "Medium" : "Low"
  };
}

function contractMeta(contract) {
  const customer = customerFor(contract.customerId);
  const opportunity = opportunities.find(item => item.id === contract.opportunityId) || opportunities[0];
  const quote = quotes.find(item => item.id === contract.quoteId) || quotes[0];
  return {
    ...contract,
    account: customer.name,
    accountNumber: customer.id,
    opportunityName: opportunity.name,
    quoteName: quote.package,
    pdfName: `${contract.id}.pdf`
  };
}

function activityRows(id) {
  return [
    { id: `${id}-A1`, date: "2026-05-12", type: "Discovery", owner: "Sarah Johnson", note: "Confirmed service mix, locations, contract timing, and decision process." },
    { id: `${id}-A2`, date: "2026-05-13", type: "Serviceability", owner: "Network Ops", note: "Wireline footprint and wireless backup review completed." },
    { id: `${id}-A3`, date: "2026-05-14", type: "Pricing", owner: "Pricing Desk", note: "Custom pricing package prepared with margin guardrails." }
  ];
}

function WorkQueue({ opportunities: opps, quotes: quoteRows, setRoute }) {
  const workItems = [
    ...opps.slice(0, 3).map(item => ({
      id: item.id,
      type: "Opportunity",
      account: item.account,
      owner: item.owner,
      priority: item.pricingRisk === "High" ? "High" : "Normal",
      nextAction: item.nextStep,
      route: `details/opportunity/${item.id}`
    })),
    ...quoteRows.filter(item => item.approvalRequired).slice(0, 2).map(item => ({
      id: item.id,
      type: "Pricing Review",
      account: item.account,
      owner: item.owner,
      priority: item.pricingRisk,
      nextAction: "Review margin and approval",
      route: `details/quote/${item.id}`
    }))
  ];

  return (
    <Panel title="Work Queue" description="Open commercial work, approvals, and follow-ups.">
      <DataTable
        columns={[
          { key: "type", label: "Work Type" },
          { key: "id", label: "Record" },
          { key: "account", label: "Account" },
          { key: "priority", label: "Priority", render: row => <StatusTag tone={row.priority === "High" ? "warn" : "blue"}>{row.priority}</StatusTag> },
          { key: "nextAction", label: "Next Action" },
          { key: "owner", label: "Owner" },
          { key: "actions", label: "", render: row => <button className="link-button compact-action" type="button" onClick={() => setRoute(row.route)}>Open</button> }
        ]}
        rows={workItems}
      />
    </Panel>
  );
}

function TabToolbar({ children }) {
  return <div className="module-toolbar sales-tab-toolbar">{children}</div>;
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
  return (
    <div className="record-tabs" role="tablist">
      {tabs.map(tab => (
        <button key={tab} type="button" className={tab === active ? "active" : ""} onClick={() => onChange(tab)}>{tab}</button>
      ))}
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

function Modal({ title, subtitle = "Telecom sales workflow", children, actions, onClose }) {
  return (
    <div className="sales-crm-modal-backdrop">
      <section className="sales-crm-modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <strong>{title}</strong>
            <span>{subtitle}</span>
          </div>
          <button type="button" className="sales-crm-close" onClick={onClose}>×</button>
        </header>
        <div className="sales-crm-modal-body">{children}</div>
        <footer>{actions}</footer>
      </section>
    </div>
  );
}

function RecordHeader({ breadcrumb, title, status, subtitle, actions, meta }) {
  return (
    <section className="record-header">
      <div>
        <div className="breadcrumb">{breadcrumb.join(" / ")}</div>
        <div className="record-title-line">
          <h2>{title}</h2>
          {status && <StatusTag tone={["Approval Required", "At Risk", "High"].includes(status) ? "warn" : ["Approved", "Ready", "Active"].includes(status) ? "success" : "blue"}>{status}</StatusTag>}
        </div>
        {subtitle && <p>{subtitle}</p>}
        {meta && <div className="record-meta-row">{meta}</div>}
      </div>
      <div className="record-actions">{actions}</div>
    </section>
  );
}

function LeadDetail({ id, setRoute, showToast }) {
  const lead = leadMeta(leads.find(item => item.id === id) || leads[0]);
  const [tab, setTab] = useState("Qualification");
  const [editModal, setEditModal] = useState(false);
  const [activityModal, setActivityModal] = useState(false);
  const [convertModal, setConvertModal] = useState(false);

  return (
    <>
      <RecordHeader
        breadcrumb={["Sales", "Leads", lead.id]}
        title={lead.account}
        status={lead.status}
        subtitle={`${lead.source} · ${lead.product} · ${formatMoney(lead.estValue)} · ${lead.owner}`}
        actions={(
          <>
            <ActionButton icon="workflow" variant="button" onClick={() => setActivityModal(true)}>Log Activity</ActionButton>
            <ActionButton icon="settings" variant="button" onClick={() => setEditModal(true)}>Edit Lead</ActionButton>
            <ActionButton icon="opportunities" onClick={() => setConvertModal(true)}>Convert</ActionButton>
          </>
        )}
      />
      <SummaryStrip items={[
        { label: "Qualification", value: lead.qualification, note: lead.nextStep },
        { label: "Customer Profile", value: lead.customerProfile, note: lead.accountNumber },
        { label: "Estimated Value", value: formatMoney(lead.estValue), note: lead.servicesSummary },
        { label: "Owner", value: lead.owner, note: lead.source }
      ]} />
      <Tabs tabs={leadTabs} active={tab} onChange={setTab} />
      {tab === "Qualification" && (
        <section className="record-main-layout">
          <Panel title="Lead overview" description="Basic lead information, qualification state, and service interest.">
            <div className="field-grid">
              <MiniStat label="Account" value={lead.account} note={lead.accountNumber} />
              <MiniStat label="Source" value={lead.source} note={lead.qualification} />
              <MiniStat label="Interest" value={lead.product} note={lead.servicesSummary} />
              <MiniStat label="Value" value={formatMoney(lead.estValue)} note="Potential deal size" />
            </div>
            <p className="small-muted">{lead.generalInformation.join(" | ")}</p>
          </Panel>
          <Panel title="Activity timeline" description="Calls, texts, emails, and meetings logged against the lead.">
            <div className="timeline">
              {activityRows(lead.id).map(item => (
                <div className="timeline-item" key={`${item.date}-${item.type}`}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>{item.type}</strong>
                    <div className="small-muted">{item.date} · {item.note}</div>
                  </div>
                  <StatusTag tone="blue">{item.owner}</StatusTag>
                </div>
              ))}
            </div>
          </Panel>
        </section>
      )}
      {tab === "Account Fit" && (
        <section className="record-main-layout">
          <Panel title="Customer information" description="General customer context and qualification notes.">
            <DataTable
              columns={[{ key: "field", label: "Field" }, { key: "value", label: "Value" }]}
              rows={[
                { id: "lead-contact", field: "Primary contact", value: lead.customer.contact },
                { id: "lead-segment", field: "Segment", value: lead.customer.segment },
                { id: "lead-region", field: "Region", value: lead.customer.region },
                { id: "lead-profile", field: "Billing profile", value: lead.customer.billingProfile }
              ]}
            />
          </Panel>
          <Panel title="Lead notes" description="Quick reference for the account team.">
            <div className="list">
              {lead.generalInformation.map(entry => (
                <div className="list-item" key={entry}>
                  <div><div className="title">{entry}</div></div>
                </div>
              ))}
            </div>
          </Panel>
        </section>
      )}
      {tab === "Conversion Plan" && (
        <Panel title="Service needs" description="General services the lead could obtain.">
          <DataTable
            columns={[{ key: "service", label: "Service" }, { key: "fit", label: "Fit" }, { key: "notes", label: "Notes" }]}
            rows={lead.serviceNeeds.map((service, index) => ({
              id: `${lead.id}-svc-${index}`,
              service,
              fit: index === 0 ? "Primary" : "Related",
              notes: index === 0 ? "Direct lead interest" : "Current account context"
            }))}
          />
        </Panel>
      )}
      {tab === "Activity" && (
        <Panel title="Lead activity" description="Lead touchpoints and qualification notes.">
          <DataTable columns={[{ key: "date", label: "Date" }, { key: "type", label: "Type" }, { key: "owner", label: "Owner" }, { key: "note", label: "Note" }]} rows={activityRows(lead.id)} />
        </Panel>
      )}
      {editModal && (
        <Modal
          title="Edit lead"
          onClose={() => setEditModal(false)}
          actions={(
            <>
              <button className="button" type="button" onClick={() => { setEditModal(false); showToast("Lead information updated"); }}>Save</button>
              <button className="ghost-button" type="button" onClick={() => setEditModal(false)}>Cancel</button>
            </>
          )}
        >
          <form className="modal-form">
            <label>Account<input defaultValue={lead.account} /></label>
            <label>Contact<input defaultValue={lead.customer.contact} /></label>
            <label>Source<select defaultValue={lead.source}><option>Partner referral</option><option>Website</option><option>Outbound</option></select></label>
            <label>Product interest<input defaultValue={lead.product} /></label>
            <label>Service needs<input defaultValue={lead.serviceNeeds.join(", ")} /></label>
            <label>Notes<textarea defaultValue={lead.generalInformation.join("\n")} /></label>
          </form>
        </Modal>
      )}
      {activityModal && (
        <Modal
          title="Log activity"
          onClose={() => setActivityModal(false)}
          actions={(
            <>
              <button className="button" type="button" onClick={() => { setActivityModal(false); showToast("Lead activity logged"); }}>Save</button>
              <button className="ghost-button" type="button" onClick={() => setActivityModal(false)}>Cancel</button>
            </>
          )}
        >
          <form className="modal-form">
            <label>Activity type<select><option>Call</option><option>Text</option><option>Email</option><option>Meeting</option></select></label>
            <label>Summary<textarea placeholder="Capture the customer interaction" /></label>
            <label>Outcome<select><option>Left voicemail</option><option>Connected</option><option>Follow-up scheduled</option><option>Needs review</option></select></label>
            <label>Next step<input placeholder="Book discovery or send recap" /></label>
          </form>
        </Modal>
      )}
      {convertModal && (
        <Modal
          title="Convert lead to opportunity"
          onClose={() => setConvertModal(false)}
          actions={(
            <>
              <button className="button" type="button" onClick={() => { setConvertModal(false); showToast("Lead converted to opportunity"); setRoute(`details/opportunity/${opportunities[0].id}`); }}>Convert</button>
              <button className="ghost-button" type="button" onClick={() => setConvertModal(false)}>Cancel</button>
            </>
          )}
        >
          <form className="modal-form">
            <label>Opportunity name<input defaultValue={`${lead.account} expansion opportunity`} /></label>
            <label>Owner<select defaultValue={lead.owner}>{owners.map(owner => <option key={owner}>{owner}</option>)}</select></label>
            <label>Estimated value<input defaultValue={formatMoney(lead.estValue)} /></label>
            <label>Service focus<input defaultValue={lead.product} /></label>
          </form>
        </Modal>
      )}
    </>
  );
}

function OpportunityDetail({ id, setRoute, showToast }) {
  const opportunity = opportunityMeta(opportunities.find(item => item.id === id) || opportunities[0]);
  const relatedQuotes = quotes.map(quoteMeta).filter(item => item.opportunityId === opportunity.id);
  const [tab, setTab] = useState("Summary");
  const [actionsModal, setActionsModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [activityModal, setActivityModal] = useState(false);
  const [orderModal, setOrderModal] = useState(false);

  return (
    <>
      <RecordHeader
        breadcrumb={["Sales", "Opportunities", opportunity.id]}
        title={opportunity.name}
        status={opportunity.status}
        subtitle={`${opportunity.account} · ${opportunity.stage} · ${opportunity.probability}% · ${formatMoney(opportunity.amount)} · ${opportunity.owner} · Close ${opportunity.closeDate}`}
        actions={(
          <>
            <ActionButton icon="workflow" variant="button" onClick={() => setActivityModal(true)}>Log Activity</ActionButton>
            <ActionButton icon="settings" variant="button" onClick={() => setEditModal(true)}>Edit Details</ActionButton>
            <ActionButton icon="opportunities" onClick={() => setActionsModal(true)}>Actions</ActionButton>
          </>
        )}
      />
      <SummaryStrip items={[
        { label: "Account", value: opportunity.account, note: opportunity.accountNumber },
        { label: "Stage", value: opportunity.stage, note: `${opportunity.probability}% probability` },
        { label: "Estimated MRC", value: formatMoney(opportunity.estimatedMrc), note: `NRC ${formatMoney(opportunity.estimatedNrc)}` },
        { label: "Owner", value: opportunity.owner, note: opportunity.nextStep }
      ]} />
      <Tabs tabs={opportunityTabs} active={tab} onChange={setTab} />
      {tab === "Summary" && (
        <section className="record-main-layout">
          <Panel title="Opportunity summary" description="Core sales, account, and commercial details.">
            <div className="field-grid">
              <MiniStat label="Account" value={opportunity.account} note={opportunity.billingAccount} />
              <MiniStat label="Segment" value={opportunity.segment} note={opportunity.market} />
              <MiniStat label="Opportunity Type" value={opportunity.type || "New Logo"} note={opportunity.source || "Sales"} />
              <MiniStat label="Product Interest" value={opportunity.serviceMix} note="Telecom services" />
            </div>
            <p className="small-muted">{opportunity.description || `${opportunity.account} is evaluating a service expansion.`}</p>
          </Panel>
          <Panel title="Activity timeline" description="Commercial motion and approval history.">
            <div className="timeline">
              {activityRows(opportunity.id).map(item => (
                <div className="timeline-item" key={`${item.date}-${item.type}`}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>{item.type}</strong>
                    <div className="small-muted">{item.date} · {item.note}</div>
                  </div>
                  <StatusTag tone="blue">{item.owner}</StatusTag>
                </div>
              ))}
            </div>
          </Panel>
        </section>
      )}
      {tab === "Serviceability" && (
        <Panel title="Serviceability by location" description="Wireline footprint, wireless coverage, install complexity, and engineering work.">
          <DataTable
            columns={[
              { key: "loc", label: "Location" },
              { key: "result", label: "Result" },
              { key: "circuits", label: "Circuits" },
              { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Review" ? "warn" : "success"}>{row.status}</StatusTag> }
            ]}
            rows={[
              { id: "L1", loc: "HQ", result: "On-net fiber", circuits: 2, status: "Serviceable" },
              { id: "L2", loc: "Branch North", result: "Near-net", circuits: 1, status: "Serviceable" },
              { id: "L3", loc: "Warehouse", result: "Engineering review", circuits: 1, status: "Review" }
            ]}
          />
        </Panel>
      )}
      {tab === "Quote Build" && (
        <Panel title="Quote build" description="Products, billing codes, MRC, NRC, cost, and margin by service line.">
          <DataTable
            columns={[
              { key: "product", label: "Product" },
              { key: "category", label: "Category" },
              { key: "billingCode", label: "Billing Code" },
              { key: "mrc", label: "MRC", render: row => formatMoney(row.mrc) },
              { key: "nrc", label: "NRC", render: row => formatMoney(row.nrc) },
              { key: "cost", label: "Cost", render: row => formatMoney(row.cost) },
              { key: "margin", label: "Margin", render: row => `${row.margin}%` }
            ]}
            rows={[
              { id: `${opportunity.id}-L1`, product: "Fiber / DIA Access", category: "Wireline", billingCode: "DIA-MRC", mrc: Math.round(opportunity.estimatedMrc * 0.58), nrc: Math.round(opportunity.estimatedNrc * 0.48), cost: Math.round(opportunity.estimatedMrc * 0.34), margin: 41 },
              { id: `${opportunity.id}-L2`, product: "Managed Router / CPE", category: "Managed", billingCode: "CPE-MRC", mrc: Math.round(opportunity.estimatedMrc * 0.18), nrc: Math.round(opportunity.estimatedNrc * 0.22), cost: Math.round(opportunity.estimatedMrc * 0.12), margin: 33 },
              { id: `${opportunity.id}-L3`, product: "Wireless Backup", category: "Wireless", billingCode: "WLS-BACKUP", mrc: Math.round(opportunity.estimatedMrc * 0.14), nrc: Math.round(opportunity.estimatedNrc * 0.12), cost: Math.round(opportunity.estimatedMrc * 0.08), margin: 43 }
            ]}
          />
        </Panel>
      )}
      {tab === "Pricing" && (
        <Panel title="Pricing guardrails" description="Approval thresholds and pricing controls.">
          <div className="field-grid">
            <MiniStat label="Minimum Margin" value="28%" />
            <MiniStat label="Discount Limit" value="12%" />
            <MiniStat label="Competitor Pressure" value="Medium" />
            <MiniStat label="Approval" value={opportunity.pricingRisk === "Low" ? "Not required" : "Required"} />
          </div>
        </Panel>
      )}
      {tab === "Approvals" && (
        <Panel title="Approval routing" description="Pricing, margin, discount, promo, and contract approval status.">
          <DataTable
            columns={[
              { key: "step", label: "Step" },
              { key: "owner", label: "Owner" },
              { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Approved" ? "success" : row.status === "Pending" ? "warn" : "blue"}>{row.status}</StatusTag> },
              { key: "notes", label: "Notes" }
            ]}
            rows={[
              { id: "A1", step: "Pricing review", owner: "Pricing Desk", status: "Approved", notes: "Floor price validated" },
              { id: "A2", step: "Sales manager", owner: opportunity.owner, status: "Pending", notes: "Discount exception" }
            ]}
          />
        </Panel>
      )}
      {tab === "Activities" && (
        <Panel title="Activity timeline" description="Discovery, pricing, customer, and serviceability events.">
          <DataTable columns={[{ key: "date", label: "Date" }, { key: "type", label: "Type" }, { key: "owner", label: "Owner" }, { key: "note", label: "Note" }]} rows={activityRows(opportunity.id)} />
        </Panel>
      )}
      {tab === "Contract" && (
        <Panel title="Contract terms" description="MSA, order form, renewal, ramp, install terms, and commercial clauses.">
          <div className="field-grid">
            <MiniStat label="Term" value="36 months" />
            <MiniStat label="MSA" value="Existing" />
            <MiniStat label="Ramp" value="90 day" />
            <MiniStat label="Install Waiver" value="Eligible" />
          </div>
        </Panel>
      )}
      {tab === "Order Handoff" && (
        <Panel title="Quote-to-order handoff" description="Operational package for Orders, provisioning, billing, and service activation.">
          <DataTable
            columns={[
              { key: "item", label: "Handoff Item" },
              { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Ready" ? "success" : "warn"}>{row.status}</StatusTag> },
              { key: "owner", label: "Owner" }
            ]}
            rows={[
              { id: "H1", item: "Approved quote", status: opportunity.pricingRisk === "Low" ? "Ready" : "Pending", owner: "Sales" },
              { id: "H2", item: "Serviceability package", status: "Ready", owner: "Network" },
              { id: "H3", item: "Billing codes", status: "Ready", owner: "Pricing" }
            ]}
          />
        </Panel>
      )}
      {actionsModal && (
        <Modal
          title="Opportunity actions"
          subtitle="Sales workflow controls for the selected opportunity."
          onClose={() => setActionsModal(false)}
          actions={<button className="button" type="button" onClick={() => setActionsModal(false)}>Done</button>}
        >
          <div className="menu-actions">
            <button className="menu-action" type="button" onClick={() => showToast("Service add workflow opened")}><strong>Add Services</strong><span>Attach service packages to the opportunity.</span></button>
            <button className="menu-action" type="button" onClick={() => showToast("Quote generation opened")}><strong>Generate Quote</strong><span>Create a quote from this opportunity.</span></button>
            <button className="menu-action" type="button" onClick={() => showToast("Address check started")}><strong>Run Address Check</strong><span>Validate serviceability for the customer.</span></button>
            <button className="menu-action" type="button" onClick={() => showToast("Opportunity submitted for approval")}><strong>Send for Approval</strong><span>Route pricing and commercial approval.</span></button>
            <button className="menu-action" type="button" onClick={() => showToast("Document upload workflow opened")}><strong>Upload Documents</strong><span>Attach supporting files.</span></button>
            <button className="menu-action" type="button" onClick={() => setOrderModal(true)}><strong>Create Order</strong><span>Begin entering order details.</span></button>
          </div>
        </Modal>
      )}
      {editModal && (
        <Modal
          title="Edit opportunity"
          subtitle="Update deal details, services, and customer context."
          onClose={() => setEditModal(false)}
          actions={(
            <>
              <button className="button" type="button" onClick={() => { setEditModal(false); showToast("Opportunity updated"); }}>Save</button>
              <button className="ghost-button" type="button" onClick={() => setEditModal(false)}>Cancel</button>
            </>
          )}
        >
          <form className="modal-form">
            <label>Opportunity name<input defaultValue={opportunity.name} /></label>
            <label>Account<input defaultValue={opportunity.account} /></label>
            <label>Service mix<input defaultValue={opportunity.serviceMix} /></label>
            <label>Owner<select defaultValue={opportunity.owner}>{owners.map(owner => <option key={owner}>{owner}</option>)}</select></label>
            <label>Notes<textarea placeholder="Update opportunity context and customer details" /></label>
          </form>
        </Modal>
      )}
      {activityModal && (
        <Modal
          title="Log activity"
          subtitle="Calls, texts, emails, meetings, and follow-ups."
          onClose={() => setActivityModal(false)}
          actions={(
            <>
              <button className="button" type="button" onClick={() => { setActivityModal(false); showToast("Opportunity activity logged"); }}>Save</button>
              <button className="ghost-button" type="button" onClick={() => setActivityModal(false)}>Cancel</button>
            </>
          )}
        >
          <form className="modal-form">
            <label>Activity type<select><option>Call</option><option>Text</option><option>Email</option><option>Meeting</option></select></label>
            <label>Summary<textarea placeholder="Capture the activity details" /></label>
            <label>Outcome<select><option>Connected</option><option>Left voicemail</option><option>Follow-up scheduled</option><option>Needs review</option></select></label>
            <label>Next step<input placeholder="Next action" /></label>
          </form>
        </Modal>
      )}
      {orderModal && (
        <Modal
          title="Create order"
          subtitle="Begin entering order details."
          onClose={() => setOrderModal(false)}
          actions={(
            <>
              <button className="button" type="button" onClick={() => { setOrderModal(false); showToast("Order details started"); setRoute("orders"); }}>Create</button>
              <button className="ghost-button" type="button" onClick={() => setOrderModal(false)}>Cancel</button>
            </>
          )}
        >
          <form className="modal-form">
            <label>Customer<input defaultValue={opportunity.account} /></label>
            <label>Opportunity<input defaultValue={opportunity.name} /></label>
            <label>Service<input defaultValue={opportunity.serviceMix} /></label>
            <label>Requested due date<input defaultValue={opportunity.closeDate} /></label>
            <label>Notes<textarea placeholder="Begin entering order details" /></label>
          </form>
        </Modal>
      )}
    </>
  );
}

function QuoteDetail({ id, setRoute, showToast }) {
  const quote = quoteMeta(quotes.find(item => item.id === id) || quotes[0]);
  const opportunity = opportunityMeta(opportunities.find(item => item.id === quote.opportunityId) || opportunities[0]);
  const [tab, setTab] = useState("Quote Summary");
  const [actionsModal, setActionsModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [orderModal, setOrderModal] = useState(false);

  return (
    <>
      <RecordHeader
        breadcrumb={["Sales", "Quotes", quote.id]}
        title={`${quote.account} quote`}
        status={quote.approvalStatus}
        subtitle={`${quote.productPackage} · ${quote.opportunityName}`}
        actions={(
          <>
            <ActionButton icon="workflow" variant="button" onClick={() => setActionsModal(true)}>Review</ActionButton>
            <ActionButton icon="settings" variant="button" onClick={() => setEditModal(true)}>Edit Quote</ActionButton>
            <ActionButton icon="orders" onClick={() => setOrderModal(true)}>Create Order</ActionButton>
          </>
        )}
        meta={<div className="record-meta-chips"><StatusTag tone="blue">{quote.term} mo</StatusTag><StatusTag tone={quote.approvalRequired ? "warn" : "success"}>{quote.margin}% margin</StatusTag></div>}
      />
      <SummaryStrip items={[
        { label: "Account", value: quote.account, note: quote.billingAccount },
        { label: "Term", value: `${quote.term} mo`, note: quote.productPackage },
        { label: "Total MRC", value: formatMoney(quote.mrc), note: `NRC ${formatMoney(quote.nrc)}` },
        { label: "Discount", value: `${quote.discount}%`, note: quote.approvalRequired ? "Approval required" : "Within guardrail" }
      ]} />
      <Tabs tabs={quoteTabs} active={tab} onChange={setTab} />
      {tab === "Quote Summary" && <Panel title="Quote summary" description="Commercial quote details, account, opportunity, term, and status."><div className="field-grid"><MiniStat label="Account" value={quote.account} note={quote.accountNumber} /><MiniStat label="Opportunity" value={quote.opportunityName} /><MiniStat label="Package" value={quote.productPackage} /><MiniStat label="Term" value={`${quote.term} months`} /><MiniStat label="Serviceability" value={quote.serviceability} /><MiniStat label="Owner" value={quote.owner} /></div></Panel>}
      {tab === "Line Items" && <Panel title="Quote line items" description="Product, billing code, MRC, NRC, cost, and margin."><DataTable columns={[{ key: "product", label: "Product" }, { key: "category", label: "Category" }, { key: "billingCode", label: "Billing Code" }, { key: "mrc", label: "MRC", render: row => formatMoney(row.mrc) }, { key: "nrc", label: "NRC", render: row => formatMoney(row.nrc) }, { key: "cost", label: "Cost", render: row => formatMoney(row.cost) }, { key: "margin", label: "Margin", render: row => `${row.margin}%` }]} rows={[{ id: "L1", product: "Fiber / DIA Access", category: "Wireline", billingCode: "DIA-MRC", mrc: quote.mrc, nrc: quote.nrc, cost: Math.round(quote.mrc * 0.58), margin: 39 }, { id: "L2", product: "Managed Router / CPE", category: "Managed", billingCode: "CPE-MRC", mrc: Math.round(quote.mrc * 0.42), nrc: Math.round(quote.nrc * 0.35), cost: Math.round(quote.mrc * 0.24), margin: 31 }, { id: "L3", product: "Wireless Backup", category: "Wireless", billingCode: "WLS-BACKUP", mrc: Math.round(quote.mrc * 0.18), nrc: Math.round(quote.nrc * 0.12), cost: Math.round(quote.mrc * 0.09), margin: 43 }]} /></Panel>}
      {tab === "Pricing Waterfall" && <Panel title="Pricing waterfall" description="List price, costs, promos, discounts, margin, and recommended customer rate."><div className="sales-crm-waterfall"><div><span>List MRC</span><strong>{formatMoney(quote.mrc)}</strong></div><div className="negative"><span>Promo Credit</span><strong>{formatMoney(-Math.round(quote.mrc * 0.06))}</strong></div><div className="negative"><span>Custom Discount</span><strong>{formatMoney(-Math.round(quote.mrc * quote.discount / 100))}</strong></div><div className="final"><span>Customer MRC</span><strong>{formatMoney(Math.round(quote.mrc * (1 - quote.discount / 100)))}</strong></div></div></Panel>}
      {tab === "Approvals" && <Panel title="Quote approvals" description="Approval route and approval decisions." action={<div className="module-toolbar"><button className="button" type="button" onClick={() => showToast("Quote approved")}>Approve</button><button className="ghost-button" type="button" onClick={() => showToast("Quote rejected")}>Reject</button><button className="ghost-button" type="button" onClick={() => showToast("Quote review opened")}>Review</button></div>}><DataTable columns={[{ key: "step", label: "Step" }, { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Approved" ? "success" : "warn"}>{row.status}</StatusTag> }, { key: "owner", label: "Owner" }, { key: "notes", label: "Notes" }]} rows={[{ id: "QA1", step: "Pricing", status: quote.approvalRequired ? "Pending" : "Approved", owner: "Pricing Desk", notes: "Margin guardrail" }, { id: "QA2", step: "Finance", status: quote.approvalRequired ? "Queued" : "Approved", owner: "Finance", notes: "Discount review" }]} /></Panel>}
      {tab === "PDF Preview" && <Panel title="Quote PDF preview" description="Customer-facing telecom quote structure."><div className="sales-crm-quote-document"><DataTable columns={[{ key: "product", label: "Product" }, { key: "mrc", label: "Monthly", render: row => formatMoney(row.mrc) }, { key: "nrc", label: "One-time", render: row => formatMoney(row.nrc) }, { key: "serviceability", label: "Serviceability" }]} rows={[{ id: "P1", product: quote.productPackage, mrc: quote.mrc, nrc: quote.nrc, serviceability: quote.serviceability }]} /></div></Panel>}
      {tab === "Audit" && <Panel title="Quote audit" description="Quote changes, approvals, pricing edits, and customer delivery events."><DataTable columns={[{ key: "date", label: "Date" }, { key: "type", label: "Type" }, { key: "owner", label: "Owner" }, { key: "note", label: "Note" }]} rows={activityRows(quote.id)} /></Panel>}
      {actionsModal && (
        <Modal
          title="Quote review"
          subtitle="Pricing and sales workflows for this quote."
          onClose={() => setActionsModal(false)}
          actions={<button className="button" type="button" onClick={() => setActionsModal(false)}>Done</button>}
        >
          <div className="menu-actions">
            <button className="menu-action" type="button" onClick={() => showToast("Quote review opened")}><strong>Review</strong><span>Open the quote review workflow.</span></button>
            <button className="menu-action" type="button" onClick={() => setEditModal(true)}><strong>Edit Quote</strong><span>Update pricing and line items.</span></button>
            <button className="menu-action" type="button" onClick={() => showToast("Quote upload workflow opened")}><strong>Upload Information</strong><span>Attach supporting files.</span></button>
            <button className="menu-action" type="button" onClick={() => setOrderModal(true)}><strong>Create Order</strong><span>Begin entering order details.</span></button>
          </div>
        </Modal>
      )}
      {editModal && (
        <Modal
          title="Edit quote"
          subtitle="Update pricing, package, and supporting information."
          onClose={() => setEditModal(false)}
          actions={(
            <>
              <button className="button" type="button" onClick={() => { setEditModal(false); showToast("Quote updated"); }}>Save</button>
              <button className="ghost-button" type="button" onClick={() => setEditModal(false)}>Cancel</button>
            </>
          )}
        >
          <form className="modal-form">
            <label>Package<input defaultValue={quote.productPackage} /></label>
            <label>Account<input defaultValue={quote.account} /></label>
            <label>Term<select defaultValue={`${quote.term} mo`}><option>24 mo</option><option>36 mo</option><option>48 mo</option></select></label>
            <label>Discount<input defaultValue={`${quote.discount}%`} /></label>
            <label>Notes<textarea placeholder="Enter quote update notes" /></label>
          </form>
        </Modal>
      )}
      {orderModal && (
        <Modal
          title="Create order"
          subtitle="Begin entering order details."
          onClose={() => setOrderModal(false)}
          actions={(
            <>
              <button className="button" type="button" onClick={() => { setOrderModal(false); showToast("Order details started"); setRoute("orders"); }}>Create</button>
              <button className="ghost-button" type="button" onClick={() => setOrderModal(false)}>Cancel</button>
            </>
          )}
        >
          <form className="modal-form">
            <label>Customer<input defaultValue={quote.account} /></label>
            <label>Opportunity<input defaultValue={quote.opportunityName} /></label>
            <label>Service<input defaultValue={quote.productPackage} /></label>
            <label>Requested due date<input defaultValue={quote.expiration} /></label>
            <label>Notes<textarea placeholder="Begin entering order details" /></label>
          </form>
        </Modal>
      )}
    </>
  );
}

export function SalesModule({ setRoute, showToast }) {
  const [tab, setTab] = useState("Leads");
  const [leadQuery, setLeadQuery] = useState("");
  const [leadStage, setLeadStage] = useState("All stages");
  const [opportunityQuery, setOpportunityQuery] = useState("");
  const [opportunityStage, setOpportunityStage] = useState("All stages");
  const [opportunityOwner, setOpportunityOwner] = useState("All owners");
  const [accountQuery, setAccountQuery] = useState("");
  const [accountSegment, setAccountSegment] = useState("All segments");
  const [quoteQuery, setQuoteQuery] = useState("");
  const [quoteStatus, setQuoteStatus] = useState("All statuses");
  const [approvalQuery, setApprovalQuery] = useState("");
  const [approvalStatus, setApprovalStatus] = useState("All statuses");
  const [contractQuery, setContractQuery] = useState("");
  const [contractStatus, setContractStatus] = useState("All statuses");
  const [newLeadModal, setNewLeadModal] = useState(false);
  const [newOppModal, setNewOppModal] = useState(false);
  const [leadConvertModal, setLeadConvertModal] = useState(null);
  const [contractPreview, setContractPreview] = useState(null);

  const leadRows = useMemo(() => leads.map(leadMeta), []);
  const opportunityRows = useMemo(() => opportunities.map(opportunityMeta), []);
  const quoteRows = useMemo(() => quotes.map(quoteMeta), []);
  const contractRows = useMemo(() => contracts.map(contractMeta), []);

  const filteredLeads = leadRows.filter(lead => matchAny(lead, leadQuery, [item => item.id, item => item.account, item => item.product, item => item.source, item => item.owner]) && (leadStage === "All stages" || lead.qualification === leadStage || lead.status === leadStage));
  const filteredOpps = opportunityRows.filter(opportunity => matchAny(opportunity, opportunityQuery, [item => item.id, item => item.name, item => item.account, item => item.serviceMix, item => item.owner]) && (opportunityStage === "All stages" || opportunity.stage === opportunityStage) && (opportunityOwner === "All owners" || opportunity.owner === opportunityOwner));
  const filteredCustomers = customers.filter(customer => matchAny(customer, accountQuery, [item => item.id, item => item.name, item => item.segment, item => item.region, item => item.contact]) && (accountSegment === "All segments" || customer.segment === accountSegment));
  const filteredQuotes = quoteRows.filter(quote => matchAny(quote, quoteQuery, [item => item.id, item => item.account, item => item.productPackage, item => item.opportunityName, item => item.owner]) && (quoteStatus === "All statuses" || quote.status === quoteStatus));
  const filteredApprovals = quoteRows.filter(quote => quote.approvalRequired && matchAny(quote, approvalQuery, [item => item.id, item => item.account, item => item.productPackage, item => item.opportunityName]) && (approvalStatus === "All statuses" || quote.approvalStatus === approvalStatus));
  const filteredContracts = contractRows.filter(contract => matchAny(contract, contractQuery, [item => item.id, item => item.title, item => item.account, item => item.opportunityName, item => item.quoteName]) && (contractStatus === "All statuses" || contract.status === contractStatus));
  const pipeline = sum(filteredOpps, opportunity => opportunity.tcv);
  const weighted = sum(filteredOpps, opportunity => opportunity.tcv * opportunity.margin / 100);

  return (
    <>
      <PageHeader
        title="Sales"
        description="Telecom CRM workspace for leads, opportunities, custom pricing, approvals, contracts, and account selling motions."
        actions={(
          <>
            <ActionButton icon="sales" variant="button" onClick={() => setNewLeadModal(true)}>New Lead</ActionButton>
            <ActionButton icon="opportunities" variant="button" onClick={() => setNewOppModal(true)}>New Opportunity</ActionButton>
          </>
        )}
      />
      <WorkQueue opportunities={filteredOpps} quotes={filteredQuotes} setRoute={setRoute} />
      <SummaryStrip items={[
        { label: "Pipeline", value: formatMoney(pipeline), note: "TCV across open deals" },
        { label: "Forecast", value: formatMoney(weighted), note: "Probability adjusted" },
        { label: "Open Deals", value: filteredOpps.length, note: "Sales-owned opportunities" },
        { label: "At Risk", value: filteredOpps.filter(item => item.pricingRisk !== "Low").length, note: "Pricing or serviceability risk" }
      ]} />
      <Tabs tabs={salesTabs} active={tab} onChange={setTab} />
      {tab === "Leads" && (
        <Panel
          title="Leads"
          description="Lead qualification for telecom accounts and product interest."
          action={
            <TabToolbar>
              <SearchBox value={leadQuery} onChange={setLeadQuery} placeholder="Search leads" />
              <label className="inline-search">
                <Icon name="workflow" className="button-icon" />
                <select value={leadStage} onChange={event => setLeadStage(event.target.value)}>
                  {["All stages", "Open", "Discovery", "Needs analysis", "Qualified"].map(stage => <option key={stage}>{stage}</option>)}
                </select>
              </label>
            </TabToolbar>
          }
        >
          <DataTable
            columns={[
              { key: "id", label: "Lead" },
              { key: "account", label: "Account" },
              { key: "source", label: "Source" },
              { key: "qualification", label: "Qualification", render: row => <StatusTag>{row.qualification}</StatusTag> },
              { key: "product", label: "Product Interest" },
              { key: "estValue", label: "Estimated Value", render: row => formatMoney(row.estValue) },
              { key: "owner", label: "Owner" },
              { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/lead/${row.id}`)}>Open</button><button className="link-button compact-action" type="button" onClick={() => setLeadConvertModal(row)}>Convert</button></div> }
            ]}
            rows={filteredLeads}
          />
        </Panel>
      )}
      {tab === "Opportunities" && (
        <Panel
          title="Opportunities"
          description="Telecom pipeline records connected to accounts, services, pricing, and order conversion."
          action={
            <TabToolbar>
              <SearchBox value={opportunityQuery} onChange={setOpportunityQuery} placeholder="Search opportunities" />
              <label className="inline-search">
                <Icon name="workflow" className="button-icon" />
                <select value={opportunityStage} onChange={event => setOpportunityStage(event.target.value)}>
                  {["All stages", ...stages].map(stage => <option key={stage}>{stage}</option>)}
                </select>
              </label>
              <label className="inline-search">
                <Icon name="customers" className="button-icon" />
                <select value={opportunityOwner} onChange={event => setOpportunityOwner(event.target.value)}>
                  {["All owners", ...owners].map(owner => <option key={owner}>{owner}</option>)}
                </select>
              </label>
            </TabToolbar>
          }
        >
          <DataTable
            columns={[
              { key: "id", label: "Opportunity" },
              { key: "account", label: "Account" },
              { key: "serviceMix", label: "Services" },
              { key: "stage", label: "Stage", render: row => <StatusTag tone={row.stage === "Approval" ? "warn" : "blue"}>{row.stage}</StatusTag> },
              { key: "estimatedMrc", label: "MRC", render: row => formatMoney(row.estimatedMrc) },
              { key: "tcv", label: "TCV", render: row => formatMoney(row.tcv) },
              { key: "owner", label: "Owner" },
              { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/opportunity/${row.id}`)}>Open</button><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/quote/${quoteRows.find(item => item.opportunityId === row.id)?.id || quotes[0].id}`)}>Create Quote</button><button className="link-button compact-action" type="button" onClick={() => showToast("Opportunity activity started")}>Log Activity</button></div> }
            ]}
            rows={filteredOpps}
          />
        </Panel>
      )}
      {tab === "Accounts" && (
        <Panel
          title="Accounts"
          description="Customer records with open commercial and billing context."
          action={
            <TabToolbar>
              <SearchBox value={accountQuery} onChange={setAccountQuery} placeholder="Search accounts" />
              <label className="inline-search">
                <Icon name="workflow" className="button-icon" />
                <select value={accountSegment} onChange={event => setAccountSegment(event.target.value)}>
                  {["All segments", ...new Set(customers.map(customer => customer.segment))].map(segment => <option key={segment}>{segment}</option>)}
                </select>
              </label>
            </TabToolbar>
          }
        >
          <DataTable
            columns={[
              { key: "id", label: "Account Number" },
              { key: "name", label: "Account" },
              { key: "segment", label: "Segment" },
              { key: "region", label: "Region" },
              { key: "mrr", label: "MRR", render: row => formatMoney(row.mrr) },
              { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/customer/${row.id}`)}>Customer 360</button><button className="link-button compact-action" type="button" onClick={() => setNewOppModal(true)}>New Opportunity</button></div> }
            ]}
            rows={filteredCustomers}
          />
        </Panel>
      )}
      {tab === "Custom Pricing" && (
        <Panel
          title="Custom Pricing"
          description="Deal desk work for discount exceptions, term exceptions, margin review, and competitive responses."
          action={
            <TabToolbar>
              <SearchBox value={quoteQuery} onChange={setQuoteQuery} placeholder="Search quote, package, account" />
              <label className="inline-search">
                <Icon name="workflow" className="button-icon" />
                <select value={quoteStatus} onChange={event => setQuoteStatus(event.target.value)}>
                  {["All statuses", "Approval Required", "Ready to Send", "Draft", "Sent"].map(status => <option key={status}>{status}</option>)}
                </select>
              </label>
            </TabToolbar>
          }
        >
          <DataTable
            columns={[
              { key: "id", label: "Quote" },
              { key: "account", label: "Account" },
              { key: "pricingRisk", label: "Risk", render: row => <StatusTag tone={row.pricingRisk === "High" ? "warn" : "blue"}>{row.pricingRisk}</StatusTag> },
              { key: "discount", label: "Discount", render: row => `${row.discount}%` },
              { key: "term", label: "Term", render: row => `${row.term} mo` },
              { key: "approvalStatus", label: "Status", render: row => <StatusTag tone={row.approvalRequired ? "warn" : "success"}>{row.approvalStatus}</StatusTag> },
              { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/quote/${row.id}`)}>Review</button></div> }
            ]}
            rows={filteredQuotes.filter(row => row.customPrice || row.approvalRequired)}
          />
        </Panel>
      )}
      {tab === "Approvals" && (
        <Panel
          title="Approvals"
          description="Pricing, margin, promo, contract, and quote approval queue."
          action={
            <TabToolbar>
              <SearchBox value={approvalQuery} onChange={setApprovalQuery} placeholder="Search approvals" />
              <label className="inline-search">
                <Icon name="workflow" className="button-icon" />
                <select value={approvalStatus} onChange={event => setApprovalStatus(event.target.value)}>
                  {["All statuses", "Approval Required", "Ready to Send", "Draft", "Sent"].map(status => <option key={status}>{status}</option>)}
                </select>
              </label>
            </TabToolbar>
          }
        >
          <DataTable
            columns={[
              { key: "id", label: "Quote" },
              { key: "account", label: "Account" },
              { key: "approvalStatus", label: "Approval" },
              { key: "discount", label: "Discount", render: row => `${row.discount}%` },
              { key: "owner", label: "Owner" },
              { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => showToast("Quote approved")}>Approve</button><button className="link-button compact-action" type="button" onClick={() => showToast("Quote rejected")}>Reject</button><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/quote/${row.id}`)}>Review</button></div> }
            ]}
            rows={filteredApprovals.filter(row => matchAny(row, approvalQuery, [item => item.id, item => item.account, item => item.productPackage, item => item.opportunityName]))}
          />
        </Panel>
      )}
      {tab === "Contracts" && (
        <Panel
          title="Contracts"
          description="Contract term, MSA, order form, ramp, install terms, and renewal tracking."
          action={
            <TabToolbar>
              <SearchBox value={contractQuery} onChange={setContractQuery} placeholder="Search contracts" />
              <label className="inline-search">
                <Icon name="workflow" className="button-icon" />
                <select value={contractStatus} onChange={event => setContractStatus(event.target.value)}>
                  {["All statuses", "Open", "Ready", "Review"].map(status => <option key={status}>{status}</option>)}
                </select>
              </label>
            </TabToolbar>
          }
        >
          <DataTable
            columns={[
              { key: "id", label: "Contract" },
              { key: "account", label: "Account" },
              { key: "opportunityName", label: "Opportunity" },
              { key: "quoteName", label: "Quote" },
              { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Ready" ? "success" : row.status === "Review" ? "warn" : "blue"}>{row.status}</StatusTag> },
              { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => setContractPreview(row)}>Open Contract</button><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/opportunity/${row.opportunityId}`)}>Open Opportunity</button><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/quote/${row.quoteId}`)}>Open Quote</button><button className="link-button compact-action" type="button" onClick={() => setRoute("customer-360")}>Open Account</button></div> }
            ]}
            rows={filteredContracts}
          />
        </Panel>
      )}
      {newOppModal && (
        <Modal
          title="New opportunity"
          subtitle="Create telecom opportunity"
          onClose={() => setNewOppModal(false)}
          actions={(
            <>
              <button className="button" type="button" onClick={() => { setNewOppModal(false); showToast("Opportunity saved"); }}>Save</button>
              <button className="ghost-button" type="button" onClick={() => setNewOppModal(false)}>Cancel</button>
            </>
          )}
        >
          <form className="modal-form">
            <label>Opportunity Name<input placeholder="Account expansion or new logo" /></label>
            <label>Account<select>{customers.map(customer => <option key={customer.id}>{customer.name}</option>)}</select></label>
            <label>Source<select><option>Partner referral</option><option>Account planning</option><option>Outbound</option></select></label>
            <label>Product interest<select>{opportunities.map(item => <option key={item.id}>{item.name}</option>)}</select></label>
            <label>Estimated MRC<input placeholder="$0" /></label>
            <label>Owner<input placeholder="Sales owner" /></label>
          </form>
        </Modal>
      )}
      {newLeadModal && (
        <Modal
          title="New lead"
          subtitle="Create telecom lead"
          onClose={() => setNewLeadModal(false)}
          actions={(
            <>
              <button className="button" type="button" onClick={() => { setNewLeadModal(false); showToast("Lead saved"); }}>Save</button>
              <button className="ghost-button" type="button" onClick={() => setNewLeadModal(false)}>Cancel</button>
            </>
          )}
        >
          <form className="modal-form">
            <label>Account Name<input placeholder="Prospect account" /></label>
            <label>Contact Name<input placeholder="Primary contact" /></label>
            <label>Source<select><option>Partner referral</option><option>Website</option><option>Outbound</option></select></label>
            <label>Product Interest<input placeholder="Fiber, wireless, SD-WAN, voice" /></label>
            <label>Estimated Value<input placeholder="$0" /></label>
            <label>Notes<textarea placeholder="What services could be obtained, timeline, and qualification notes." /></label>
          </form>
        </Modal>
      )}
      {leadConvertModal && (
        <Modal
          title={`Convert ${leadConvertModal.id}`}
          subtitle="Lead to opportunity"
          onClose={() => setLeadConvertModal(null)}
          actions={(
            <>
              <button className="button" type="button" onClick={() => { setLeadConvertModal(null); showToast("Lead converted to opportunity"); setRoute(`details/opportunity/${opportunities[0].id}`); }}>Convert</button>
              <button className="ghost-button" type="button" onClick={() => setLeadConvertModal(null)}>Cancel</button>
            </>
          )}
        >
          <form className="modal-form">
            <label>Account<input defaultValue={leadConvertModal.account} /></label>
            <label>Product<input defaultValue={leadConvertModal.product} /></label>
            <label>Estimated Value<input defaultValue={formatMoney(leadConvertModal.estValue)} /></label>
            <label>Owner<input defaultValue={leadConvertModal.owner} /></label>
          </form>
        </Modal>
      )}
      {contractPreview && (
        <Modal
          title={`Contract PDF - ${contractPreview.id}`}
          subtitle="Open contract PDF of contract"
          onClose={() => setContractPreview(null)}
          actions={(
            <>
              <button className="button" type="button" onClick={() => { showToast(`Opened ${contractPreview.pdfName}`); setContractPreview(null); }}>Open PDF</button>
              <button className="ghost-button" type="button" onClick={() => setContractPreview(null)}>Close</button>
            </>
          )}
        >
          <div className="invoice-pdf-preview" style={{ minHeight: 320 }}>
            <strong>{contractPreview.title}</strong>
            <p>{contractPreview.account}</p>
            <p>{contractPreview.opportunityName}</p>
            <p>{contractPreview.quoteName}</p>
            <p>Status: {contractPreview.status}</p>
            <p>This preview stands in for the contract PDF and gives users a quick document view before opening the file.</p>
          </div>
        </Modal>
      )}
    </>
  );
}

export { LeadDetail as SalesLeadDetail, OpportunityDetail as SalesOpportunityDetail, QuoteDetail as SalesQuoteDetail };
