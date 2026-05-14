import React, { useEffect, useMemo, useState } from "react";
import { Shell, PageHeader } from "./components/Shell";
import { Icon } from "./components/Icons";
import { DataTable, MetricCard, Panel, StatusTag, formatMoney } from "./components/Primitives";
import {
  adjustments,
  customers,
  invoices,
  leads,
  networkEvents,
  opportunities,
  orders,
  pricingPrograms,
  quotes,
  reportDefinitions,
  reportRows,
  services,
  tickets
} from "./data/mockData";
import { downloadBlob, makeXlsx } from "./utils/export";

const customerName = id => customers.find(customer => customer.id === id)?.name || id;
const sum = (items, selector) => items.reduce((total, item) => total + selector(item), 0);
const textMatch = (value, query) => String(value ?? "").toLowerCase().includes(query.trim().toLowerCase());
const matchAny = (item, query, fields) => !query.trim() || fields.some(field => textMatch(field(item), query));

const detailBackRoutes = {
  lead: "sales",
  opportunity: "sales",
  quote: "sales",
  customer: "customer-360",
  product: "products",
  ticket: "customer-service",
  network: "customer-service",
  invoice: "billing",
  service: "billing",
  "pricing-strategic": "pricing",
  "pricing-promos": "pricing",
  "pricing-offers": "pricing",
  "pricing-costs": "pricing",
  "pricing-coefficients": "pricing",
  "pricing-reporting": "pricing",
  "product-development": "products",
  "product-lifecycle": "products",
  "product-costs": "products",
  "product-offers": "products",
  "product-reporting": "products"
};

function serviceInstancesFor(customer) {
  return customer.services.flatMap((service, index) => [
    {
      id: `${customer.id}-SVC-${index + 1}A`,
      customerId: customer.id,
      service,
      status: "Active",
      location: index % 2 === 0 ? "Primary site" : "Branch site",
      circuitId: `CKT-${customer.id.slice(-4)}-${index + 1}01`,
      promo: customer.activeOffers[0] || "Standard rate",
      price: 8800 + index * 2100
    },
    ...(service.includes("Fiber") || service.includes("DIA") ? [{
      id: `${customer.id}-SVC-${index + 1}B`,
      customerId: customer.id,
      service,
      status: "Pending disconnect",
      location: "Backup circuit",
      circuitId: `CKT-${customer.id.slice(-4)}-${index + 1}02`,
      promo: "No promo",
      price: 6400 + index * 1700
    }] : [])
  ]);
}

function usageRowsFor(customer) {
  return invoices.filter(invoice => invoice.customerId === customer.id).map(invoice => ({
    id: `USG-${invoice.id}`,
    invoiceId: invoice.id,
    period: "May 2026",
    usage: invoice.usage,
    ratedAmount: invoice.amount,
    status: invoice.status
  }));
}

function currentHashRoute() {
  const route = window.location.hash.replace(/^#\/?/, "");
  return route === "quotes" ? "sales" : route || "dashboard";
}

function useRoute() {
  const [route, setRouteState] = useState(currentHashRoute);
  useEffect(() => {
    const handleHashChange = () => setRouteState(currentHashRoute());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);
  function setRoute(next) {
    window.location.hash = `/${next}`;
    setRouteState(next);
  }
  return [route, setRoute];
}

function Toast({ toast }) {
  return toast ? <div className="toast">{toast}</div> : null;
}

function ToolbarButton({ icon, children, onClick, variant = "ghost-button" }) {
  return (
    <button className={variant} type="button" onClick={onClick}>
      <Icon name={icon} className="button-icon" />
      {children}
    </button>
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

function Modal({ title, children, actions, onClose }) {
  return (
    <div className="modal-backdrop">
      <section className="modal workflow-modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div className="side-panel-header">
          <div>
            <strong id="modalTitle">{title}</strong>
            <span>Northstar Telecom</span>
          </div>
          <button className="icon-close" type="button" onClick={onClose}>x</button>
        </div>
        {children}
        <div className="modal-actions">{actions}</div>
      </section>
    </div>
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

function ActionButton({ children, onClick, variant = "ghost-button", icon = "workflow" }) {
  return <ToolbarButton icon={icon} variant={variant} onClick={onClick}>{children}</ToolbarButton>;
}

function Tabs({ tabs, active, onChange }) {
  return (
    <div className="record-tabs" role="tablist">
      {tabs.map(tab => (
        <button className={tab === active ? "active" : ""} type="button" key={tab} onClick={() => onChange(tab)}>{tab}</button>
      ))}
    </div>
  );
}

function Breadcrumb({ items }) {
  return <div className="breadcrumb">{items.join(" / ")}</div>;
}

function RecordHeader({ breadcrumb, title, status, subtitle, actions }) {
  return (
    <section className="record-header">
      <div>
        <Breadcrumb items={breadcrumb} />
        <div className="record-title-line">
          <h2>{title}</h2>
          {status && <StatusTag tone={["Past Due", "At Risk", "Approval Required", "Pending Network", "Disputed"].includes(status) ? "warn" : ["Active", "Approved", "Paid", "Completed"].includes(status) ? "success" : "blue"}>{status}</StatusTag>}
        </div>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="record-actions">{actions}</div>
    </section>
  );
}

function SummaryStrip({ items }) {
  return (
    <section className="summary-strip">
      {items.map(item => <MiniStat key={item.label} label={item.label} value={item.value} note={item.note} />)}
    </section>
  );
}

function TimelineList({ items }) {
  return (
    <div className="timeline">
      {items.map(item => (
        <div className="timeline-item" key={`${item.date}-${item.title}`}>
          <span className="timeline-dot"></span>
          <div><strong>{item.title}</strong><div className="small-muted">{item.date} · {item.body}</div></div>
          {item.status && <StatusTag tone={item.tone || "blue"}>{item.status}</StatusTag>}
        </div>
      ))}
    </div>
  );
}

function FilterRibbon({ filters }) {
  return (
    <div className="filter-ribbon">
      {filters.map(filter => (
        <label key={filter.label}>{filter.label}
          <select value={filter.value} onChange={event => filter.onChange(event.target.value)}>
            {filter.options.map(option => <option key={option}>{option}</option>)}
          </select>
        </label>
      ))}
    </div>
  );
}

const owners = ["Sarah Johnson", "Tia Brooks", "Sam Malik", "Ari Fox", "Maya Ortiz"];
const stages = ["New", "Discovery", "Solutioning", "Quote", "Approval", "Closed Won", "Closed Lost"];
const productCategories = ["Fiber", "DIA", "Ethernet", "Voice", "SD-WAN", "Cloud Connect", "Wireless", "Fixed Wireless", "Satellite"];

function billingAccountNumber(customer) {
  return `BA-${customer.id.replace("CUST-", "")}-01`;
}

function accountBalance(customer) {
  return sum(invoices.filter(invoice => invoice.customerId === customer.id), invoice => Math.max(invoice.amount, 0));
}

function pastDue(customer) {
  return sum(invoices.filter(invoice => invoice.customerId === customer.id && invoice.aging > 30), invoice => Math.max(invoice.amount, 0));
}

function invoiceStatus(invoice) {
  if (invoice.status === "Priority" || invoice.aging > 60) return "Past Due";
  if (invoice.status === "Review") return "Disputed";
  if (invoice.status === "Approved") return "Open";
  if (invoice.status === "Current") return "Partially Paid";
  return invoice.status;
}

function agingBucket(invoice) {
  if (invoice.aging > 90) return "90+";
  if (invoice.aging > 60) return "61-90";
  if (invoice.aging > 30) return "31-60";
  return "0-30";
}

function opportunityMeta(opportunity) {
  const customer = customers.find(item => item.id === opportunity.customerId) || customers[0];
  const index = opportunities.findIndex(item => item.id === opportunity.id);
  const stage = stages[(index + 1) % 5];
  return {
    ...opportunity,
    account: customer.name,
    accountNumber: customer.id,
    billingAccount: billingAccountNumber(customer),
    market: customer.region,
    segment: customer.segment,
    type: index % 2 ? "Expansion" : "New Logo",
    source: index % 2 ? "Account planning" : "Partner referral",
    description: `${customer.name} is evaluating ${customer.services[0]} expansion across service locations with SLA and billing account impacts.`,
    productInterest: customer.services.join(", "),
    estimatedMrc: Math.round(opportunity.value / 36),
    estimatedNrc: 12500 + index * 4300,
    owner: owners[index % owners.length],
    nextStep: ["Discovery call", "Pricing review", "Quote approval", "Customer follow-up"][index % 4],
    stage,
    amount: opportunity.value,
    status: stage === "Approval" ? "Approval Required" : stage
  };
}

function quoteMeta(quote) {
  const customer = customers.find(item => item.id === quote.customerId) || customers[0];
  const opportunity = opportunities.find(item => item.id === quote.opportunityId) || opportunities[0];
  const index = quotes.findIndex(item => item.id === quote.id);
  const mrc = Math.round(quote.value / 36);
  const nrc = 8200 + index * 2600;
  const taxes = Math.round((mrc + nrc) * 0.084);
  const discount = quote.customPrice ? 12 + index * 3 : 4;
  return {
    ...quote,
    account: customer.name,
    accountNumber: customer.id,
    billingAccount: billingAccountNumber(customer),
    opportunityName: opportunity.name,
    productPackage: quote.package,
    term: [36, 24, 48][index % 3],
    mrc,
    nrc,
    taxes,
    discount,
    margin: quote.margin,
    expiration: ["2026-06-15", "2026-06-30", "2026-05-31"][index % 3],
    quoteDate: ["2026-05-12", "2026-05-08", "2026-05-01"][index % 3],
    owner: owners[(index + 1) % owners.length],
    tcv: quote.value + nrc,
    approvalRequired: quote.margin < 30 || discount > 10
  };
}

function productMeta(service) {
  const index = services.findIndex(item => item.id === service.id);
  return {
    ...service,
    code: ["FIB-1G", "WIRE-IOT", "VOICE-PRO", "SDWAN-EDGE", "IOT-APN"][index] || service.id,
    category: productCategories[index % productCategories.length],
    billingType: index % 2 ? "Usage + Monthly" : "Monthly",
    productType: service.productType === "Mobility" ? "Wireless" : service.productType,
    serviceType: service.family,
    launchDate: ["2025-02-01", "2024-09-15", "2023-11-10", "2025-04-01", "2026-01-15"][index],
    retirementDate: service.lifecycle === "Mature" ? "2027-12-31" : "TBD",
    defaultMrc: 980 + index * 420,
    defaultNrc: 750 + index * 180,
    minMargin: Math.max(22, Math.round(service.margin - 6)),
    discountLimit: `${index % 2 ? 15 : 10}%`
  };
}

function orderMeta(order) {
  const customer = customers.find(item => item.id === order.customerId) || customers[0];
  const index = orders.findIndex(item => item.id === order.id);
  return {
    ...order,
    account: customer.name,
    accountNumber: customer.id,
    orderType: ["Install", "Modify", "Disconnect"][index % 3],
    location: `${100 + index * 22} Network Plaza, ${customer.region}`,
    status: ["Validated", "Pending Network", "Provisioning"][index % 3],
    provisioningStatus: ["Network assignment", "Pending customer CPE", "Activation scheduled"][index % 3],
    blocker: index === 1 ? "Customer LOA" : index === 2 ? "Fiber facility check" : "None",
    sourceQuote: order.source.includes("Quote") ? order.source.replace("Quote ", "") : "Q-2061",
    circuitId: `CKT-${customer.id.slice(-4)}-${index + 7}01`,
    contact: customer.contact,
    requestedDue: order.due,
    installType: index % 2 ? "Customer coordinated" : "Standard dispatch"
  };
}

function enrichedInvoice(invoice) {
  const customer = customers.find(item => item.id === invoice.customerId) || customers[0];
  const paid = invoice.aging < 30 ? Math.round(invoice.amount * 0.18) : 0;
  const recurring = Math.round(invoice.amount * 0.72);
  const usage = Math.round(invoice.amount * 0.11);
  const oneTime = Math.round(invoice.amount * 0.08);
  const discounts = -Math.round(invoice.amount * 0.03);
  const taxes = invoice.amount - recurring - usage - oneTime - discounts;
  return {
    ...invoice,
    customer: customer.name,
    accountNumber: customer.id,
    billingAccount: billingAccountNumber(customer),
    invoiceDate: "2026-05-12",
    status: invoiceStatus(invoice),
    balance: invoice.amount - paid,
    paid,
    recurring,
    usageAmount: usage,
    oneTime,
    discounts,
    taxes,
    billingAddress: `${customer.region} Corporate Center\nSuite 400\nDallas, TX 75201`,
    contact: customer.contact,
    serviceRows: invoice.lineItems.map((item, index) => ({
      id: `${invoice.id}-L${index + 1}`,
      line: index + 1,
      serviceId: `SVC-${customer.id.slice(-4)}-${index + 1}`,
      product: item.description.split(" ").slice(0, 3).join(" "),
      description: item.description,
      period: "May 1-31, 2026",
      quantity: item.qty,
      rate: Math.round(item.amount / Math.max(item.qty, 1)),
      mrc: index === 0 ? Math.round(item.amount * 0.78) : Math.round(item.amount * 0.58),
      nrc: index === 0 ? 0 : Math.round(item.amount * 0.12),
      usage: index === 1 ? Math.round(item.amount * 0.18) : 0,
      discount: item.amount < 0 ? item.amount : -Math.round(Math.abs(item.amount) * 0.04),
      taxes: Math.round(Math.abs(item.amount) * 0.082),
      total: item.amount
    }))
  };
}

function DetailButton({ type, id, setRoute, children = "Details" }) {
  return <button className="link-button compact-action" type="button" onClick={() => setRoute(`details/${type}/${id}`)}>{children}</button>;
}

function Dashboard({ setRoute }) {
  const mrr = sum(customers, customer => customer.mrr);
  return (
    <>
      <PageHeader
        title="Home"
        description="A front door for the telecom workday: commercial momentum, customer health, service risk, and billing exposure."
      />
      <section className="home-hero">
        <div className="home-radar">
          <div className="radar-ring ring-one"></div>
          <div className="radar-ring ring-two"></div>
          <div className="radar-ring ring-three"></div>
          <button className="radar-node sales-node" type="button" onClick={() => setRoute("sales")}>Sales</button>
          <button className="radar-node care-node" type="button" onClick={() => setRoute("customer-service")}>Care</button>
          <button className="radar-node billing-node" type="button" onClick={() => setRoute("billing")}>Billing</button>
          <button className="radar-node network-node-home" type="button" onClick={() => setRoute("network")}>Network</button>
          <strong>Northstar</strong>
        </div>
        <div className="home-focus">
          <span>Morning operating brief</span>
          <h2>{formatMoney(mrr)} managed recurring revenue</h2>
          <p>{tickets.filter(ticket => ["Urgent", "High"].includes(ticket.priority)).length} customer escalations, {orders.length} open orders, and {networkEvents.length} active network events are connected to customer and billing context.</p>
        </div>
      </section>
      <section className="overview-grid">
        <MetricCard label="Customers" value={customers.length} delta="Accounts with billing, service, and care context" />
        <MetricCard label="Open orders" value={orders.length} delta="Sales-originated fulfillment queue" />
        <MetricCard label="Invoice exposure" value={formatMoney(sum(invoices, invoice => invoice.amount))} delta="Current searchable ledger" />
        <MetricCard label="Report templates" value={reportDefinitions.length} delta="Operational report library" />
      </section>
      <section className="dashboard-canvas">
        <Panel title="Workstream pulse" description="Where the platform is asking for attention today." className="canvas-panel">
          <div className="ops-map">
            {[
              ["sales", "Sales", "Leads, opportunities, customers", "sales"],
              ["pricing", "Pricing", "Custom desk and product pricing", "pricing"],
              ["products", "Products", "P&L, owners, lifecycle", "products"],
              ["customer-service", "Care", "Tickets, outages, billing inquiries", "serviceDesk"],
              ["billing", "Billing", "Accounts, services, offers, adjustments", "billing"],
              ["orders", "Orders", "Place, modify, research", "orders"],
              ["reports", "Reports", "Parameters, pagination, export", "reports"]
            ].map(([id, label, text, icon]) => (
              <button className="ops-node" type="button" key={id} onClick={() => setRoute(id)}>
                <Icon name={icon} className="button-icon" />
                <strong>{label}</strong>
                <span>{text}</span>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="Action stream" description="Customer, network, and revenue items ordered by urgency." className="queue-panel">
          <div className="timeline">
            {tickets.slice(0, 3).map(ticket => (
              <div className="timeline-item" key={ticket.id}>
                <span className="timeline-dot"></span>
                <div><strong>{customerName(ticket.customerId)}</strong><div className="small-muted">{ticket.type} · {ticket.ageHours}h</div></div>
                <StatusTag tone={ticket.priority === "Urgent" ? "warn" : "blue"}>{ticket.priority}</StatusTag>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </>
  );
}

function BoardColumn({ title, icon, search, onSearch, children }) {
  return (
    <section className="board-column">
      <div className="board-title">
        <div><Icon name={icon} className="button-icon" /><strong>{title}</strong></div>
        <SearchBox value={search} onChange={onSearch} placeholder={`Search ${title.toLowerCase()}`} />
      </div>
      {children}
    </section>
  );
}

function SalesModule({ setRoute, showToast }) {
  const [modal, setModal] = useState(false);
  const [filters, setFilters] = useState({ leads: "", opportunities: "", customers: "", quotes: "" });
  const [tab, setTab] = useState("Opportunities");
  const [view, setView] = useState("Table");
  const filteredLeads = leads.filter(lead => matchAny(lead, filters.leads, [item => item.id, item => item.account]));
  const filteredOpps = opportunities.map(opportunityMeta).filter(opportunity => matchAny(opportunity, filters.opportunities, [item => item.id, item => item.name, item => item.account]));
  const filteredCustomers = customers.filter(customer => matchAny(customer, filters.customers, [item => item.id, item => item.name]));
  const filteredQuotes = quotes.map(quoteMeta).filter(quote => matchAny(quote, filters.quotes, [item => item.id, item => item.package, item => item.account]));
  const pipeline = sum(filteredOpps, opportunity => opportunity.amount);
  const weighted = sum(filteredOpps, opportunity => opportunity.amount * opportunity.probability / 100);

  return (
    <>
      <PageHeader
        title="Sales"
        description="CRM pipeline management with account, quote, activity, and order context."
        actions={
          <>
            <ActionButton icon="opportunities" variant="button" onClick={() => setModal(true)}>New Opportunity</ActionButton>
            <ActionButton icon="pricing" onClick={() => setRoute("pricing")}>Create Quote</ActionButton>
          </>
        }
      />
      <SummaryStrip items={[
        { label: "Pipeline Value", value: formatMoney(pipeline), note: "Open account opportunities" },
        { label: "Weighted Pipeline", value: formatMoney(weighted), note: "Probability adjusted" },
        { label: "Open Opportunities", value: filteredOpps.length, note: "Across sales stages" },
        { label: "Quotes Pending Approval", value: quotes.filter(quote => quote.status === "Approval").length, note: "Pricing and finance queue" }
      ]} />
      <Tabs tabs={["Leads", "Opportunities", "Accounts", "Quotes", "Activities"]} active={tab} onChange={setTab} />
      {tab === "Opportunities" && (
        <Panel
          title="Opportunities"
          description="Pipeline records connected to accounts, products, quotes, and order conversion."
          action={<div className="module-toolbar"><SearchBox value={filters.opportunities} onChange={value => setFilters({ ...filters, opportunities: value })} placeholder="Search opportunities" /><button className="tiny-button" type="button" onClick={() => setView(view === "Table" ? "Kanban" : "Table")}>{view === "Table" ? "Kanban view" : "Table view"}</button></div>}
        >
          {view === "Kanban" ? (
            <div className="pipeline-kanban">
              {stages.map(stage => (
                <div className="kanban-stage" key={stage}>
                  <strong>{stage}</strong>
                  {filteredOpps.filter(opportunity => opportunity.stage === stage).map(opportunity => (
                    <button className="pipeline-card focus-card" type="button" key={opportunity.id} onClick={() => setRoute(`details/opportunity/${opportunity.id}`)}>
                      <span>{opportunity.id} · {opportunity.account}</span>
                      <strong>{opportunity.name}</strong>
                      <small>{formatMoney(opportunity.estimatedMrc)} MRC · {opportunity.probability}% · {opportunity.nextStep}</small>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <DataTable
              columns={[
                { key: "id", label: "Opportunity ID" },
                { key: "account", label: "Account" },
                { key: "stage", label: "Stage", render: row => <StatusTag tone={row.stage === "Approval" ? "warn" : "blue"}>{row.stage}</StatusTag> },
                { key: "probability", label: "Probability", render: row => `${row.probability}%` },
                { key: "closeDate", label: "Expected Close Date" },
                { key: "productInterest", label: "Product Interest" },
                { key: "estimatedMrc", label: "Estimated MRC", render: row => formatMoney(row.estimatedMrc) },
                { key: "estimatedNrc", label: "Estimated NRC", render: row => formatMoney(row.estimatedNrc) },
                { key: "owner", label: "Owner" },
                { key: "nextStep", label: "Next Step" },
                { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><DetailButton type="opportunity" id={row.id} setRoute={setRoute} children="View" /><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/quote/${quotes.find(quote => quote.opportunityId === row.id)?.id || quotes[0].id}`)}>Create Quote</button><button className="link-button compact-action" type="button" onClick={() => setRoute("orders")}>Convert to Order</button><button className="link-button compact-action" type="button" onClick={() => showToast("Activity added to opportunity timeline")}>Add Activity</button></div> }
              ]}
              rows={filteredOpps}
            />
          )}
        </Panel>
      )}
      {tab === "Leads" && <Panel title="Leads" description="Lead to cash starts with account and product interest." action={<SearchBox value={filters.leads} onChange={value => setFilters({ ...filters, leads: value })} placeholder="Search leads" />}><DataTable columns={[{ key: "id", label: "Lead ID" }, { key: "account", label: "Account" }, { key: "source", label: "Source" }, { key: "stage", label: "Stage", render: row => <StatusTag>{row.stage}</StatusTag> }, { key: "product", label: "Product Interest" }, { key: "estValue", label: "Est. Value", render: row => formatMoney(row.estValue) }, { key: "owner", label: "Owner" }, { key: "details", label: "", render: row => <DetailButton type="lead" id={row.id} setRoute={setRoute} /> }]} rows={filteredLeads} /></Panel>}
      {tab === "Accounts" && <Panel title="Accounts" description="Customer records with open commercial and billing context." action={<SearchBox value={filters.customers} onChange={value => setFilters({ ...filters, customers: value })} placeholder="Search accounts" />}><DataTable columns={[{ key: "id", label: "Account Number" }, { key: "name", label: "Account" }, { key: "segment", label: "Segment" }, { key: "region", label: "Region" }, { key: "mrr", label: "MRR", render: row => formatMoney(row.mrr) }, { key: "health", label: "Health", render: row => `${row.health}` }, { key: "churnRisk", label: "Risk", render: row => <StatusTag tone={row.churnRisk === "High" ? "warn" : "blue"}>{row.churnRisk}</StatusTag> }, { key: "details", label: "", render: row => <DetailButton type="customer" id={row.id} setRoute={setRoute} /> }]} rows={filteredCustomers} /></Panel>}
      {tab === "Quotes" && <Panel title="Quotes" description="Quotes connected to opportunities and approval workflow." action={<SearchBox value={filters.quotes} onChange={value => setFilters({ ...filters, quotes: value })} placeholder="Search quotes" />}><DataTable columns={[{ key: "id", label: "Quote ID" }, { key: "account", label: "Account" }, { key: "opportunityName", label: "Opportunity" }, { key: "productPackage", label: "Product Package" }, { key: "term", label: "Term", render: row => `${row.term} mo` }, { key: "mrc", label: "MRC", render: row => formatMoney(row.mrc) }, { key: "nrc", label: "NRC", render: row => formatMoney(row.nrc) }, { key: "margin", label: "Margin %", render: row => `${row.margin}%` }, { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Approval" ? "warn" : "blue"}>{row.status}</StatusTag> }, { key: "details", label: "", render: row => <DetailButton type="quote" id={row.id} setRoute={setRoute} /> }]} rows={filteredQuotes} /></Panel>}
      {tab === "Activities" && <Panel title="Activities" description="Commercial timeline by opportunity and account."><TimelineList items={["Discovery call completed", "Pricing review requested", "Quote sent to customer", "Customer follow-up scheduled"].map((title, index) => ({ title, date: `May ${8 + index}, 2026`, body: `${filteredOpps[index % filteredOpps.length]?.account} · ${owners[index]}`, status: index === 1 ? "Pricing" : "Logged" }))} /></Panel>}
      {modal && (
        <Modal
          title="New opportunity"
          onClose={() => setModal(false)}
          actions={
            <>
              <button className="button" type="button" onClick={() => { setModal(false); showToast("Opportunity saved"); }}>Submit</button>
              <button className="ghost-button" type="reset">Reset</button>
              <button className="ghost-button" type="button" onClick={() => showToast("Opportunity draft saved")}>Save</button>
              <button className="ghost-button" type="button" onClick={() => setModal(false)}>Cancel</button>
            </>
          }
        >
          <form className="modal-form">
            <label>Opportunity Name<input placeholder="Account expansion or new logo" /></label>
            <label>Account<select>{customers.map(customer => <option key={customer.id}>{customer.name}</option>)}</select></label>
            <label>Source<select><option>Partner referral</option><option>Account planning</option><option>Outbound</option></select></label>
            <label>Product interest<select>{services.map(service => <option key={service.id}>{service.name}</option>)}</select></label>
            <label>Estimated MRC<input placeholder="$0" /></label>
            <label>Owner<input placeholder="Sales owner" /></label>
          </form>
        </Modal>
      )}
    </>
  );
}

function PricingModule({ setRoute, showToast }) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ product: "All product types", status: "All statuses", margin: "All margins", region: "All regions", owner: "All owners" });
  const [tab, setTab] = useState("Quote Desk");
  const quoteRows = quotes.map(quoteMeta).filter(quote => matchAny(quote, query, [
    item => item.id,
    item => item.productPackage,
    item => item.account,
    item => item.opportunityName
  ]) && (filters.status === "All statuses" || itemStatus(quote.status) === filters.status) && (filters.owner === "All owners" || quote.owner === filters.owner));
  function itemStatus(status) { return status === "Approval" ? "Pending Approval" : status; }

  return (
    <>
      <PageHeader
        title="Pricing"
        description="Telecom CPQ quote desk with pricing programs, discount guardrails, cost inputs, and approval routing."
        actions={<><ActionButton icon="pricing" variant="button" onClick={() => showToast("New quote draft opened")}>New Quote</ActionButton><ActionButton icon="workflow" onClick={() => showToast("Pricing engine run complete")}>Run Pricing</ActionButton><ActionButton icon="workflow" onClick={() => showToast("Quote submitted for approval")}>Submit Approval</ActionButton></>}
      />
      <SummaryStrip items={[
        { label: "Quotes in Draft", value: quotes.filter(quote => quote.status === "Draft").length, note: "Sales editable" },
        { label: "Quotes Pending Approval", value: quotes.filter(quote => quote.status === "Approval").length, note: "Pricing desk queue" },
        { label: "Avg Margin", value: `${(sum(quotes, quote => quote.margin) / quotes.length).toFixed(1)}%`, note: "Across active quotes" },
        { label: "Discount Exceptions", value: quoteRows.filter(quote => quote.discount > 10).length, note: "Outside guardrail" }
      ]} />
      <Tabs tabs={["Quote Desk", "Pricing Programs", "Discounts", "Cost Inputs", "Approval Queue", "Coefficients"]} active={tab} onChange={setTab} />
      <FilterRibbon filters={[
        { label: "Product Type", value: filters.product, onChange: value => setFilters({ ...filters, product: value }), options: ["All product types", ...productCategories] },
        { label: "Quote Status", value: filters.status, onChange: value => setFilters({ ...filters, status: value }), options: ["All statuses", "Draft", "Sent", "Pending Approval"] },
        { label: "Margin Range", value: filters.margin, onChange: value => setFilters({ ...filters, margin: value }), options: ["All margins", "< 25%", "25-35%", "> 35%"] },
        { label: "Region", value: filters.region, onChange: value => setFilters({ ...filters, region: value }), options: ["All regions", "Midwest", "Southeast", "Southwest", "West Coast"] },
        { label: "Sales Owner", value: filters.owner, onChange: value => setFilters({ ...filters, owner: value }), options: ["All owners", ...owners] }
      ]} />
      {tab === "Quote Desk" && <Panel title="Quote Desk" description="Quote records tied to accounts, opportunities, margin rules, and approval status." action={<SearchBox value={query} onChange={setQuery} placeholder="Search quote, account, opportunity" />}><DataTable columns={[{ key: "id", label: "Quote ID" }, { key: "account", label: "Account" }, { key: "opportunityName", label: "Opportunity" }, { key: "productPackage", label: "Product Package" }, { key: "term", label: "Term", render: row => `${row.term} mo` }, { key: "mrc", label: "MRC", render: row => formatMoney(row.mrc) }, { key: "nrc", label: "NRC", render: row => formatMoney(row.nrc) }, { key: "margin", label: "Margin %", render: row => `${row.margin}%` }, { key: "discount", label: "Discount %", render: row => `${row.discount}%` }, { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Approval" ? "warn" : "blue"}>{itemStatus(row.status)}</StatusTag> }, { key: "expiration", label: "Expiration" }, { key: "owner", label: "Owner" }, { key: "details", label: "", render: row => <DetailButton type="quote" id={row.id} setRoute={setRoute} /> }]} rows={quoteRows} /></Panel>}
      {tab !== "Quote Desk" && <Panel title={tab} description="Pricing desk governance records for telecom offers, discount exceptions, cost inputs, approvals, and coefficient monitoring."><DataTable columns={[{ key: "id", label: "ID" }, { key: "name", label: "Name" }, { key: "type", label: "Type" }, { key: "discount", label: "Discount" }, { key: "segment", label: "Segment" }, { key: "status", label: "Approval Status", render: row => <StatusTag tone={row.status === "Approval" ? "warn" : "success"}>{row.status}</StatusTag> }, { key: "lift", label: "Margin / Lift" }]} rows={pricingPrograms} /></Panel>}
    </>
  );
}

function ProductsModule({ setRoute, showToast }) {
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(false);
  const [filters, setFilters] = useState({ category: "All categories", lifecycle: "All lifecycles", status: "All statuses", billing: "All billing types" });
  const filteredProducts = services.map(productMeta).filter(service => matchAny(service, query, [item => item.code, item => item.name, item => item.product, item => item.productType, item => item.productManager, item => item.lifecycle]));
  return (
    <>
      <PageHeader
        title="Product Catalog"
        description="Telecom product and service catalog for pricing, eligibility, billing mapping, provisioning mapping, and lifecycle operations."
        actions={<ActionButton icon="products" variant="button" onClick={() => setModal(true)}>New Product</ActionButton>}
      />
      <FilterRibbon filters={[
        { label: "Category", value: filters.category, onChange: value => setFilters({ ...filters, category: value }), options: ["All categories", ...productCategories] },
        { label: "Lifecycle", value: filters.lifecycle, onChange: value => setFilters({ ...filters, lifecycle: value }), options: ["All lifecycles", "Launch", "Growth", "Mature", "Refresh", "Retire"] },
        { label: "Status", value: filters.status, onChange: value => setFilters({ ...filters, status: value }), options: ["All statuses", "Live", "Review", "Optimize"] },
        { label: "Billing Type", value: filters.billing, onChange: value => setFilters({ ...filters, billing: value }), options: ["All billing types", "Monthly", "Usage + Monthly"] }
      ]} />
      <Panel title="Product Catalog" description="Operational catalog records, not ecommerce SKUs. Open a product for pricing, billing, and provisioning mappings." action={<SearchBox value={query} onChange={setQuery} placeholder="Search product code, name, manager" />}>
        <DataTable
          columns={[
            { key: "code", label: "Product Code" },
            { key: "name", label: "Product Name" },
            { key: "category", label: "Category" },
            { key: "productType", label: "Product Type" },
            { key: "billingType", label: "Billing Type" },
            { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Live" ? "success" : "warn"}>{row.status}</StatusTag> },
            { key: "lifecycle", label: "Lifecycle" },
            { key: "productManager", label: "Product Manager" },
            { key: "pricingManager", label: "Pricing Manager" },
            { key: "details", label: "", render: row => <DetailButton type="product" id={row.id} setRoute={setRoute} /> }
          ]}
          rows={filteredProducts}
        />
      </Panel>
      {modal && (
        <Modal
          title="New Product"
          onClose={() => setModal(false)}
          actions={
            <>
              <button className="button" type="button" onClick={() => { setModal(false); showToast("Product catalog record created"); }}>Submit</button>
              <button className="ghost-button" type="reset">Reset</button>
              <button className="ghost-button" type="button" onClick={() => setModal(false)}>Cancel</button>
            </>
          }
        >
          <form className="modal-form">
            <label>Product Code<input placeholder="DIA-1G" /></label>
            <label>Category<select>{productCategories.map(category => <option key={category}>{category}</option>)}</select></label>
            <label>Product Name<input placeholder="Dedicated Internet Access 1G" /></label>
            <label>Billing Type<select><option>Monthly</option><option>Usage + Monthly</option><option>One-time</option></select></label>
            <label>Product Manager<input placeholder="Owner name" /></label>
            <label>Pricing Manager<input placeholder="Pricing owner" /></label>
            <label>Lifecycle<select><option>Launch</option><option>Growth</option><option>Mature</option><option>Refresh</option><option>Retire</option></select></label>
            <label>Provisioning Workflow<input placeholder="Fiber install / CPE activation" /></label>
          </form>
        </Modal>
      )}
    </>
  );
}

function CustomerServiceModule({ setRoute }) {
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(false);
  const outageTickets = tickets.filter(ticket => ticket.category === "Network").length;
  const billingTickets = tickets.filter(ticket => ticket.category === "Billing").length;
  const filteredTickets = tickets.filter(ticket => matchAny(ticket, query, [item => item.id, item => item.type, item => customerName(item.customerId), item => item.category]));
  return (
    <>
      <PageHeader
        title="Customer service"
        description="Support tickets, customer-reported network outages, and billing inquiries."
        actions={<ToolbarButton icon="serviceDesk" variant="button" onClick={() => setModal(true)}>Create ticket</ToolbarButton>}
      />
      <section className="overview-grid">
        <MetricCard label="Open tickets" value={tickets.length} delta="Across network, billing, orders, and care" />
        <MetricCard label="Network reported" value={outageTickets} delta="Customer-reported outage cases" />
        <MetricCard label="Billing inquiries" value={billingTickets} delta="Invoice, usage, and credit questions" />
        <MetricCard label="Avg age" value="36h" delta="Current support queue" />
      </section>
      <section className="care-layout">
        <Panel title="Support tickets" description="Search by issue, customer, or ticket." action={<SearchBox value={query} onChange={setQuery} placeholder="Search support tickets" />}>
          <DataTable
            columns={[
              { key: "id", label: "Ticket" },
              { key: "customerId", label: "Customer", render: ticket => customerName(ticket.customerId) },
              { key: "type", label: "Issue" },
              { key: "category", label: "Category" },
              { key: "ageHours", label: "Age", render: ticket => `${ticket.ageHours}h` },
              { key: "priority", label: "Priority", render: ticket => <StatusTag tone={["Urgent", "High"].includes(ticket.priority) ? "warn" : "blue"}>{ticket.priority}</StatusTag> },
              { key: "details", label: "", render: ticket => <DetailButton type="ticket" id={ticket.id} setRoute={setRoute} /> }
            ]}
            rows={filteredTickets}
          />
        </Panel>
        <Panel title="Customer-reported outages" description="Care cases connected to NOC impact and SLA exposure.">
          <div className="outage-map">
            {networkEvents.filter(event => event.customerReported).map(event => (
              <button className="outage-card enhanced" type="button" key={event.id} onClick={() => setRoute(`details/network/${event.id}`)}>
                <Icon name="network" className="button-icon" />
                <div><strong>{event.market}</strong><span>{event.type} · {event.impacted} impacted · {formatMoney(event.slaExposure)}</span></div>
                <StatusTag tone="warn">{event.severity}</StatusTag>
              </button>
            ))}
          </div>
        </Panel>
      </section>
      {modal && (
        <Modal
          title="Create ticket"
          onClose={() => setModal(false)}
          actions={
            <>
              <button className="button" type="button" onClick={() => setModal(false)}>Submit</button>
              <button className="ghost-button" type="reset">Reset</button>
              <button className="ghost-button" type="button" onClick={() => setModal(false)}>Cancel</button>
            </>
          }
        >
          <form className="modal-form">
            <label>Customer<select>{customers.map(customer => <option key={customer.id}>{customer.name}</option>)}</select></label>
            <label>Issue<input placeholder="Ticket issue" /></label>
            <label>Category<select><option>Network</option><option>Billing</option><option>Orders</option><option>Care</option></select></label>
            <label>Priority<select><option>Normal</option><option>High</option><option>Urgent</option></select></label>
            <label>Description<textarea placeholder="Ticket notes"></textarea></label>
          </form>
        </Modal>
      )}
    </>
  );
}

function Customer360Module({ setRoute, showToast }) {
  const [selectedId, setSelectedId] = useState(customers[0].id);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("Overview");
  const filteredCustomers = customers.filter(customer => matchAny(customer, query, [item => item.id, item => item.name, item => billingAccountNumber(item), item => item.region, item => item.contact, item => serviceInstancesFor(item).map(service => service.circuitId).join(" ")]));
  const customer = customers.find(item => item.id === selectedId) || filteredCustomers[0] || customers[0];
  const customerInvoices = invoices.filter(invoice => invoice.customerId === customer.id);
  const customerTickets = tickets.filter(ticket => ticket.customerId === customer.id);
  const customerOrders = orders.filter(order => order.customerId === customer.id);
  const customerOpps = opportunities.filter(opportunity => opportunity.customerId === customer.id);
  const customerQuotes = quotes.filter(quote => quote.customerId === customer.id);
  const accountServices = serviceInstancesFor(customer);
  return (
    <>
      <PageHeader title="Customer 360" description="Account workspace for CRM, service, location, order, ticket, invoice, quote, and activity records." />
      <section className="customer360-stack">
        <Panel title="Account Search" description="Search by Account Name, Account Number, Billing Account, Service ID, Circuit ID, or Address." action={<SearchBox value={query} onChange={setQuery} placeholder="Account, billing account, service ID, circuit ID, address" />}>
          <div className="account-picker">
            {filteredCustomers.map(item => (
              <button className={item.id === customer.id ? "account-chip active" : "account-chip"} type="button" key={item.id} onClick={() => setSelectedId(item.id)}>
                <strong>{item.name}</strong>
                <span>{item.segment} · {item.region} · MRR {formatMoney(item.mrr)} · Health {item.health} · Balance {formatMoney(accountBalance(item))} · Open Tickets {tickets.filter(ticket => ticket.customerId === item.id).length}</span>
              </button>
            ))}
          </div>
        </Panel>
        <RecordHeader
          breadcrumb={["Customer 360", "Accounts", customer.name]}
          title={customer.name}
          status="Active"
          subtitle={`${customer.id} · ${customer.segment} · ${customer.region} · Health Score ${customer.health}`}
          actions={<><ActionButton icon="opportunities" variant="button" onClick={() => setRoute("sales")}>New Opportunity</ActionButton><ActionButton icon="pricing" onClick={() => setRoute("pricing")}>Create Quote</ActionButton><ActionButton icon="orders" onClick={() => setRoute("orders")}>Create Order</ActionButton><ActionButton icon="serviceDesk" onClick={() => showToast("Ticket workflow opened")}>Create Ticket</ActionButton><ActionButton icon="billing" onClick={() => setRoute(`details/billing-account/${customer.id}`)}>View Billing</ActionButton></>}
        />
        <SummaryStrip items={[
          { label: "MRR", value: formatMoney(customer.mrr), note: customer.churnRisk },
          { label: "Current Balance", value: formatMoney(accountBalance(customer)), note: billingAccountNumber(customer) },
          { label: "Past Due", value: formatMoney(pastDue(customer)), note: "Collections exposure" },
          { label: "Active Services", value: accountServices.filter(service => service.status === "Active").length, note: "Provisioned services" },
          { label: "Open Tickets", value: customerTickets.length, note: "Care workload" },
          { label: "Open Orders", value: customerOrders.length, note: "Fulfillment" },
          { label: "Active Opportunities", value: customerOpps.length, note: "Commercial pipeline" }
        ]} />
        <Tabs tabs={["Overview", "Contacts", "Services", "Locations", "Orders", "Tickets", "Invoices", "Quotes", "Opportunities", "Activity", "Documents"]} active={tab} onChange={setTab} />
        {tab === "Overview" && <section className="record-main-layout"><Panel title="Account Information" description="Account, parent, owner, balance, and payment context."><div className="field-grid"><MiniStat label="Billing Account" value={billingAccountNumber(customer)} note={customer.billingProfile} /><MiniStat label="Parent Account" value={customer.segment === "Enterprise" ? "Northstar Enterprise Parent" : "None"} note="Account hierarchy" /><MiniStat label="Payment Terms" value={customer.billingProfile.split(",")[0]} note="Billing profile" /><MiniStat label="Sales Owner" value={owners[0]} note="Commercial owner" /><MiniStat label="Account Manager" value={customer.contact} note="Primary contact" /><MiniStat label="Account Balance" value={formatMoney(accountBalance(customer))} note={`Past due ${formatMoney(pastDue(customer))}`} /></div></Panel><Panel title="Recent Activity" description="CRM timeline for account events."><TimelineList items={[{ date: "May 12, 2026", title: "Invoice generated", body: `${customerInvoices[0]?.id || "INV-0000"} posted to billing account`, status: "Billing" }, { date: "May 10, 2026", title: "Payment received", body: `${formatMoney(25000)} ACH payment posted`, status: "Posted", tone: "success" }, { date: "May 8, 2026", title: "Order completed", body: `${customerOrders[0]?.id || "ORD-0000"} service workflow updated`, status: "Order" }, { date: "May 5, 2026", title: "New service activated", body: `${accountServices[0]?.service} at primary location`, status: "Active", tone: "success" }]} /></Panel></section>}
        {tab === "Services" && <Panel title="Active Services" description="Billing charges connect back to active service and circuit records."><DataTable columns={[{ key: "id", label: "Service ID" }, { key: "service", label: "Product" }, { key: "location", label: "Location" }, { key: "circuitId", label: "Circuit ID" }, { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Active" ? "success" : "warn"}>{row.status}</StatusTag> }, { key: "price", label: "MRC", render: row => formatMoney(row.price) }, { key: "install", label: "Install Date", render: () => "2026-04-15" }, { key: "details", label: "", render: row => <DetailButton type="service" id={row.id} setRoute={setRoute} /> }]} rows={accountServices} /></Panel>}
        {tab === "Locations" && <Panel title="Service Locations" description="Serviceability and active products by address."><DataTable columns={[{ key: "id", label: "Location ID" }, { key: "address", label: "Service Address" }, { key: "status", label: "Serviceability Status", render: row => <StatusTag tone="success">{row.status}</StatusTag> }, { key: "available", label: "Available Products" }, { key: "active", label: "Active Services" }]} rows={accountServices.map((service, index) => ({ id: `LOC-${customer.id.slice(-4)}-${index + 1}`, address: `${100 + index * 22} Network Plaza, ${customer.region}`, status: "Serviceable", available: "Fiber, DIA, Ethernet, SD-WAN", active: service.service }))} /></Panel>}
        {tab === "Orders" && <Panel title="Orders" description="Customer order records."><DataTable columns={[{ key: "id", label: "Order ID" }, { key: "service", label: "Service" }, { key: "source", label: "Source" }, { key: "due", label: "Due Date" }, { key: "status", label: "Status", render: row => <StatusTag>{orderMeta(row).status}</StatusTag> }, { key: "details", label: "", render: row => <DetailButton type="order" id={row.id} setRoute={setRoute} /> }]} rows={customerOrders} /></Panel>}
        {tab === "Tickets" && <Panel title="Tickets" description="Care and support records for the selected account."><DataTable columns={[{ key: "id", label: "Ticket ID" }, { key: "type", label: "Issue" }, { key: "category", label: "Category" }, { key: "priority", label: "Priority", render: row => <StatusTag tone={["Urgent", "High"].includes(row.priority) ? "warn" : "blue"}>{row.priority}</StatusTag> }, { key: "status", label: "Status" }]} rows={customerTickets} /></Panel>}
        {tab === "Invoices" && <Panel title="Invoices" description="Billing account invoices and balances."><DataTable columns={[{ key: "id", label: "Invoice #" }, { key: "billingAccount", label: "Billing Account", render: row => enrichedInvoice(row).billingAccount }, { key: "due", label: "Due Date" }, { key: "amount", label: "Total", render: row => formatMoney(row.amount) }, { key: "balance", label: "Balance", render: row => formatMoney(enrichedInvoice(row).balance) }, { key: "status", label: "Status", render: row => <StatusTag tone={invoiceStatus(row) === "Past Due" ? "warn" : "blue"}>{invoiceStatus(row)}</StatusTag> }, { key: "details", label: "", render: row => <DetailButton type="invoice" id={row.id} setRoute={setRoute} /> }]} rows={customerInvoices} /></Panel>}
        {tab === "Quotes" && <Panel title="Quotes" description="Account quotes and approval status."><DataTable columns={[{ key: "id", label: "Quote ID" }, { key: "package", label: "Package" }, { key: "value", label: "TCV", render: row => formatMoney(row.value) }, { key: "margin", label: "Margin", render: row => `${row.margin}%` }, { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Approval" ? "warn" : "blue"}>{row.status}</StatusTag> }, { key: "details", label: "", render: row => <DetailButton type="quote" id={row.id} setRoute={setRoute} /> }]} rows={customerQuotes} /></Panel>}
        {tab === "Opportunities" && <Panel title="Opportunities" description="Commercial pipeline for this account."><DataTable columns={[{ key: "id", label: "Opportunity ID" }, { key: "name", label: "Name" }, { key: "stage", label: "Stage", render: row => <StatusTag>{opportunityMeta(row).stage}</StatusTag> }, { key: "value", label: "Amount", render: row => formatMoney(row.value) }, { key: "closeDate", label: "Close Date" }, { key: "details", label: "", render: row => <DetailButton type="opportunity" id={row.id} setRoute={setRoute} /> }]} rows={customerOpps} /></Panel>}
        {tab === "Activity" && <Panel title="Activity Timeline" description="CRM-style account activity."><TimelineList items={[{ date: "May 13, 2026", title: "Customer follow-up", body: `${customer.contact} requested billing account statement`, status: "Open" }, { date: "May 11, 2026", title: "Quote sent", body: `${customerQuotes[0]?.id || "Q-0000"} emailed to customer`, status: "Sent" }, { date: "May 9, 2026", title: "Service check", body: `${accountServices[0]?.circuitId} SLA reviewed`, status: "Service" }]} /></Panel>}
        {["Contacts", "Documents"].includes(tab) && <Panel title={tab} description={`${tab} connected to ${customer.name}.`}><DataTable columns={[{ key: "id", label: "ID" }, { key: "name", label: "Name" }, { key: "role", label: "Role" }, { key: "status", label: "Status", render: row => <StatusTag>{row.status}</StatusTag> }]} rows={[{ id: `${customer.id}-${tab}-1`, name: tab === "Contacts" ? customer.contact : "Master service agreement", role: tab === "Contacts" ? "Primary contact" : "Contract document", status: "Active" }]} /></Panel>}
      </section>
    </>
  );
}

function BillingModule({ setRoute, showToast }) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("Accounts");
  const rows = customers.filter(customer => matchAny(customer, query, [item => item.id, item => item.name])).map(customer => ({
    ...customer,
    invoiceTotal: sum(invoices.filter(invoice => invoice.customerId === customer.id), invoice => invoice.amount),
    invoiceCount: invoices.filter(invoice => invoice.customerId === customer.id).length,
    billingAccount: billingAccountNumber(customer),
    pastDue: pastDue(customer),
    lastInvoice: invoices.find(invoice => invoice.customerId === customer.id)?.id || "None",
    paymentTerms: customer.billingProfile.split(",")[0],
    autoPay: customer.billingProfile.includes("card") ? "Yes" : "No"
  }));
  const invoiceRows = invoices.map(enrichedInvoice).filter(invoice => matchAny(invoice, query, [item => item.id, item => item.billingAccount, item => item.customer, item => item.accountNumber, item => item.serviceRows.map(row => row.serviceId).join(" ")]));
  return (
    <>
      <PageHeader
        title="Billing"
        description="Internal billing system for billing accounts, invoices, payments, adjustments, usage, disputes, aging, and reports."
        actions={<><ActionButton icon="billing" variant="button" onClick={() => showToast("Invoice generation queued")}>Generate Invoice</ActionButton><ActionButton icon="billing" onClick={() => showToast("Payment entry opened")}>Record Payment</ActionButton><ActionButton icon="workflow" onClick={() => showToast("Adjustment workflow opened")}>Create Adjustment</ActionButton><ActionButton icon="reports" onClick={() => showToast("Billing export prepared")}>Export</ActionButton></>}
      />
      <SummaryStrip items={[
        { label: "Total AR", value: formatMoney(sum(rows, row => row.invoiceTotal)), note: "Open receivables" },
        { label: "Past Due", value: formatMoney(sum(rows, row => row.pastDue)), note: "31+ day exposure" },
        { label: "Open Invoices", value: invoices.length, note: "Draft, open, disputed" },
        { label: "Adjustments Pending", value: adjustments.filter(item => item.status !== "Posted").length, note: "Approval queue" },
        { label: "Disputes", value: invoices.filter(invoice => invoiceStatus(invoice) === "Disputed").length, note: "Research required" }
      ]} />
      <Panel title="Account / Invoice Search" description="Search by Account Number, Billing Account, Invoice Number, Service ID, or Circuit ID." action={<SearchBox value={query} onChange={setQuery} placeholder="Account, billing account, invoice, service ID, circuit ID" />}>
        <Tabs tabs={["Accounts", "Invoices", "Payments", "Adjustments", "Usage", "Disputes", "Aging", "Reports"]} active={tab} onChange={setTab} />
        {tab === "Accounts" && <DataTable columns={[{ key: "billingAccount", label: "Billing Account" }, { key: "name", label: "Customer" }, { key: "invoiceTotal", label: "Balance", render: row => formatMoney(row.invoiceTotal) }, { key: "pastDue", label: "Past Due", render: row => formatMoney(row.pastDue) }, { key: "lastInvoice", label: "Last Invoice" }, { key: "paymentTerms", label: "Payment Terms" }, { key: "autoPay", label: "AutoPay" }, { key: "status", label: "Status", render: () => <StatusTag>Active</StatusTag> }, { key: "details", label: "", render: row => <DetailButton type="billing-account" id={row.id} setRoute={setRoute} /> }]} rows={rows} />}
        {tab === "Invoices" && <DataTable columns={[{ key: "id", label: "Invoice #" }, { key: "billingAccount", label: "Billing Account" }, { key: "invoiceDate", label: "Invoice Date" }, { key: "due", label: "Due Date" }, { key: "amount", label: "Total", render: row => formatMoney(row.amount) }, { key: "balance", label: "Balance", render: row => formatMoney(row.balance) }, { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Past Due" ? "warn" : row.status === "Paid" ? "success" : "blue"}>{row.status}</StatusTag> }, { key: "aging", label: "Aging Bucket", render: row => agingBucket(row) }, { key: "details", label: "", render: row => <DetailButton type="invoice" id={row.id} setRoute={setRoute} /> }]} rows={invoiceRows} />}
        {tab === "Adjustments" && <DataTable columns={[{ key: "id", label: "Adjustment ID" }, { key: "type", label: "Type" }, { key: "amount", label: "Amount", render: row => formatMoney(row.amount) }, { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Posted" ? "success" : "warn"}>{row.status}</StatusTag> }, { key: "reason", label: "Adjustment Reason", render: row => row.type }, { key: "date", label: "Date", render: () => "2026-05-13" }]} rows={adjustments} />}
        {!["Accounts", "Invoices", "Adjustments"].includes(tab) && <DataTable columns={[{ key: "id", label: "Record" }, { key: "customer", label: "Customer" }, { key: "status", label: "Status" }, { key: "amount", label: "Amount", render: row => formatMoney(row.amount) }]} rows={invoiceRows.map(row => ({ id: `${tab}-${row.id}`, customer: row.customer, status: row.status, amount: row.balance }))} />}
      </Panel>
    </>
  );
}

function OrdersModule({ setRoute, showToast }) {
  const [filters, setFilters] = useState({ customer: "", orderId: "", leadId: "", opportunityId: "", account: "", service: "", source: "" });
  const [tab, setTab] = useState("All Orders");
  const filteredOrders = orders.map(orderMeta).filter(order => (
    matchAny(order, filters.customer, [item => customerName(item.customerId)]) &&
    matchAny(order, filters.orderId, [item => item.id]) &&
    matchAny(order, filters.leadId, [item => item.source]) &&
    matchAny(order, filters.opportunityId, [item => item.source]) &&
    matchAny(order, filters.account, [item => item.customerId]) &&
    matchAny(order, filters.service, [item => item.service]) &&
    matchAny(order, filters.source, [item => item.source])
  ));
  return (
    <>
      <PageHeader
        title="Orders"
        description="Telecom order management and provisioning workflow for installs, modifies, disconnects, research, and network handoff."
        actions={<><ActionButton icon="orders" variant="button" onClick={() => showToast("New order workflow opened")}>New Order</ActionButton><ActionButton icon="workflow" onClick={() => showToast("Order validation checks passed")}>Validate Order</ActionButton><ActionButton icon="reports" onClick={() => showToast("Provisioning queue exported")}>Export Queue</ActionButton></>}
      />
      <SummaryStrip items={[
        { label: "Open Orders", value: orders.length, note: "Submitted and in progress" },
        { label: "Due This Week", value: orders.filter(order => order.due <= "2026-05-20").length, note: "Customer committed dates" },
        { label: "At Risk", value: filteredOrders.filter(order => order.blocker !== "None").length, note: "Blockers present" },
        { label: "Pending Provisioning", value: filteredOrders.filter(order => order.status === "Provisioning").length, note: "Network queue" },
        { label: "Completed", value: 18, note: "Rolling 30 days" }
      ]} />
      <section className="orders-stack">
        <Panel title="Search orders" description="Use one or many fields to narrow the order list.">
          <div className="order-filter-grid">
            <label>Customer<input value={filters.customer} onChange={event => setFilters({ ...filters, customer: event.target.value })} placeholder="Customer name" /></label>
            <label>Order ID<input value={filters.orderId} onChange={event => setFilters({ ...filters, orderId: event.target.value })} placeholder="ORD-2048" /></label>
            <label>Lead ID<input value={filters.leadId} onChange={event => setFilters({ ...filters, leadId: event.target.value })} placeholder="LEAD-452" /></label>
            <label>Opportunity ID<input value={filters.opportunityId} onChange={event => setFilters({ ...filters, opportunityId: event.target.value })} placeholder="OPP-833" /></label>
            <label>Account #<input value={filters.account} onChange={event => setFilters({ ...filters, account: event.target.value })} placeholder="CUST-1001" /></label>
            <label>Service<input value={filters.service} onChange={event => setFilters({ ...filters, service: event.target.value })} placeholder="Fiber, Voice..." /></label>
            <label>Source<input value={filters.source} onChange={event => setFilters({ ...filters, source: event.target.value })} placeholder="Quote, Lead, Opportunity" /></label>
          </div>
        </Panel>
        <Tabs tabs={["All Orders", "Install", "Modify", "Disconnect", "Research", "Provisioning Queue"]} active={tab} onChange={setTab} />
        <Panel title="Order list" description="Open an order to modify, cancel, reschedule, or inspect fulfillment details.">
          <DataTable
            columns={[
              { key: "id", label: "Order ID" },
              { key: "account", label: "Account" },
              { key: "orderType", label: "Order Type" },
              { key: "service", label: "Service" },
              { key: "location", label: "Location" },
              { key: "status", label: "Status", render: order => <StatusTag tone={order.status === "Pending Network" ? "warn" : "blue"}>{order.status}</StatusTag> },
              { key: "provisioningStatus", label: "Provisioning Status" },
              { key: "due", label: "Due Date" },
              { key: "owner", label: "Owner" },
              { key: "blocker", label: "Blocker", render: order => <StatusTag tone={order.blocker === "None" ? "success" : "warn"}>{order.blocker}</StatusTag> },
              { key: "sourceQuote", label: "Source Quote" },
              { key: "details", label: "", render: order => <DetailButton type="order" id={order.id} setRoute={setRoute} /> }
            ]}
            rows={tab === "All Orders" ? filteredOrders : filteredOrders.filter(order => tab === "Provisioning Queue" ? order.status === "Provisioning" : order.orderType === tab)}
          />
        </Panel>
      </section>
    </>
  );
}

function makePdfBlob(lines) {
  const clean = lines.map(line => String(line).replace(/[()\\]/g, ""));
  const header = "0.08 0.13 0.24 rg 36 722 540 42 re f\n1 1 1 rg BT /F1 18 Tf 54 738 Td (NORTHSTAR TELECOM) Tj ET";
  const content = clean.map((line, index) => {
    const y = 700 - index * 18;
    const size = line.startsWith("##") ? 13 : 10;
    const value = line.replace(/^##\s*/, "");
    return `0 0 0 rg BT /F1 ${size} Tf 54 ${y} Td (${value}) Tj ET`;
  }).join("\n");
  const text = `${header}\n0.82 0.86 0.9 RG 36 120 540 600 re S\n${content}\n0.45 0.5 0.56 rg BT /F1 9 Tf 54 54 Td (Support: billing@northstar.example | 1-800-555-0199 | Page 1) Tj ET`;
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >> endobj",
    `4 0 obj << /Length ${text.length} >> stream\n${text}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj"
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach(object => {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer << /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

function BillingAccountDetail({ id, setRoute, showToast }) {
  const customer = customers.find(item => item.id === id) || customers[0];
  const customerInvoices = invoices.filter(invoice => invoice.customerId === customer.id);
  const serviceInstances = serviceInstancesFor(customer);
  const usageRows = usageRowsFor(customer);
  const customerAdjustments = adjustments.filter(adjustment => adjustment.customerId === customer.id);
  const [tab, setTab] = useState("Summary");
  const balance = accountBalance(customer);
  const overdue = pastDue(customer);
  return (
    <>
      <RecordHeader
        breadcrumb={["Billing", "Accounts", billingAccountNumber(customer)]}
        title={`${billingAccountNumber(customer)} / ${customer.name}`}
        status={overdue > 0 ? "Past Due" : "Active"}
        subtitle={`${customer.id} · ${customer.billingProfile} · Balance ${formatMoney(balance)}`}
        actions={<><ActionButton icon="billing" variant="button" onClick={() => showToast("Payment recorded against billing account")}>Record Payment</ActionButton><ActionButton icon="workflow" onClick={() => showToast("Adjustment request created")}>Create Adjustment</ActionButton><ActionButton icon="billing" onClick={() => setTab("Invoices")}>View Invoices</ActionButton><ActionButton icon="reports" onClick={() => showToast("Statement export prepared")}>Export Statement</ActionButton><ActionButton icon="workflow" onClick={() => setRoute("billing")}>Back</ActionButton></>}
      />
      <SummaryStrip items={[
        { label: "Account Balance", value: formatMoney(balance), note: "Total AR" },
        { label: "Current Charges", value: formatMoney(Math.round(balance * 0.78)), note: "This cycle" },
        { label: "Past Due", value: formatMoney(overdue), note: agingBucket(customerInvoices[0] || { aging: 0 }) },
        { label: "Unbilled Charges", value: formatMoney(Math.round(customer.mrr * 0.12)), note: "Rated pending invoice" },
        { label: "Credit Limit", value: formatMoney(500000), note: "Finance policy" },
        { label: "AutoPay", value: customer.billingProfile.includes("card") ? "Yes" : "No", note: "Payment profile" }
      ]} />
      <Tabs tabs={["Summary", "Invoices", "Payments", "Adjustments", "Usage", "Services", "Tax/Surcharge", "Documents"]} active={tab} onChange={setTab} />
      {tab === "Summary" && <section className="record-main-layout"><Panel title="Billing Summary" description="Account balance, remit-to information, aging, and billing profile."><div className="field-grid"><MiniStat label="Remit To" value="Northstar Telecom" note="PO Box 12545, Dallas, TX 75201" /><MiniStat label="Payment Terms" value={customer.billingProfile.split(",")[0]} note="Invoice terms" /><MiniStat label="Billing Account" value={billingAccountNumber(customer)} note={customer.id} /><MiniStat label="Tax Profile" value={customer.billingProfile.includes("tax exempt") ? "Exempt" : "Standard"} note="Tax jurisdiction attached" /></div></Panel><Panel title="Aging Bucket" description="Receivables by bucket."><DataTable columns={[{ key: "bucket", label: "Bucket" }, { key: "amount", label: "Amount", render: row => formatMoney(row.amount) }, { key: "status", label: "Status", render: row => <StatusTag tone={row.bucket === "90+" ? "warn" : "blue"}>{row.status}</StatusTag> }]} rows={[{ id: "0", bucket: "0-30", amount: balance - overdue, status: "Current" }, { id: "31", bucket: "31-60", amount: Math.round(overdue * 0.35), status: "Watch" }, { id: "61", bucket: "61-90", amount: Math.round(overdue * 0.45), status: "Past Due" }, { id: "90", bucket: "90+", amount: Math.round(overdue * 0.2), status: "Collections" }]} /></Panel></section>}
      {tab === "Invoices" && <Panel title="Invoices" description="Invoice records for the billing account."><DataTable columns={[{ key: "id", label: "Invoice #" }, { key: "invoiceDate", label: "Invoice Date", render: row => enrichedInvoice(row).invoiceDate }, { key: "due", label: "Due Date" }, { key: "amount", label: "Total", render: row => formatMoney(row.amount) }, { key: "balance", label: "Balance", render: row => formatMoney(enrichedInvoice(row).balance) }, { key: "status", label: "Status", render: row => <StatusTag tone={invoiceStatus(row) === "Past Due" ? "warn" : "blue"}>{invoiceStatus(row)}</StatusTag> }, { key: "details", label: "", render: row => <DetailButton type="invoice" id={row.id} setRoute={setRoute} /> }]} rows={customerInvoices} /></Panel>}
      {tab === "Services" && <Panel title="Billing Services" description="Charges connected to active service records."><DataTable columns={[{ key: "id", label: "Service ID" }, { key: "service", label: "Product" }, { key: "circuitId", label: "Circuit ID" }, { key: "location", label: "Service Location" }, { key: "price", label: "MRC", render: row => formatMoney(row.price) }, { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Active" ? "success" : "warn"}>{row.status}</StatusTag> }, { key: "details", label: "", render: row => <DetailButton type="service" id={row.id} setRoute={setRoute} /> }]} rows={serviceInstances} /></Panel>}
      {tab === "Usage" && <Panel title="Usage" description="Rated usage records tied to invoice periods."><DataTable columns={[{ key: "id", label: "Usage" }, { key: "invoiceId", label: "Invoice" }, { key: "period", label: "Period" }, { key: "usage", label: "Usage" }, { key: "ratedAmount", label: "Rated", render: row => formatMoney(row.ratedAmount) }]} rows={usageRows} /></Panel>}
      {tab === "Adjustments" && <Panel title="Adjustments" description="Credits, disputes, true-ups, and billing corrections."><DataTable columns={[{ key: "id", label: "Adjustment ID" }, { key: "type", label: "Type" }, { key: "amount", label: "Amount", render: row => formatMoney(row.amount) }, { key: "status", label: "Status" }, { key: "created", label: "Created By", render: () => "Billing Ops" }, { key: "approved", label: "Approved By", render: row => row.status === "Posted" ? "Finance" : "Pending" }]} rows={customerAdjustments} /></Panel>}
      {!["Summary", "Invoices", "Services", "Usage", "Adjustments"].includes(tab) && <Panel title={tab} description={`${tab} records connected to the billing account.`}><DataTable columns={[{ key: "id", label: "Record" }, { key: "name", label: "Name" }, { key: "status", label: "Status" }]} rows={[{ id: `${tab}-1`, name: `${customer.name} ${tab}`, status: "Active" }]} /></Panel>}
    </>
  );
}

function OrderDetail({ id, setRoute, showToast }) {
  const order = orderMeta(orders.find(item => item.id === id) || orders[0]);
  const [tab, setTab] = useState("Summary");
  return (
    <>
      <RecordHeader breadcrumb={["Orders", order.orderType, order.id]} title={`${order.id} order detail`} status={order.status} subtitle={`${order.account} · ${order.orderType} · ${order.service} · Due ${order.due} · Owner ${order.owner}`} actions={<><ActionButton icon="workflow" variant="button" onClick={() => showToast("Order validation checks passed")}>Validate</ActionButton><ActionButton icon="orders" onClick={() => showToast("Order submitted")}>Submit</ActionButton><ActionButton icon="workflow" onClick={() => showToast("Assignment updated")}>Assign</ActionButton><ActionButton icon="workflow" onClick={() => showToast("Order status updated")}>Update Status</ActionButton><ActionButton icon="orders" onClick={() => showToast("Order completed")}>Complete</ActionButton><ActionButton icon="workflow" onClick={() => setRoute("orders")}>Back</ActionButton></>} />
      <SummaryStrip items={[{ label: "Order Type", value: order.orderType, note: order.source }, { label: "Provisioning Status", value: order.provisioningStatus, note: order.blocker }, { label: "Circuit ID", value: order.circuitId, note: order.location }, { label: "Due Date", value: order.due, note: order.owner }]} />
      <Tabs tabs={["Summary", "Service Details", "Location", "Provisioning", "Tasks", "Customer Communications", "Related Quote", "Audit History"]} active={tab} onChange={setTab} />
      {tab === "Summary" && <Panel title="Order Summary" description="Sales lineage, requested dates, customer contact, and install type."><div className="field-grid"><MiniStat label="Source" value={order.source} note="Lead-to-cash lineage" /><MiniStat label="Quote ID" value={order.sourceQuote} note="Source quote" /><MiniStat label="Opportunity ID" value={opportunities.find(opp => opp.customerId === order.customerId)?.id || "OPP-000"} note="Commercial record" /><MiniStat label="Requested Due Date" value={order.requestedDue} note={order.installType} /><MiniStat label="Customer Contact" value={order.contact} note={order.account} /><MiniStat label="Install Type" value={order.installType} note={order.location} /></div></Panel>}
      {tab === "Provisioning" && <Panel title="Provisioning" description="Network assignment, equipment, activation, and validation checks."><DataTable columns={[{ key: "step", label: "Validation Checks" }, { key: "owner", label: "Owner" }, { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Blocked" ? "warn" : "success"}>{row.status}</StatusTag> }, { key: "notes", label: "Notes" }]} rows={[{ id: "validate", step: "Serviceability validation", owner: "Order Ops", status: "Passed", notes: "Address serviceable" }, { id: "network", step: "Network assignment", owner: "Network Ops", status: order.blocker === "None" ? "Passed" : "Blocked", notes: `Circuit ${order.circuitId}` }, { id: "equipment", step: "Equipment / ONT / CPE", owner: "Field Ops", status: "Passed", notes: "ONT + managed CPE reserved" }, { id: "activation", step: "Activation status", owner: "Provisioning", status: "Passed", notes: order.provisioningStatus }, { id: "failure", step: "Failure reason", owner: "System", status: order.blocker === "None" ? "Passed" : "Blocked", notes: order.blocker }]} /></Panel>}
      {tab === "Tasks" && <Panel title="Tasks" description="Checklist with owner and status."><DataTable columns={[{ key: "task", label: "Task" }, { key: "owner", label: "Owner" }, { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Done" ? "success" : "blue"}>{row.status}</StatusTag> }]} rows={["Validate order", "Reserve circuit", "Ship CPE", "Schedule dispatch", "Activate service"].map((task, index) => ({ id: task, task, owner: ["Order Ops", "Network Ops", "Warehouse", "Field Ops", "Provisioning"][index], status: index < 2 ? "Done" : "Open" }))} /></Panel>}
      {tab === "Audit History" && <Panel title="Audit History" description="Timestamped user and system actions."><TimelineList items={[{ date: "May 13, 2026 09:12", title: "Order validated", body: "Order Ops completed validation checks", status: "Validated" }, { date: "May 13, 2026 10:01", title: "Network assignment updated", body: `${order.circuitId} assigned`, status: "Network" }, { date: "May 13, 2026 11:20", title: "Due date confirmed", body: order.due, status: "Audit" }]} /></Panel>}
      {!["Summary", "Provisioning", "Tasks", "Audit History"].includes(tab) && <Panel title={tab} description={`${tab} for ${order.id}.`}><DataTable columns={[{ key: "field", label: "Field" }, { key: "value", label: "Value" }]} rows={[{ id: "account", field: "Account", value: order.account }, { id: "service", field: "Service", value: order.service }, { id: "location", field: "Service Address", value: order.location }, { id: "quote", field: "Related Quote", value: order.sourceQuote }]} /></Panel>}
    </>
  );
}

function OpportunityDetail({ id, setRoute, showToast }) {
  const opportunity = opportunityMeta(opportunities.find(item => item.id === id) || opportunities[0]);
  const relatedQuotes = quotes.filter(quote => quote.opportunityId === opportunity.id).map(quoteMeta);
  const [tab, setTab] = useState("Summary");
  return (
    <>
      <RecordHeader breadcrumb={["Sales", "Opportunities", opportunity.id]} title={opportunity.name} status={opportunity.status} subtitle={`${opportunity.account} · ${opportunity.stage} · ${opportunity.probability}% · ${formatMoney(opportunity.amount)} · ${opportunity.owner} · Close ${opportunity.closeDate}`} actions={<><ActionButton icon="pricing" variant="button" onClick={() => setRoute(`details/quote/${relatedQuotes[0]?.id || quotes[0].id}`)}>Create Quote</ActionButton><ActionButton icon="workflow" onClick={() => showToast("Activity added to opportunity")}>Add Activity</ActionButton><ActionButton icon="workflow" onClick={() => showToast("Opportunity submitted for approval")}>Submit Approval</ActionButton><ActionButton icon="opportunities" onClick={() => showToast("Close won/lost menu opened")}>Close Won/Lost</ActionButton></>} />
      <SummaryStrip items={[{ label: "Account", value: opportunity.account, note: opportunity.accountNumber }, { label: "Stage", value: opportunity.stage, note: `${opportunity.probability}% probability` }, { label: "Estimated MRC", value: formatMoney(opportunity.estimatedMrc), note: `NRC ${formatMoney(opportunity.estimatedNrc)}` }, { label: "Owner", value: opportunity.owner, note: opportunity.nextStep }]} />
      <Tabs tabs={["Summary", "Products", "Quotes", "Activities", "Contacts", "Locations", "Documents"]} active={tab} onChange={setTab} />
      {tab === "Summary" && <section className="record-main-layout"><Panel title="Opportunity Summary" description="Account, market, segment, source, and opportunity type."><div className="field-grid"><MiniStat label="Account" value={opportunity.account} note={opportunity.billingAccount} /><MiniStat label="Market" value={opportunity.market} note={opportunity.segment} /><MiniStat label="Opportunity Type" value={opportunity.type} note={opportunity.source} /><MiniStat label="Product Interest" value={opportunity.productInterest} note="Telecom services" /></div><p className="small-muted">{opportunity.description}</p></Panel><Panel title="Activity Timeline" description="Commercial motion and approval history."><TimelineList items={[{ date: "May 1, 2026", title: "Discovery call", body: "Completed by Sarah Johnson", status: "Done", tone: "success" }, { date: "May 8, 2026", title: "Pricing review", body: "Custom margin review requested", status: "Pricing" }, { date: "May 13, 2026", title: "Quote sent", body: "Customer package shared", status: "Sent" }, { date: "May 20, 2026", title: "Customer follow-up", body: "Expected close date review", status: "Next" }]} /></Panel></section>}
      {tab === "Quotes" && <Panel title="Related Quotes" description="Quote versions and approval status connected to this opportunity."><DataTable columns={[{ key: "id", label: "Quote ID" }, { key: "version", label: "Version", render: (row, index) => index + 1 }, { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Approval" ? "warn" : "blue"}>{row.status}</StatusTag> }, { key: "mrc", label: "Total MRC", render: row => formatMoney(row.mrc) }, { key: "nrc", label: "Total NRC", render: row => formatMoney(row.nrc) }, { key: "expiration", label: "Expiration" }, { key: "details", label: "", render: row => <DetailButton type="quote" id={row.id} setRoute={setRoute} /> }]} rows={relatedQuotes} /></Panel>}
      {tab !== "Summary" && tab !== "Quotes" && <Panel title={tab} description={`${tab} records for ${opportunity.name}.`}><DataTable columns={[{ key: "id", label: "ID" }, { key: "name", label: "Name" }, { key: "status", label: "Status" }]} rows={[{ id: `${tab}-1`, name: `${opportunity.account} ${tab}`, status: "Active" }]} /></Panel>}
    </>
  );
}

function QuoteDetail({ id, setRoute, showToast }) {
  const quote = quoteMeta(quotes.find(item => item.id === id) || quotes[0]);
  const [tab, setTab] = useState("Quote Lines");
  const lines = ["Internet Access 1Gbps", "MPLS Network", "SD-WAN Appliance"].map((name, index) => ({ id: `${quote.id}-${index + 1}`, line: index + 1, service: name, type: index === 2 ? "Equipment" : "Service", billing: index === 2 ? "One-time" : "Monthly", qty: index === 2 ? 3 : 1, unit: index === 0 ? 1000 : index === 1 ? 2500 : 1200, mrc: index === 2 ? 0 : index === 0 ? quote.mrc : Math.round(quote.mrc * 0.45), nrc: index === 2 ? quote.nrc : 0, discount: `${quote.discount}%`, taxes: Math.round(quote.taxes / 3), total: index === 2 ? quote.nrc : Math.round(quote.mrc * (index === 0 ? 1 : 0.45)) }));
  return (
    <>
      <RecordHeader breadcrumb={["Pricing", "Quotes", quote.id]} title={`Quote: ${quote.id}`} status={quote.status === "Approval" ? "Approval Required" : quote.status} subtitle={`${quote.account} · ${quote.opportunityName} · Quote Date ${quote.quoteDate} · Expiration ${quote.expiration} · TCV ${formatMoney(quote.tcv)}`} actions={<><ActionButton icon="pricing" onClick={() => showToast("Quote cloned")}>Clone</ActionButton><ActionButton icon="workflow" onClick={() => showToast("Quote sent")}>Send</ActionButton><ActionButton icon="workflow" variant="button" onClick={() => showToast("Quote submitted for approval")}>Submit Approval</ActionButton><ActionButton icon="reports" onClick={() => showToast("Quote PDF exported")}>Export PDF</ActionButton><ActionButton icon="orders" onClick={() => setRoute("orders")}>Convert to Order</ActionButton></>} />
      <SummaryStrip items={[{ label: "Account", value: quote.account, note: quote.billingAccount }, { label: "Term", value: `${quote.term} mo`, note: quote.productPackage }, { label: "Total MRC", value: formatMoney(quote.mrc), note: `NRC ${formatMoney(quote.nrc)}` }, { label: "Margin", value: `${quote.margin}%`, note: quote.approvalRequired ? "Approval required" : "Within guardrail" }]} />
      <Tabs tabs={["Quote Lines", "Pricing Summary", "Discounts", "Cost Inputs", "Approval", "Notes", "Documents"]} active={tab} onChange={setTab} />
      {tab === "Quote Lines" && <Panel title="Quote Lines" description="Service, equipment, recurring, one-time, discount, tax, and total line detail."><DataTable columns={[{ key: "line", label: "Line #" }, { key: "service", label: "Product/Service" }, { key: "type", label: "Type" }, { key: "billing", label: "Billing Type" }, { key: "qty", label: "Quantity" }, { key: "unit", label: "Unit Price", render: row => formatMoney(row.unit) }, { key: "mrc", label: "MRC", render: row => formatMoney(row.mrc) }, { key: "nrc", label: "NRC", render: row => formatMoney(row.nrc) }, { key: "discount", label: "Discount" }, { key: "taxes", label: "Taxes/Fees", render: row => formatMoney(row.taxes) }, { key: "total", label: "Total", render: row => formatMoney(row.total) }]} rows={lines} /></Panel>}
      {tab === "Pricing Summary" && <section className="record-main-layout"><Panel title="Pricing Summary" description="Charges, taxes, margin, floor, recommended price, and approval gate."><div className="field-grid"><MiniStat label="Monthly Recurring Charges" value={formatMoney(quote.mrc)} /><MiniStat label="Non-Recurring Charges" value={formatMoney(quote.nrc)} /><MiniStat label="Discounts" value={`${quote.discount}%`} /><MiniStat label="Taxes/Surcharges" value={formatMoney(quote.taxes)} /><MiniStat label="Estimated Margin" value={`${quote.margin}%`} /><MiniStat label="Floor Price" value={formatMoney(Math.round(quote.mrc * 0.86))} /><MiniStat label="Recommended Price" value={formatMoney(Math.round(quote.mrc * 1.04))} /><MiniStat label="Approval Required" value={quote.approvalRequired ? "Yes" : "No"} /></div></Panel><Panel title="Quote Versions" description="Version history and difference summary."><DataTable columns={[{ key: "version", label: "Version" }, { key: "status", label: "Status" }, { key: "difference", label: "Difference Summary" }]} rows={[{ id: "v1", version: "Version 1", status: "Draft", difference: "Initial package with standard MRC" }, { id: "v2", version: "Version 2", status: "Pricing Review", difference: "Added NRC waiver and 12% discount" }, { id: "v3", version: "Version 3", status: quote.status, difference: "Finance margin exception added" }]} /></Panel></section>}
      {tab === "Approval" && <Panel title="Approval" description="Approval workflow steps."><DataTable columns={[{ key: "step", label: "Step" }, { key: "owner", label: "Owner" }, { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Approved" ? "success" : row.status === "Pending" ? "warn" : "blue"}>{row.status}</StatusTag> }]} rows={["Draft", "Pricing Review", "Sales Manager", "Finance", "Approved"].map((step, index) => ({ id: step, step, owner: ["Sales", "Pricing Desk", "Sales Manager", "Finance", "System"][index], status: index < 2 ? "Approved" : index === 2 ? "Pending" : "Open" }))} /></Panel>}
      {!["Quote Lines", "Pricing Summary", "Approval"].includes(tab) && <Panel title={tab} description={`${tab} connected to ${quote.id}.`}><DataTable columns={[{ key: "id", label: "ID" }, { key: "name", label: "Name" }, { key: "status", label: "Status" }]} rows={[{ id: `${tab}-1`, name: `${quote.id} ${tab}`, status: "Active" }]} /></Panel>}
    </>
  );
}

function ProductDetail({ id, setRoute, showToast }) {
  const product = productMeta(services.find(item => item.id === id) || services[0]);
  const [tab, setTab] = useState("Overview");
  return (
    <>
      <RecordHeader breadcrumb={["Product", "Catalog", product.code]} title={product.name} status={product.status} subtitle={`${product.code} · ${product.lifecycle} · Product Manager ${product.productManager}`} actions={<><ActionButton icon="products" variant="button" onClick={() => showToast("Offer workflow opened")}>New Offer</ActionButton><ActionButton icon="pricing" onClick={() => setRoute("pricing")}>View Pricing</ActionButton><ActionButton icon="workflow" onClick={() => setRoute("products")}>Back</ActionButton></>} />
      <Tabs tabs={["Overview", "Pricing", "Eligibility", "Billing Mapping", "Provisioning Mapping", "Dependencies", "Offers", "Reporting"]} active={tab} onChange={setTab} />
      {tab === "Overview" && <Panel title="Overview" description="Operational service catalog definition."><div className="field-grid"><MiniStat label="Description" value={product.name} note={product.subProducts.join(", ")} /><MiniStat label="Category" value={product.category} note={product.productType} /><MiniStat label="Billing Type" value={product.billingType} note={product.serviceType} /><MiniStat label="Launch Date" value={product.launchDate} note={`Retirement ${product.retirementDate}`} /></div></Panel>}
      {tab === "Pricing" && <Panel title="Pricing" description="Default charges, cost inputs, margin floor, and discount limits."><div className="field-grid"><MiniStat label="Default MRC" value={formatMoney(product.defaultMrc)} /><MiniStat label="Default NRC" value={formatMoney(product.defaultNrc)} /><MiniStat label="Cost Inputs" value={formatMoney(product.cost)} note="Annualized cost basis" /><MiniStat label="Minimum Margin" value={`${product.minMargin}%`} /><MiniStat label="Discount Limit" value={product.discountLimit} /></div></Panel>}
      {tab === "Eligibility" && <Panel title="Eligibility" description="Where the product can be sold and provisioned."><DataTable columns={[{ key: "region", label: "Region" }, { key: "availability", label: "Network Availability" }, { key: "segment", label: "Customer Segment" }, { key: "requirements", label: "Location Requirements" }]} rows={["Midwest", "Southeast", "Southwest"].map(region => ({ id: region, region, availability: "On-net / near-net", segment: "Enterprise, SMB", requirements: "Serviceable address, LOA if tenant-managed" }))} /></Panel>}
      {tab === "Billing Mapping" && <Panel title="Billing Mapping" description="Charge codes, GL code, invoice description, and tax category."><DataTable columns={[{ key: "charge", label: "Charge Code" }, { key: "gl", label: "GL Code" }, { key: "desc", label: "Invoice Description" }, { key: "tax", label: "Tax Category" }]} rows={[{ id: "mrc", charge: `${product.code}-MRC`, gl: "4100-Recurring", desc: `${product.name} monthly recurring`, tax: "Telecom recurring" }, { id: "nrc", charge: `${product.code}-NRC`, gl: "4200-Install", desc: `${product.name} install / activation`, tax: "One-time service" }]} /></Panel>}
      {tab === "Provisioning Mapping" && <Panel title="Provisioning Mapping" description="Service codes, install workflow, equipment, and order dependencies."><DataTable columns={[{ key: "code", label: "Service Code" }, { key: "workflow", label: "Install Workflow" }, { key: "equipment", label: "Required Equipment" }, { key: "dependency", label: "Order Dependencies" }]} rows={[{ id: "svc", code: `${product.code}-SVC`, workflow: "Serviceability, circuit assignment, CPE activation", equipment: "ONT / managed CPE", dependency: "Billing account and service location required" }]} /></Panel>}
      {tab === "Dependencies" && <Panel title="Dependencies" description="Required products and add-ons."><DataTable columns={[{ key: "product", label: "Required Product/Add-on" }, { key: "type", label: "Type" }, { key: "status", label: "Status" }]} rows={product.subProducts.map(item => ({ id: item, product: item, type: "Add-on", status: "Active" }))} /></Panel>}
      {!["Overview", "Pricing", "Eligibility", "Billing Mapping", "Provisioning Mapping", "Dependencies"].includes(tab) && <Panel title={tab} description={`${tab} for ${product.name}.`}><DataTable columns={[{ key: "id", label: "Record" }, { key: "name", label: "Name" }, { key: "status", label: "Status" }]} rows={[{ id: `${tab}-1`, name: `${product.name} ${tab}`, status: "Active" }]} /></Panel>}
    </>
  );
}

function invoicePdfLines(invoice) {
  return [
    `Invoice Number: ${invoice.id} | Invoice Date: ${invoice.invoiceDate} | Due Date: ${invoice.due}`,
    `Billing Account: ${invoice.billingAccount} | Customer Account: ${invoice.accountNumber} | Status: ${invoice.status}`,
    "## Bill To",
    `${invoice.customer} | ${invoice.billingAddress.replaceAll("\n", ", ")} | Contact: ${invoice.contact}`,
    "## Account Summary",
    `Previous Balance: ${formatMoney(Math.round(invoice.amount * 0.42))} | Payments Received: ${formatMoney(invoice.paid)} | Adjustments: ${formatMoney(invoice.discounts)}`,
    `Current Charges: ${formatMoney(invoice.recurring + invoice.usageAmount + invoice.oneTime)} | Taxes/Surcharges: ${formatMoney(invoice.taxes)} | Total Amount Due: ${formatMoney(invoice.balance)}`,
    "## Charge Summary",
    `Recurring Services: ${formatMoney(invoice.recurring)} | Usage Charges: ${formatMoney(invoice.usageAmount)} | One-Time Charges: ${formatMoney(invoice.oneTime)} | Equipment: ${formatMoney(Math.round(invoice.oneTime * 0.4))}`,
    `Discounts: ${formatMoney(invoice.discounts)} | Taxes and Regulatory Fees: ${formatMoney(invoice.taxes)}`,
    "## Service Detail",
    ...invoice.serviceRows.map(row => `${row.serviceId} | ${row.product} | ${row.period} | MRC ${formatMoney(row.mrc)} | NRC ${formatMoney(row.nrc)} | Usage ${formatMoney(row.usage)} | Taxes ${formatMoney(row.taxes)} | Total ${formatMoney(row.total)}`),
    "## Payment Instructions",
    "Remit To: Northstar Telecom, PO Box 12545, Dallas, TX 75201 | Terms: Net 30 | Pay online at billing.northstar.example",
    "## Footer",
    "Disputes must be submitted within 30 days with invoice number, service ID, and adjustment reason."
  ];
}

function InvoiceDetail({ id, setRoute, showToast }) {
  const invoice = enrichedInvoice(invoices.find(item => item.id === id) || invoices[0]);
  const [tab, setTab] = useState("Summary");
  const adjustmentRows = adjustments.filter(item => item.customerId === invoice.customerId);
  function exportInvoicePdf() {
    downloadBlob(makePdfBlob(invoicePdfLines(invoice)), `${invoice.id}.pdf`);
    showToast("Invoice PDF exported");
  }
  return (
    <>
      <RecordHeader
        breadcrumb={["Billing", "Invoices", invoice.id]}
        title={`Invoice ${invoice.id}`}
        status={invoice.status}
        subtitle={`${invoice.customer} · ${invoice.billingAccount} · Invoice Date ${invoice.invoiceDate} · Due ${invoice.due} · Balance Due ${formatMoney(invoice.balance)}`}
        actions={<><ActionButton icon="workflow" onClick={() => showToast("Invoice sent")}>Send</ActionButton><ActionButton icon="reports" variant="button" onClick={exportInvoicePdf}>Export PDF</ActionButton><ActionButton icon="billing" onClick={() => showToast("Payment recorded")}>Record Payment</ActionButton><ActionButton icon="workflow" onClick={() => showToast("Credit memo created")}>Create Credit</ActionButton><ActionButton icon="workflow" onClick={() => showToast("Dispute opened")}>Dispute</ActionButton><ActionButton icon="workflow" onClick={() => showToast("Adjustment workflow opened")}>Adjust</ActionButton></>}
      />
      <Tabs tabs={["Summary", "Line Items", "Usage Detail", "Payments", "Adjustments", "Notes", "Documents"]} active={tab} onChange={setTab} />
      {tab === "Summary" && <section className="record-main-layout"><Panel title="Invoice Summary" description="Charge components, amount paid, and balance due."><div className="field-grid invoice-summary-grid"><MiniStat label="Recurring Charges" value={formatMoney(invoice.recurring)} /><MiniStat label="Usage Charges" value={formatMoney(invoice.usageAmount)} /><MiniStat label="One-Time Charges" value={formatMoney(invoice.oneTime)} /><MiniStat label="Discounts" value={formatMoney(invoice.discounts)} /><MiniStat label="Taxes/Surcharges" value={formatMoney(invoice.taxes)} /><MiniStat label="Total Amount" value={formatMoney(invoice.amount)} /><MiniStat label="Amount Paid" value={formatMoney(invoice.paid)} /><MiniStat label="Balance Due" value={formatMoney(invoice.balance)} note={invoice.status} /></div></Panel><div className="side-stack"><Panel title="Aging" description="Invoice aging buckets."><DataTable columns={[{ key: "bucket", label: "Bucket" }, { key: "amount", label: "Amount", render: row => formatMoney(row.amount) }]} rows={[{ id: "0", bucket: "0-30", amount: invoice.aging <= 30 ? invoice.balance : 0 }, { id: "31", bucket: "31-60", amount: invoice.aging > 30 && invoice.aging <= 60 ? invoice.balance : 0 }, { id: "61", bucket: "61-90", amount: invoice.aging > 60 && invoice.aging <= 90 ? invoice.balance : 0 }, { id: "90", bucket: "90+", amount: invoice.aging > 90 ? invoice.balance : 0 }]} /></Panel><Panel title="Payment" description="Payment method and remit-to."><div className="field-grid compact-fields"><MiniStat label="Payment Terms" value="Net 30" /><MiniStat label="Payment Method" value="ACH" /><MiniStat label="Remit To" value="Northstar Telecom" note="PO Box 12545, Dallas, TX" /><MiniStat label="AutoPay" value="No" /></div></Panel></div></section>}
      {tab === "Line Items" && <Panel title="Line Items" description="Service-level charge detail."><DataTable columns={[{ key: "line", label: "Line #" }, { key: "serviceId", label: "Service ID" }, { key: "product", label: "Product" }, { key: "description", label: "Description" }, { key: "period", label: "Billing Period" }, { key: "quantity", label: "Quantity" }, { key: "rate", label: "Rate", render: row => formatMoney(row.rate) }, { key: "mrc", label: "MRC", render: row => formatMoney(row.mrc) }, { key: "nrc", label: "NRC", render: row => formatMoney(row.nrc) }, { key: "usage", label: "Usage", render: row => formatMoney(row.usage) }, { key: "discount", label: "Discount", render: row => formatMoney(row.discount) }, { key: "taxes", label: "Taxes/Surcharges", render: row => formatMoney(row.taxes) }, { key: "total", label: "Total", render: row => formatMoney(row.total) }]} rows={invoice.serviceRows} /></Panel>}
      {tab === "Usage Detail" && <Panel title="Usage Detail" description="Rated usage by service and location."><DataTable columns={[{ key: "usageType", label: "Usage Type" }, { key: "dateRange", label: "Date Range" }, { key: "quantity", label: "Quantity" }, { key: "unit", label: "Unit" }, { key: "rated", label: "Rated Amount", render: row => formatMoney(row.rated) }, { key: "serviceId", label: "Service ID" }, { key: "location", label: "Location" }]} rows={invoice.serviceRows.map((row, index) => ({ id: `USG-${row.id}`, usageType: index % 2 ? "Voice minutes" : "Data transfer", dateRange: "May 1-31, 2026", quantity: index % 2 ? 4820 : 32.4, unit: index % 2 ? "Minutes" : "TB", rated: row.usage, serviceId: row.serviceId, location: `${100 + index * 22} Network Plaza` }))} /></Panel>}
      {tab === "Adjustments" && <Panel title="Adjustments" description="Invoice credits, disputes, approvals, and adjustment reasons."><DataTable columns={[{ key: "id", label: "Adjustment ID" }, { key: "type", label: "Type" }, { key: "amount", label: "Amount", render: row => formatMoney(row.amount) }, { key: "reason", label: "Reason", render: row => row.type }, { key: "status", label: "Status" }, { key: "createdBy", label: "Created By", render: () => "Billing Ops" }, { key: "approvedBy", label: "Approved By", render: row => row.status === "Posted" ? "Finance" : "Pending" }, { key: "date", label: "Date", render: () => "2026-05-13" }]} rows={adjustmentRows} /></Panel>}
      {!["Summary", "Line Items", "Usage Detail", "Adjustments"].includes(tab) && <Panel title={tab} description={`${tab} connected to ${invoice.id}.`}><DataTable columns={[{ key: "id", label: "Record" }, { key: "name", label: "Name" }, { key: "status", label: "Status" }]} rows={[{ id: `${tab}-1`, name: `${invoice.id} ${tab}`, status: "Active" }]} /></Panel>}
    </>
  );
}

function ServiceDetail({ id, setRoute, showToast }) {
  const customer = customers.find(item => id.startsWith(item.id)) || customers[0];
  const instance = serviceInstancesFor(customer).find(item => item.id === id) || serviceInstancesFor(customer)[0];
  return (
    <>
      <PageHeader title={`${instance.service} service detail`} description={`${customer.name} · ${instance.circuitId} · ${instance.location}`} actions={<ToolbarButton icon="billing" onClick={() => setRoute(`details/billing-account/${customer.id}`)}>Back to account</ToolbarButton>} />
      <section className="overview-grid">
        <MetricCard label="Status" value={instance.status} delta="Service lifecycle state" />
        <MetricCard label="Circuit" value={instance.circuitId} delta={instance.location} />
        <MetricCard label="Recurring price" value={formatMoney(instance.price)} delta={instance.promo} />
        <MetricCard label="Customer" value={customer.name} delta={customer.id} />
      </section>
      <Panel title="Service actions" description="Service-level controls for activation, disconnect, offers, promos, and pricing changes.">
        <div className="button-cluster"><button className="button" type="button" onClick={() => showToast("Service activation queued")}>Activate</button><button className="ghost-button" type="button" onClick={() => showToast("Disconnect order opened")}>Disconnect</button><button className="ghost-button" type="button" onClick={() => showToast("Promo attached")}>Attach promo</button><button className="ghost-button" type="button" onClick={() => showToast("Offer attached")}>Attach offer</button><button className="ghost-button" type="button" onClick={() => showToast("Pricing change started")}>Change pricing</button></div>
      </Panel>
    </>
  );
}

function DetailPage({ route, setRoute, showToast }) {
  const [, type, id] = route.split("/");
  if (type === "billing-account") return <BillingAccountDetail id={id} setRoute={setRoute} showToast={showToast} />;
  if (type === "invoice") return <InvoiceDetail id={id} setRoute={setRoute} showToast={showToast} />;
  if (type === "opportunity") return <OpportunityDetail id={id} setRoute={setRoute} showToast={showToast} />;
  if (type === "quote") return <QuoteDetail id={id} setRoute={setRoute} showToast={showToast} />;
  if (type === "product") return <ProductDetail id={id} setRoute={setRoute} showToast={showToast} />;
  if (type === "order") return <OrderDetail id={id} setRoute={setRoute} showToast={showToast} />;
  if (type === "service") return <ServiceDetail id={id} setRoute={setRoute} showToast={showToast} />;
  const records = {
    lead: leads.find(item => item.id === id),
    opportunity: opportunities.find(item => item.id === id),
    quote: quotes.find(item => item.id === id),
    customer: customers.find(item => item.id === id),
    product: services.find(item => item.id === id),
    ticket: tickets.find(item => item.id === id),
    network: networkEvents.find(item => item.id === id),
    invoice: invoices.find(item => item.id === id)
  };
  const record = records[type] || services.find(item => item.id === id) || customers.find(item => item.id === id);
  const rows = Object.entries(record || {}).map(([key, value]) => ({ id: key, field: key, value: Array.isArray(value) ? value.join(", ") : String(value) }));
  return (
    <>
      <PageHeader title={`${type || "Record"} detail`} description={id} actions={<ToolbarButton icon="workflow" onClick={() => setRoute(detailBackRoutes[type] || "dashboard")}>Back</ToolbarButton>} />
      <section className="detail-hero-panel">
        <div>
          <span>{type}</span>
          <h2>{record?.name || record?.account || record?.package || record?.type || record?.service || id}</h2>
          <p>{record?.status || record?.stage || record?.priority || record?.severity || "Ready for review"}</p>
        </div>
        <div className="detail-action-stack">
          <button className="button" type="button" onClick={() => showToast("Record updated")}>Update</button>
          <button className="ghost-button" type="button" onClick={() => showToast("Assignment changed")}>Assign</button>
          <button className="ghost-button" type="button" onClick={() => showToast("Audit history opened")}>Audit</button>
        </div>
      </section>
      <section className="detail-layout">
        <Panel title="Summary" description="Structured record fields for the selected item.">
          <DataTable columns={[{ key: "field", label: "Field" }, { key: "value", label: "Value" }]} rows={rows} />
        </Panel>
        <Panel title="Related work" description="Connected customer, order, ticket, invoice, and reporting context.">
          <div className="compact-card-stack">
            <div className="compact-card"><strong>Owner queue</strong><span>Operations team · next review today</span></div>
            <div className="compact-card"><strong>Workflow state</strong><span>Ready for API-backed action history</span></div>
            <div className="compact-card"><strong>Reporting</strong><span>Available for export and audit trace</span></div>
          </div>
        </Panel>
      </section>
    </>
  );
}

function ServiceOpsModule({ route }) {
  const copy = {
    network: ["Network", "Network events, customer-reported outages, SLA exposure, and impact monitoring."],
    "service-management": ["Service management", "Service catalog, SLA policies, provisioning queues, and change work."],
    provisioning: ["Provisioning", "Activation jobs, installs, inventory exceptions, and service turn-up."],
    "carrier-settlement": ["Carrier settlement", "Partner invoice reconciliation, credits, interconnect claims, and settlement risk."]
  }[route] || ["Operations", "Operational workspace."];
  return (
    <>
      <PageHeader title={copy[0]} description={copy[1]} actions={<ToolbarButton icon="workflow" variant="button">Advance workflow</ToolbarButton>} />
      <section className="overview-grid">
        <MetricCard label="Network events" value={networkEvents.length} delta="Impact and SLA exposure" />
        <MetricCard label="Provisioning jobs" value={orders.length} delta="Orders needing fulfillment" />
        <MetricCard label="Service products" value={services.length} delta="Catalog entries" />
        <MetricCard label="Settlement exposure" value={formatMoney(sum(adjustments, item => Math.abs(item.amount)))} delta="Credits and disputes" />
      </section>
      <section className="ops-split">
        <Panel title="Event and service queue" description="Operational work across NOC, service, and fulfillment.">
          <DataTable columns={[{ key: "id", label: "Event" }, { key: "market", label: "Market" }, { key: "type", label: "Type" }, { key: "impacted", label: "Impacted" }, { key: "slaExposure", label: "SLA exposure", render: event => formatMoney(event.slaExposure) }, { key: "severity", label: "Severity", render: event => <StatusTag tone={event.severity === "Critical" ? "warn" : "blue"}>{event.severity}</StatusTag> }]} rows={networkEvents} />
        </Panel>
        <Panel title="Service catalog watch" description="Product owners and service lifecycle used by operations.">
          <div className="compact-card-stack">{services.map(service => <div className="compact-card" key={service.id}><strong>{service.name}</strong><span>{service.owner} · {service.lifecycle} · {service.subProducts.join(", ")}</span></div>)}</div>
        </Panel>
      </section>
    </>
  );
}

function ReportsModule({ showToast }) {
  const [params, setParams] = useState({ reportId: "executive-scorecard", region: "All regions", period: "Q2 2026 to date", segment: "All segments", status: "All statuses" });
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const definition = reportDefinitions.find(report => report.id === params.reportId) || reportDefinitions[0];
  const filteredRows = useMemo(() => reportRows.filter(row => row.reportId === params.reportId && (params.region === "All regions" || row.region === params.region) && (params.segment === "All segments" || row.segment === params.segment) && (params.status === "All statuses" || row.status === params.status)), [params]);
  const pages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const total = sum(filteredRows, row => row.amount);
  function updateParam(key, value) { setParams(current => ({ ...current, [key]: value })); setPage(1); }
  function exportReport() {
    const rows = [["Report", definition.name], ["Region", params.region], ["Period", params.period], [], ["Account", "Region", "Segment", "Service", "Amount", "Metric", "Status"], ...filteredRows.map(row => [row.account, row.region, row.segment, row.service, row.amount, row.metric, row.status])];
    downloadBlob(makeXlsx(rows), `${definition.id}-${params.period.toLowerCase().replaceAll(" ", "-")}.xlsx`);
    showToast("Excel report exported");
  }
  function exportCsv() {
    const rows = [["Account", "Region", "Segment", "Service", "Amount", "Metric", "Status"], ...filteredRows.map(row => [row.account, row.region, row.segment, row.service, row.amount, row.metric, row.status])];
    const csv = rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv" }), `${definition.id}-${params.period.toLowerCase().replaceAll(" ", "-")}.csv`);
    showToast("CSV report exported");
  }
  return (
    <>
      <PageHeader title="Reports" description="Dashboard, paginated operational reports, input parameters, live result set, and exports." />
      <section className="report-studio">
        <aside className="report-catalog">
          <div className="report-catalog-header"><Icon name="reports" className="button-icon" /><strong>Report catalog</strong></div>
          {reportDefinitions.map(report => <button className={report.id === params.reportId ? "report-item active" : "report-item"} type="button" key={report.id} onClick={() => updateParam("reportId", report.id)}><strong>{report.name}</strong><span>{report.area}</span></button>)}
        </aside>
        <main className="report-workbench">
          <div className="parameter-ribbon">
            <label>Region<select value={params.region} onChange={event => updateParam("region", event.target.value)}>{["All regions", "Midwest", "Southeast", "Southwest", "West Coast"].map(value => <option key={value}>{value}</option>)}</select></label>
            <label>Period<select value={params.period} onChange={event => updateParam("period", event.target.value)}>{["May 2026", "April 2026", "Q2 2026 to date", "Rolling 90 days"].map(value => <option key={value}>{value}</option>)}</select></label>
            <label>Segment<select value={params.segment} onChange={event => updateParam("segment", event.target.value)}>{["All segments", "SMB", "Enterprise", "Wholesale"].map(value => <option key={value}>{value}</option>)}</select></label>
            <label>Status<select value={params.status} onChange={event => updateParam("status", event.target.value)}>{["All statuses", "Approved", "Open", "Priority", "Review", "Active", "Staged"].map(value => <option key={value}>{value}</option>)}</select></label>
            <ToolbarButton icon="reports" variant="button" onClick={() => showToast("Report refreshed")}>Run</ToolbarButton>
          </div>
          <section className="report-page">
            <div className="report-page-header"><div><h2>{definition.name}</h2><p>{definition.description}</p></div><div className="module-toolbar"><button className="ghost-button" disabled={page === 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</button><button className="ghost-button" disabled={page === pages} onClick={() => setPage(value => Math.min(pages, value + 1))}>Next</button><button className="button" type="button" onClick={exportReport}>.xlsx Excel</button><button className="ghost-button" type="button" onClick={exportCsv}>.csv CSV</button></div></div>
            <div className="report-summary-strip"><div className="report-summary-card"><span>Total exposure</span><strong>{formatMoney(total)}</strong></div><div className="report-summary-card"><span>Rows</span><strong>{filteredRows.length}</strong></div><div className="report-summary-card"><span>Page</span><strong>{page} of {pages}</strong></div><div className="report-summary-card"><span>Area</span><strong>{definition.area}</strong></div></div>
            <DataTable columns={[{ key: "account", label: "Account" }, { key: "region", label: "Region" }, { key: "segment", label: "Segment" }, { key: "service", label: "Service" }, { key: "amount", label: "Amount", render: row => formatMoney(row.amount) }, { key: "metric", label: "Metric" }, { key: "status", label: "Status", render: row => <StatusTag tone={["Priority", "Open", "Review", "Urgent"].includes(row.status) ? "warn" : "blue"}>{row.status}</StatusTag> }]} rows={visibleRows} />
            {!visibleRows.length && <div className="empty-state">No rows match the current parameters.</div>}
          </section>
        </main>
      </section>
    </>
  );
}

export default function App() {
  const [route, setRoute] = useRoute();
  const [toast, setToast] = useState("");
  function showToast(message) { setToast(message); window.clearTimeout(showToast.timer); showToast.timer = window.setTimeout(() => setToast(""), 2200); }
  return (
    <Shell activeRoute={route} setRoute={setRoute}>
      {route === "dashboard" && <Dashboard setRoute={setRoute} />}
      {route === "sales" && <SalesModule setRoute={setRoute} showToast={showToast} />}
      {route === "pricing" && <PricingModule setRoute={setRoute} showToast={showToast} />}
      {route === "products" && <ProductsModule setRoute={setRoute} showToast={showToast} />}
      {route === "customer-service" && <CustomerServiceModule setRoute={setRoute} />}
      {route === "customer-360" && <Customer360Module setRoute={setRoute} showToast={showToast} />}
      {route === "billing" && <BillingModule setRoute={setRoute} showToast={showToast} />}
      {route === "orders" && <OrdersModule setRoute={setRoute} showToast={showToast} />}
      {route === "reports" && <ReportsModule showToast={showToast} />}
      {route.startsWith("details/") && <DetailPage route={route} setRoute={setRoute} showToast={showToast} />}
      {["network", "service-management", "provisioning", "carrier-settlement"].includes(route) && <ServiceOpsModule route={route} />}
      <Toast toast={toast} />
    </Shell>
  );
}
