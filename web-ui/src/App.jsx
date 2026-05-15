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
const routeAliases = { pricing: "product-pricing", products: "product-pricing" };
const normalizeRoute = route => routeAliases[route] || route;

const detailBackRoutes = {
  lead: "sales",
  opportunity: "sales",
  quote: "sales",
  customer: "customer-360",
  product: "product-pricing",
  "product-pricing": "product-pricing",
  ticket: "customer-service",
  network: "customer-service",
  invoice: "billing",
  service: "billing",
  "pricing-strategic": "product-pricing",
  "pricing-promos": "product-pricing",
  "pricing-offers": "product-pricing",
  "pricing-costs": "product-pricing",
  "pricing-coefficients": "product-pricing",
  "pricing-reporting": "product-pricing",
  "product-development": "product-pricing",
  "product-lifecycle": "product-pricing",
  "product-costs": "product-pricing",
  "product-offers": "product-pricing",
  "product-reporting": "product-pricing"
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
  return normalizeRoute(route === "quotes" ? "sales" : route || "dashboard");
}

function useRoute() {
  const [route, setRouteState] = useState(currentHashRoute);
  useEffect(() => {
    const handleHashChange = () => setRouteState(currentHashRoute());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);
  function setRoute(next) {
    const route = normalizeRoute(next);
    window.location.hash = `/${route}`;
    setRouteState(route);
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

function RecordHeader({ breadcrumb, title, status, subtitle, actions, meta }) {
  return (
    <section className="record-header">
      <div>
        <Breadcrumb items={breadcrumb} />
        <div className="record-title-line">
          <h2>{title}</h2>
          {status && <StatusTag tone={["Past Due", "At Risk", "Approval Required", "Pending Network", "Disputed"].includes(status) ? "warn" : ["Active", "Approved", "Paid", "Completed"].includes(status) ? "success" : "blue"}>{status}</StatusTag>}
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
  if (invoice.status === "Current") return "Open";
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
  const category = productCategories[index % productCategories.length];
  const lifecycle = service.lifecycle;
  const health = Math.max(58, Math.min(97, Math.round(service.margin + (service.status === "Live" ? 30 : 22) + (lifecycle === "Growth" ? 8 : lifecycle === "Launch" ? 5 : lifecycle === "Refresh" ? 2 : 0))));
  const healthBand = health >= 80 ? "Healthy" : health >= 65 ? "Watch" : "At Risk";
  const availability = ["On-net", "Near-net", "Multi-market", "Serviceable"][index % 4];
  return {
    ...service,
    code: ["FIB-1G", "WIRE-IOT", "VOICE-PRO", "SDWAN-EDGE", "IOT-APN"][index] || service.id,
    category,
    subCategory: ["Access", "Managed", "Voice", "Transport", "Wireless"][index % 5],
    billingType: index % 2 ? "Usage + Monthly" : "Monthly",
    productType: service.productType === "Mobility" ? "Wireless" : service.productType,
    serviceType: service.family,
    provisioningType: ["Standard install", "Managed activation", "Self-serve", "Field install", "Network turn-up"][index % 5],
    contractTypes: index % 2 ? ["MSA", "Order Form"] : ["MSA", "Term Commitment"],
    dependencies: service.subProducts,
    tags: [category, lifecycle, service.status, service.owner.split(" ")[0]],
    availability,
    launchDate: ["2025-02-01", "2024-09-15", "2023-11-10", "2025-04-01", "2026-01-15"][index],
    retirementDate: service.lifecycle === "Mature" ? "2027-12-31" : "TBD",
    defaultMrc: 980 + index * 420,
    defaultNrc: 750 + index * 180,
    minMargin: Math.max(22, Math.round(service.margin - 6)),
    discountLimit: `${index % 2 ? 15 : 10}%`,
    health,
    healthBand,
    createdDate: ["2024-08-10", "2024-06-04", "2023-11-20", "2025-01-25", "2025-12-08"][index],
    lastUpdated: ["2026-05-11", "2026-05-09", "2026-05-06", "2026-05-12", "2026-05-13"][index],
    totalQuotes: 14 + index * 9,
    winRate: [62, 54, 46, 58, 39][index],
    revenueFromWins: service.revenue,
    grossMargin: service.margin,
    billingCodes: [`${service.id}-MRC`, `${service.id}-NRC`, `${service.id}-DISC`],
    priceList: [`${category} Core`, `${category} Strategic`, `${category} Enterprise`],
    priceRules: [
      "Volume discounts require approval above 10%",
      "Term uplift applies to 36 month commitments",
      "Regional uplift applies to constrained markets"
    ],
    promoCodes: [`${service.id}-PROMO`, `${category}-RAMP`],
    offerBundles: [`${service.name} base`, `${category} service bundle`],
    costComponents: [
      { id: `${service.id}-TRANSPORT`, label: "Transport", amount: Math.round(service.cost * 0.34) },
      { id: `${service.id}-EQUIP`, label: "Equipment", amount: Math.round(service.cost * 0.29) },
      { id: `${service.id}-INSTALL`, label: "Install", amount: Math.round(service.cost * 0.19) },
      { id: `${service.id}-SUPPORT`, label: "Support", amount: Math.round(service.cost * 0.18) }
    ],
    coefficientNotes: [
      { name: "Market pressure", value: "+2.1%" },
      { name: "Term uplift", value: "-0.6%" },
      { name: "Install density", value: "+1.4%" }
    ]
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
            <ActionButton icon="pricing" onClick={() => setTab("Custom Pricing")}>Create Quote</ActionButton>
          </>
        }
      />
      <SummaryStrip items={[
        { label: "Pipeline Value", value: formatMoney(pipeline), note: "Open account opportunities" },
        { label: "Weighted Pipeline", value: formatMoney(weighted), note: "Probability adjusted" },
        { label: "Open Opportunities", value: filteredOpps.length, note: "Across sales stages" },
        { label: "Quotes Pending Approval", value: quotes.filter(quote => quote.status === "Approval").length, note: "Pricing and finance queue" }
      ]} />
      <Tabs tabs={["Leads", "Opportunities", "Accounts", "Custom Pricing", "Activities"]} active={tab} onChange={setTab} />
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
      {tab === "Custom Pricing" && <Panel title="Custom Pricing" description="Sales-owned quote pricing, approval routing, and account-specific pricing exceptions." action={<SearchBox value={filters.quotes} onChange={value => setFilters({ ...filters, quotes: value })} placeholder="Search quote, package, account" />}><DataTable columns={[{ key: "id", label: "Quote ID" }, { key: "account", label: "Account" }, { key: "opportunityName", label: "Opportunity" }, { key: "productPackage", label: "Product Package" }, { key: "term", label: "Term", render: row => `${row.term} mo` }, { key: "mrc", label: "MRC", render: row => formatMoney(row.mrc) }, { key: "nrc", label: "NRC", render: row => formatMoney(row.nrc) }, { key: "margin", label: "Margin %", render: row => `${row.margin}%` }, { key: "discount", label: "Discount %", render: row => `${row.discount}%` }, { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Approval" ? "warn" : "blue"}>{row.status}</StatusTag> }, { key: "owner", label: "Owner" }, { key: "actions", label: "Actions", render: row => <div className="table-row-actions"><DetailButton type="quote" id={row.id} setRoute={setRoute} children="View" /><button className="link-button compact-action" type="button" onClick={() => setRoute(`details/quote/${row.id}`)}>Edit Pricing</button><button className="link-button compact-action" type="button" onClick={() => showToast("Custom pricing submitted for approval")}>Submit Approval</button><button className="link-button compact-action" type="button" onClick={() => setRoute("orders")}>Convert to Order</button></div> }]} rows={filteredQuotes.filter(quote => quote.customPrice)} /></Panel>}
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

function ProductPricingModule({ setRoute, showToast }) {
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(false);
  const [filters, setFilters] = useState({
    category: "All categories",
    lifecycle: "All lifecycles",
    health: "All health",
    status: "All statuses",
    owner: "All owners"
  });
  const catalog = services.map(productMeta);
  const filteredProducts = catalog.filter(product => matchAny(product, query, [
    item => item.code,
    item => item.name,
    item => item.category,
    item => item.lifecycle,
    item => item.owner,
    item => item.status,
    item => item.billingCodes.join(" "),
    item => item.promoCodes.join(" "),
    item => item.offerBundles.join(" ")
  ]) && (filters.category === "All categories" || product.category === filters.category) && (filters.lifecycle === "All lifecycles" || product.lifecycle === filters.lifecycle) && (filters.health === "All health" || product.healthBand === filters.health) && (filters.status === "All statuses" || product.status === filters.status) && (filters.owner === "All owners" || product.owner === filters.owner));
  const totalProducts = catalog.length;
  const activeProducts = catalog.filter(product => product.status === "Live").length;
  const newThisQuarter = catalog.filter(product => new Date(product.launchDate) >= new Date("2026-04-01")).length;
  const growthProducts = catalog.filter(product => product.lifecycle === "Growth").length;
  const atRiskProducts = catalog.filter(product => product.healthBand === "At Risk").length;
  const retiringSoon = catalog.filter(product => product.lifecycle === "Refresh" || (product.retirementDate !== "TBD" && new Date(product.retirementDate) <= new Date("2028-01-01"))).length;

  return (
    <>
      <PageHeader
        title="Product & Pricing"
        description="Telecom product lifecycle, billing code, pricing governance, promos, offers, costs, coefficients, and performance."
        actions={<><ActionButton icon="reports" variant="button" onClick={() => showToast("Product export prepared")}>Export</ActionButton><ActionButton icon="products" variant="button" onClick={() => setModal(true)}>New Product</ActionButton></>}
      />
      <SummaryStrip items={[
        { label: "Total Products", value: totalProducts, note: "Catalog entries" },
        { label: "Active Products", value: activeProducts, note: "Live in market" },
        { label: "New This Quarter", value: newThisQuarter, note: "Recent launches" },
        { label: "Products with Growth", value: growthProducts, note: "Lifecycle growth" },
        { label: "At Risk Products", value: atRiskProducts, note: "Health watch list" },
        { label: "Retiring Soon", value: retiringSoon, note: "Lifecycle planning" }
      ]} />
      <FilterRibbon filters={[
        { label: "Category", value: filters.category, onChange: value => setFilters({ ...filters, category: value }), options: ["All categories", ...productCategories] },
        { label: "Lifecycle", value: filters.lifecycle, onChange: value => setFilters({ ...filters, lifecycle: value }), options: ["All lifecycles", "Launch", "Growth", "Mature", "Refresh", "Retire"] },
        { label: "Health", value: filters.health, onChange: value => setFilters({ ...filters, health: value }), options: ["All health", "Healthy", "Watch", "At Risk"] },
        { label: "Status", value: filters.status, onChange: value => setFilters({ ...filters, status: value }), options: ["All statuses", "Live", "Review", "Optimize"] },
        { label: "Owner", value: filters.owner, onChange: value => setFilters({ ...filters, owner: value }), options: ["All owners", ...owners] }
      ]} />
      <Panel
        title="Product catalog"
        description="Operational telecom catalog records with lifecycle, billing codes, ownership, and pricing governance context."
        action={<div className="module-toolbar"><SearchBox value={query} onChange={setQuery} placeholder="Search products, billing codes, promos, offers" /><button className="tiny-button" type="button" onClick={() => showToast("More filters opened")}>More Filters</button></div>}
      >
        <DataTable
          columns={[
            { key: "code", label: "Product Code" },
            { key: "name", label: "Product Name" },
            { key: "category", label: "Category" },
            { key: "lifecycle", label: "Lifecycle", render: row => <StatusTag tone={row.lifecycle === "Growth" ? "success" : row.lifecycle === "Launch" ? "blue" : "warn"}>{row.lifecycle}</StatusTag> },
            { key: "health", label: "Health", render: row => <StatusTag tone={row.healthBand === "Healthy" ? "success" : row.healthBand === "Watch" ? "blue" : "warn"}>{row.healthBand}</StatusTag> },
            { key: "owner", label: "Owner" },
            { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Live" ? "success" : row.status === "Optimize" ? "warn" : "blue"}>{row.status}</StatusTag> },
            { key: "details", label: "Details", render: row => <DetailButton type="product-pricing" id={row.id} setRoute={setRoute} children="Details" /> }
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
            <label>Product Name<input placeholder="Dedicated Internet Access 1G" /></label>
            <label>Category<select>{productCategories.map(category => <option key={category}>{category}</option>)}</select></label>
            <label>Lifecycle<select><option>Launch</option><option>Growth</option><option>Mature</option><option>Refresh</option><option>Retire</option></select></label>
            <label>Billing Type<select><option>Monthly</option><option>Usage + Monthly</option><option>One-time</option></select></label>
            <label>Owner<select>{owners.map(owner => <option key={owner}>{owner}</option>)}</select></label>
          </form>
        </Modal>
      )}
    </>
  );
}

function ProductPricingDetail({ id, setRoute, showToast }) {
  const product = productMeta(services.find(item => item.id === id) || services[0]);
  const [tab, setTab] = useState("Overview");
  const [editModal, setEditModal] = useState(false);
  const billingElements = [
    {
      id: `${product.code}-MRC`,
      code: `${product.code}-MRC`,
      description: `${product.name} monthly recurring charge`,
      type: "Recurring",
      feature: "Core service",
      mrc: product.defaultMrc,
      nrc: 0,
      contractType: product.contractTypes[0],
      status: "Active",
      effective: product.launchDate,
      reason: "Standard lifecycle rate"
    },
    {
      id: `${product.code}-NRC`,
      code: `${product.code}-NRC`,
      description: `${product.name} activation and install charge`,
      type: "One-time",
      feature: "Provisioning",
      mrc: 0,
      nrc: product.defaultNrc,
      contractType: product.contractTypes[1],
      status: "Active",
      effective: product.launchDate,
      reason: "Installation and turn-up"
    },
    {
      id: `${product.code}-DISC`,
      code: `${product.code}-DISC`,
      description: `${product.name} strategic discount control`,
      type: "Discount",
      feature: "Price protection",
      mrc: -Math.round(product.defaultMrc * 0.08),
      nrc: 0,
      contractType: "Approval required",
      status: product.healthBand === "At Risk" ? "Review" : "Active",
      effective: product.lastUpdated,
      reason: "Guardrail exception"
    }
  ];
  const priceRules = product.priceRules.map((rule, index) => ({
    id: `${product.code}-RULE-${index + 1}`,
    name: rule,
    type: ["Guardrail", "Term", "Regional"][index % 3],
    precedence: index + 1,
    status: index === 0 ? "Active" : "Review"
  }));
  const contractTiers = [
    { id: "tier-1", segment: "SMB", term: "12 mo", price: formatMoney(Math.round(product.defaultMrc * 0.96)), margin: "Min 24%" },
    { id: "tier-2", segment: "Enterprise", term: "24 mo", price: formatMoney(product.defaultMrc), margin: "Min 28%" },
    { id: "tier-3", segment: "Strategic", term: "36 mo", price: formatMoney(Math.round(product.defaultMrc * 0.94)), margin: "Approval" }
  ];
  const activePromos = [
    { id: `${product.code}-PROMO-1`, promoCode: `${product.code}-RAMP`, discount: "12%", start: "2026-04-01", end: "2026-06-30", segments: "Enterprise, SMB", minTerm: "24 mo", stackable: "No", redemptions: 34, revenueImpact: formatMoney(28600), markets: "Midwest / Southeast" },
    { id: `${product.code}-PROMO-2`, promoCode: `${product.code}-WINBACK`, discount: "Custom", start: "2026-05-01", end: "2026-07-31", segments: "Strategic", minTerm: "36 mo", stackable: "Yes", redemptions: 11, revenueImpact: formatMoney(12400), markets: "West Coast / Southwest" }
  ];
  const offerRows = [
    { id: `${product.code}-OFFER-1`, name: `${product.name} core bundle`, components: product.dependencies.join(", "), attachRate: "42%", quoteUsage: "78 quotes", winRate: `${product.winRate}%`, segment: "Enterprise" },
    { id: `${product.code}-OFFER-2`, name: `${product.category} expansion pack`, components: "Promo credit, install waiver", attachRate: "31%", quoteUsage: "44 quotes", winRate: `${Math.max(product.winRate - 8, 28)}%`, segment: "SMB" }
  ];
  const costRows = product.costComponents.map((component, index) => ({
    ...component,
    vendor: ["Northstar Network", "Carrier One", "Field Services", "Support Desk"][index],
    history: ["Stable", "Increasing", "Stable", "Watch"][index],
    impact: formatMoney(Math.round(component.amount * 1.18))
  }));
  const coefficientRows = product.coefficientNotes.map((item, index) => ({
    id: `${product.code}-COEF-${index + 1}`,
    name: item.name,
    type: ["Regional", "Term", "Exception"][index],
    value: item.value,
    appliesTo: ["All quotes", "36 mo quotes", "Approval exceptions"][index],
    effectiveDate: ["2026-01-01", "2026-03-01", "2026-05-01"][index],
    status: index === 0 ? "Active" : "Review"
  }));
  const historyRows = [
    { id: `${product.id}-H1`, user: "Rhea Patel", action: "Lifecycle refreshed", field: "Lifecycle", oldValue: "Mature", newValue: product.lifecycle, timestamp: "2026-05-06 09:18" },
    { id: `${product.id}-H2`, user: "Cal Brooks", action: "Pricing guardrail updated", field: "Discount limit", oldValue: "12%", newValue: product.discountLimit, timestamp: "2026-05-09 14:22" },
    { id: `${product.id}-H3`, user: "Maya Ortiz", action: "Billing code aligned", field: "Charge structure", oldValue: "Legacy map", newValue: "Current billing codes", timestamp: "2026-05-12 10:45" }
  ];
  const documents = [
    { id: `${product.id}-DOC-1`, name: `${product.name} product spec`, type: "Spec", description: "Catalog definition and service parameters", uploadedBy: "Product Ops", uploadDate: "2026-05-08" },
    { id: `${product.id}-DOC-2`, name: `${product.code} pricing guide`, type: "Pricing guide", description: "MRC, NRC, approval thresholds", uploadedBy: "Pricing Ops", uploadDate: "2026-05-10" },
    { id: `${product.id}-DOC-3`, name: `${product.name} playbook`, type: "Sales playbook", description: "Attach rate, segment guidance, promos", uploadedBy: "Commercial Ops", uploadDate: "2026-05-12" }
  ];
  const performanceBars = [
    { label: "Revenue trend", value: 82, tone: "success" },
    { label: "Quote volume", value: 71, tone: "blue" },
    { label: "Win/loss trend", value: 63, tone: "warn" },
    { label: "Churn impact", value: 48, tone: "warn" }
  ];

  return (
    <>
      <RecordHeader
        breadcrumb={["Product & Pricing", "Catalog", product.code]}
        title={product.name}
        status={product.status}
        subtitle={`${product.code} · Product manager ${product.productManager} · Pricing manager ${product.pricingManager}`}
        meta={
          <div className="record-meta-chips">
            <StatusTag tone={product.lifecycle === "Growth" ? "success" : product.lifecycle === "Launch" ? "blue" : "warn"}>{product.lifecycle}</StatusTag>
            <StatusTag tone={product.healthBand === "Healthy" ? "success" : product.healthBand === "Watch" ? "blue" : "warn"}>{product.healthBand}</StatusTag>
            <StatusTag tone="blue">{product.owner}</StatusTag>
            <StatusTag tone="blue">Created {product.createdDate}</StatusTag>
            <StatusTag tone="blue">Updated {product.lastUpdated}</StatusTag>
          </div>
        }
        actions={<><ActionButton icon="workflow" onClick={() => showToast("Actions menu opened")}>Actions</ActionButton><ActionButton icon="products" variant="button" onClick={() => setEditModal(true)}>Edit Product</ActionButton></>}
      />
      <Tabs tabs={["Overview", "Billing Elements", "Pricing", "Promos", "Offers", "Costs", "Coefficients", "Performance", "History", "Documents"]} active={tab} onChange={setTab} />
      {tab === "Overview" && (
        <section className="record-main-layout">
          <Panel title="Product overview" description="Executive and operational summary of the telecom product.">
            <div className="field-grid">
              <MiniStat label="Description" value={product.name} note={`${product.category} · ${product.subCategory}`} />
              <MiniStat label="Contract Types" value={product.contractTypes.join(" / ")} note={product.provisioningType} />
              <MiniStat label="Dependencies" value={product.dependencies.length} note={product.dependencies.join(", ")} />
              <MiniStat label="Availability" value={product.availability} note="Serviceability and market reach" />
              <MiniStat label="Tags" value={product.tags.slice(0, 2).join(" · ")} note={product.tags.slice(2).join(" · ")} />
              <MiniStat label="Status" value={product.status} note={product.healthBand} />
            </div>
            <p className="small-muted">Operational telecom service definition with billing, pricing, eligibility, and provisioning context. This record drives product packaging, quote governance, and service turn-up.</p>
            <div className="table-block">
              <div className="panel-inline-title">Top billing elements</div>
              <DataTable
                columns={[
                  { key: "code", label: "Billing Code" },
                  { key: "description", label: "Description" },
                  { key: "type", label: "Type" },
                  { key: "feature", label: "Feature" },
                  { key: "mrc", label: "MRC", render: row => formatMoney(row.mrc) },
                  { key: "nrc", label: "NRC", render: row => formatMoney(row.nrc) }
                ]}
                rows={billingElements}
              />
            </div>
          </Panel>
          <section className="side-stack">
            <Panel title="Lifecycle & health" description="Product governance and commercial performance.">
              <div className="field-grid compact-fields">
                <MiniStat label="Total Quotes" value={product.totalQuotes} />
                <MiniStat label="Win Rate" value={`${product.winRate}%`} />
                <MiniStat label="Revenue from Wins" value={formatMoney(product.revenueFromWins)} />
                <MiniStat label="Gross Margin" value={`${product.grossMargin}%`} />
              </div>
            </Panel>
            <Panel title="Related items" description="Billing, pricing, and commercial artifacts linked to this product.">
              <div className="list">
                <div className="list-item"><div><div className="title">Billing codes</div><div className="subtitle">{product.billingCodes.join(", ")}</div></div><StatusTag tone="blue">3</StatusTag></div>
                <div className="list-item"><div><div className="title">Promos</div><div className="subtitle">{product.promoCodes.join(", ")}</div></div><StatusTag tone="success">2</StatusTag></div>
                <div className="list-item"><div><div className="title">Offers</div><div className="subtitle">{product.offerBundles.join(", ")}</div></div><StatusTag tone="blue">2</StatusTag></div>
                <div className="list-item"><div><div className="title">Dependencies</div><div className="subtitle">{product.dependencies.join(", ")}</div></div><StatusTag tone="warn">{product.dependencies.length}</StatusTag></div>
              </div>
            </Panel>
          </section>
        </section>
      )}
      {tab === "Billing Elements" && (
        <section className="record-main-layout">
          <Panel
            title="Billing element management"
            description="Telecom billing code management, effective dates, structure hierarchy, and change control."
            action={<div className="module-toolbar"><ActionButton icon="reports" onClick={() => showToast("Billing elements exported")}>Export</ActionButton><ActionButton icon="products" variant="button" onClick={() => showToast("Billing element added")}>Add Billing Element</ActionButton></div>}
          >
            <DataTable
              columns={[
                { key: "code", label: "Billing Code" },
                { key: "description", label: "Description" },
                { key: "type", label: "Type" },
                { key: "feature", label: "Feature" },
                { key: "mrc", label: "MRC", render: row => formatMoney(row.mrc) },
                { key: "nrc", label: "NRC", render: row => formatMoney(row.nrc) },
                { key: "contractType", label: "Contract Type" },
                { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Active" ? "success" : "warn"}>{row.status}</StatusTag> },
                { key: "actions", label: "Actions", render: row => <button className="link-button compact-action" type="button" onClick={() => showToast(`Billing element ${row.code} opened`)}>Review</button> }
              ]}
              rows={billingElements}
            />
          </Panel>
          <section className="side-stack">
            <Panel title="Billing element details" description="Selected charge mapping and contract applicability.">
              <div className="field-grid compact-fields">
                <MiniStat label="Tax Mapping" value="Telecom + regulatory" />
                <MiniStat label="Surcharge Mapping" value="State / local" />
                <MiniStat label="Previous Pricing" value={formatMoney(Math.round(product.defaultMrc * 0.92))} />
                <MiniStat label="Change Reason" value="Lifecycle refresh" />
              </div>
            </Panel>
            <Panel title="Effective dates" description="Pricing history and activation windows.">
              <DataTable columns={[{ key: "code", label: "Code" }, { key: "effective", label: "Effective Date" }, { key: "reason", label: "Reason" }]} rows={billingElements.map(item => ({ id: item.code, ...item }))} />
            </Panel>
            <Panel title="Bill structure" description="Billing hierarchy and audit trail.">
              <div className="list">
                <div className="list-item"><div><div className="title">Recurring service</div><div className="subtitle">Monthly recurring charge</div></div></div>
                <div className="list-item"><div><div className="title">One-time install</div><div className="subtitle">Provisioning and activation</div></div></div>
                <div className="list-item"><div><div className="title">Credits / discounts</div><div className="subtitle">Approval governed adjustments</div></div></div>
              </div>
            </Panel>
          </section>
        </section>
      )}
      {tab === "Pricing" && (
        <section className="record-main-layout">
          <Panel
            title="Pricing governance"
            description="Price list management, pricing rules, regional pricing, contract tiers, and exceptions."
            action={<div className="module-toolbar"><ActionButton icon="pricing" variant="button" onClick={() => showToast("Pricing added")}>Add Pricing</ActionButton><ActionButton icon="reports" onClick={() => showToast("Pricing export prepared")}>Export</ActionButton><ActionButton icon="reports" onClick={() => showToast("Pricing import started")}>Import</ActionButton></div>}
          >
            <DataTable columns={[{ key: "name", label: "Price List" }, { key: "segment", label: "Segment" }, { key: "term", label: "Term" }, { key: "price", label: "Price" }, { key: "margin", label: "Margin" }]} rows={contractTiers.map(item => ({ id: item.id, name: `${product.category} ${item.segment}`, segment: item.segment, term: item.term, price: item.price, margin: item.margin }))} />
            <div className="table-block">
              <div className="panel-inline-title">Pricing rules</div>
              <DataTable columns={[{ key: "name", label: "Rule" }, { key: "type", label: "Type" }, { key: "precedence", label: "Precedence" }, { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Active" ? "success" : "blue"}>{row.status}</StatusTag> }]} rows={priceRules} />
            </div>
          </Panel>
          <section className="side-stack">
            <Panel title="Pricing summary" description="Control point for margin and approval analysis.">
              <div className="field-grid compact-fields">
                <MiniStat label="Default MRC" value={formatMoney(product.defaultMrc)} />
                <MiniStat label="Default NRC" value={formatMoney(product.defaultNrc)} />
                <MiniStat label="Minimum Margin" value={`${product.minMargin}%`} />
                <MiniStat label="Discount Limit" value={product.discountLimit} />
              </div>
            </Panel>
            <Panel title="Margin simulator" description="Strategic pricing and waterfall preview.">
              <div className="list">
                {[
                  ["Base MRC", formatMoney(product.defaultMrc)],
                  ["Regional uplift", formatMoney(Math.round(product.defaultMrc * 0.08))],
                  ["Discount allowance", formatMoney(-Math.round(product.defaultMrc * 0.06))],
                  ["Floor price", formatMoney(Math.round(product.defaultMrc * 0.88))]
                ].map(([label, value]) => <div className="list-item" key={label}><div><div className="title">{label}</div></div><strong>{value}</strong></div>)}
              </div>
            </Panel>
            <Panel title="Pricing exceptions" description="Approval thresholds and guardrail breaches.">
              <TimelineList items={[{ date: "May 10, 2026", title: "Regional exception", body: "West Coast constrained market uplift", status: "Approval", tone: "warn" }, { date: "May 12, 2026", title: "Discount exception", body: "Enterprise renewal above standard guardrail", status: "Pending", tone: "blue" }]} />
            </Panel>
          </section>
        </section>
      )}
      {tab === "Promos" && (
        <>
          <SummaryStrip items={[
            { label: "Redemptions", value: sum(activePromos, item => item.redemptions), note: "Tracked promo usage" },
            { label: "Revenue Impact", value: formatMoney(41000), note: "Incremental lift" },
            { label: "Active Markets", value: 4, note: "Targeted markets" }
          ]} />
          <section className="record-main-layout">
            <Panel title="Promo list" description="Active, upcoming, and expired promotions with eligibility and stacking control.">
              <DataTable columns={[{ key: "promoCode", label: "Promo Code" }, { key: "discount", label: "Discount %" }, { key: "start", label: "Start Date" }, { key: "end", label: "End Date" }, { key: "segments", label: "Segments" }, { key: "minTerm", label: "Min Term" }, { key: "stackable", label: "Stackable" }, { key: "redemptions", label: "Redemptions" }, { key: "revenueImpact", label: "Revenue Impact" }, { key: "markets", label: "Active Markets" }]} rows={activePromos} />
            </Panel>
            <section className="side-stack">
              <Panel title="Eligibility criteria" description="Who can receive the promotion.">
                <DataTable columns={[{ key: "segment", label: "Segment" }, { key: "term", label: "Term" }, { key: "stackable", label: "Stackable" }]} rows={activePromos.map(item => ({ id: `${item.id}-elig`, segment: item.segments, term: item.minTerm, stackable: item.stackable }))} />
              </Panel>
              <Panel title="Promo performance" description="Redemption and revenue impact by market.">
                <div className="list">
                  <div className="list-item"><div><div className="title">Active promos</div><div className="subtitle">{activePromos.length}</div></div><strong>{sum(activePromos, item => item.redemptions)}</strong></div>
                  <div className="list-item"><div><div className="title">Upcoming promos</div><div className="subtitle">Seasonal launches queued</div></div><StatusTag tone="blue">2</StatusTag></div>
                  <div className="list-item"><div><div className="title">Expired promos</div><div className="subtitle">Archived for audit</div></div><StatusTag tone="warn">1</StatusTag></div>
                </div>
              </Panel>
            </section>
          </section>
        </>
      )}
      {tab === "Offers" && (
        <>
          <SummaryStrip items={[
            { label: "Attach Rate", value: "42%", note: "Primary bundle" },
            { label: "Win Rate", value: `${product.winRate}%`, note: "Quoted offers" },
            { label: "Quote Usage", value: "122 quotes", note: "Offer usage" }
          ]} />
          <section className="record-main-layout">
            <Panel title="Offer bundles" description="Sales packaging and bundling workspace.">
              <DataTable columns={[{ key: "name", label: "Offer" }, { key: "components", label: "Included Products" }, { key: "attachRate", label: "Attach Rate" }, { key: "quoteUsage", label: "Quote Usage" }, { key: "winRate", label: "Win Rate" }, { key: "segment", label: "Segment" }]} rows={offerRows} />
            </Panel>
            <section className="side-stack">
              <Panel title="Offer components" description="What is attached when the offer is sold.">
                <div className="list">
                  {product.dependencies.map(dep => <div className="list-item" key={dep}><div><div className="title">{dep}</div><div className="subtitle">Included product / add-on</div></div><StatusTag tone="blue">Required</StatusTag></div>)}
                </div>
              </Panel>
              <Panel title="Offer performance" description="Attach rate, segment targeting, and commercial lift.">
                <div className="field-grid compact-fields">
                  <MiniStat label="Quote Usage" value="122" />
                  <MiniStat label="Attach Rate" value="42%" />
                  <MiniStat label="Segment Targeting" value="Enterprise, SMB" />
                  <MiniStat label="Win Rate" value={`${product.winRate}%`} />
                </div>
              </Panel>
            </section>
          </section>
        </>
      )}
      {tab === "Costs" && (
        <section className="record-main-layout">
          <Panel title="Cost components" description="Operational and vendor costing with margin impact.">
            <DataTable columns={[{ key: "label", label: "Cost Component" }, { key: "vendor", label: "Vendor Mapping" }, { key: "amount", label: "Cost", render: row => formatMoney(row.amount) }, { key: "history", label: "History" }, { key: "impact", label: "Margin Impact" }]} rows={costRows} />
          </Panel>
          <section className="side-stack">
            <Panel title="Cost breakdown" description="Transport, equipment, install, and support mix.">
              <div className="list">
                {costRows.map(item => <div className="list-item" key={item.id}><div><div className="title">{item.label}</div><div className="subtitle">{item.vendor}</div></div><strong>{formatMoney(item.amount)}</strong></div>)}
              </div>
            </Panel>
            <Panel title="Margin impact" description="How costs shape product economics.">
              <div className="field-grid compact-fields">
                <MiniStat label="Current Margin" value={`${product.grossMargin}%`} />
                <MiniStat label="Cost Basis" value={formatMoney(product.cost)} />
                <MiniStat label="Target Margin" value={`${product.minMargin}%`} />
                <MiniStat label="Economics" value="Within policy" />
              </div>
            </Panel>
          </section>
        </section>
      )}
      {tab === "Coefficients" && (
        <section className="record-main-layout">
          <Panel
            title="Coefficient list"
            description="Rules engine controls, overrides, and impact preview."
            action={<div className="module-toolbar"><ActionButton icon="pricing" variant="button" onClick={() => showToast("Coefficient added")}>Add Coefficient</ActionButton><ActionButton icon="workflow" onClick={() => showToast("Coefficient simulation ran")}>Run Simulation</ActionButton></div>}
          >
            <DataTable columns={[{ key: "name", label: "Coefficient Name" }, { key: "type", label: "Type" }, { key: "value", label: "Value" }, { key: "appliesTo", label: "Applies To" }, { key: "effectiveDate", label: "Effective Date" }, { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Active" ? "success" : "warn"}>{row.status}</StatusTag> }]} rows={coefficientRows} />
          </Panel>
          <section className="side-stack">
            <Panel title="Coefficient details" description="Rule precedence and override context.">
              <div className="field-grid compact-fields">
                <MiniStat label="Rule precedence" value="1 > 2 > 3" />
                <MiniStat label="Overrides" value="Approval only" />
                <MiniStat label="Simulation" value="Enabled" />
                <MiniStat label="Status" value="Governed" />
              </div>
            </Panel>
            <Panel title="Formula / logic" description="Impact preview and calculation logic.">
              <div className="list">
                <div className="list-item"><div><div className="title">Market pressure</div><div className="subtitle">Regional demand uplift</div></div><strong>+2.1%</strong></div>
                <div className="list-item"><div><div className="title">Term uplift</div><div className="subtitle">Longer commitments</div></div><strong>-0.6%</strong></div>
                <div className="list-item"><div><div className="title">Install density</div><div className="subtitle">Network complexity</div></div><strong>+1.4%</strong></div>
              </div>
            </Panel>
          </section>
        </section>
      )}
      {tab === "Performance" && (
        <section className="record-main-layout">
          <Panel title="Performance trend" description="Revenue, quote volume, and win/loss trends by product.">
            <div className="list">
              {performanceBars.map(bar => (
                <div className="list-item" key={bar.label}>
                  <div style={{ width: "100%" }}>
                    <div className="title">{bar.label}</div>
                    <div className="product-bar"><span className={`product-bar-fill ${bar.tone}`} style={{ width: `${bar.value}%` }} /></div>
                  </div>
                  <strong>{bar.value}%</strong>
                </div>
              ))}
            </div>
          </Panel>
          <section className="side-stack">
            <Panel title="Revenue by segment" description="Executive product analytics view.">
              <DataTable columns={[{ key: "segment", label: "Segment" }, { key: "revenue", label: "Revenue", render: row => formatMoney(row.revenue) }, { key: "margin", label: "Margin" }]} rows={[{ id: "seg-1", segment: "Enterprise", revenue: Math.round(product.revenueFromWins * 0.61), margin: `${product.grossMargin}%` }, { id: "seg-2", segment: "SMB", revenue: Math.round(product.revenueFromWins * 0.24), margin: `${Math.max(product.grossMargin - 4, 20)}%` }, { id: "seg-3", segment: "Wholesale", revenue: Math.round(product.revenueFromWins * 0.15), margin: `${Math.max(product.grossMargin - 7, 18)}%` }]} />
            </Panel>
            <Panel title="Regional performance" description="Top regions and win/loss analysis.">
              <DataTable columns={[{ key: "region", label: "Region" }, { key: "quoteVolume", label: "Quote Volume" }, { key: "winLoss", label: "Win/Loss" }]} rows={[{ id: "reg-1", region: "Midwest", quoteVolume: 48, winLoss: "31 / 17" }, { id: "reg-2", region: "Southeast", quoteVolume: 41, winLoss: "24 / 17" }, { id: "reg-3", region: "West Coast", quoteVolume: 35, winLoss: "21 / 14" }]} />
            </Panel>
          </section>
        </section>
      )}
      {tab === "History" && (
        <section className="record-main-layout">
          <Panel title="Change history" description="Field-level audit trail and version tracking.">
            <DataTable columns={[{ key: "user", label: "User" }, { key: "action", label: "Action" }, { key: "field", label: "Field Changed" }, { key: "oldValue", label: "Old Value" }, { key: "newValue", label: "New Value" }, { key: "timestamp", label: "Timestamp" }]} rows={historyRows} />
          </Panel>
          <section className="side-stack">
            <Panel title="Version history" description="Rollback and release control.">
              <div className="list">
                <div className="list-item"><div><div className="title">Version 3</div><div className="subtitle">Current approved record</div></div><StatusTag tone="success">Current</StatusTag></div>
                <div className="list-item"><div><div className="title">Version 2</div><div className="subtitle">Pricing guardrail update</div></div><StatusTag tone="blue">Prior</StatusTag></div>
                <div className="list-item"><div><div className="title">Version 1</div><div className="subtitle">Original launch definition</div></div><StatusTag tone="blue">Initial</StatusTag></div>
              </div>
            </Panel>
            <Panel title="Rollback" description="Controlled rollback and version recovery.">
              <div className="button-cluster">
                <button className="button" type="button" onClick={() => showToast("Rollback workflow opened")}>Rollback</button>
                <button className="ghost-button" type="button" onClick={() => showToast("Version comparison opened")}>Compare versions</button>
              </div>
            </Panel>
          </section>
        </section>
      )}
      {tab === "Documents" && (
        <section className="record-main-layout">
          <Panel
            title="Document repository"
            description="Pricing guides, technical documentation, contracts, product specs, and sales playbooks."
            action={<div className="module-toolbar"><ActionButton icon="reports" variant="button" onClick={() => showToast("Upload document workflow opened")}>Upload</ActionButton><ActionButton icon="reports" onClick={() => showToast("Document download started")}>Download</ActionButton></div>}
          >
            <DataTable columns={[{ key: "name", label: "Document Name" }, { key: "type", label: "Type" }, { key: "description", label: "Description" }, { key: "uploadedBy", label: "Uploaded By" }, { key: "uploadDate", label: "Upload Date" }, { key: "view", label: "Action", render: row => <button className="link-button compact-action" type="button" onClick={() => showToast(`Opened ${row.name}`)}>View</button> }]} rows={documents} />
          </Panel>
          <section className="side-stack">
            <Panel title="Repository notes" description="What belongs in the product library.">
              <div className="list">
                <div className="list-item"><div><div className="title">Pricing guides</div><div className="subtitle">MRC, NRC, approval thresholds</div></div></div>
                <div className="list-item"><div><div className="title">Technical docs</div><div className="subtitle">Eligibility, provisioning, dependencies</div></div></div>
                <div className="list-item"><div><div className="title">Contracts</div><div className="subtitle">MSA, order form, term commitments</div></div></div>
              </div>
            </Panel>
          </section>
        </section>
      )}
      {editModal && (
        <Modal
          title="Edit Product"
          onClose={() => setEditModal(false)}
          actions={
            <>
              <button className="button" type="button" onClick={() => { setEditModal(false); showToast("Product updated"); }}>Save</button>
              <button className="ghost-button" type="button" onClick={() => setEditModal(false)}>Cancel</button>
            </>
          }
        >
          <form className="modal-form">
            <label>Product Name<input defaultValue={product.name} /></label>
            <label>Category<select defaultValue={product.category}>{productCategories.map(category => <option key={category}>{category}</option>)}</select></label>
            <label>Lifecycle<select defaultValue={product.lifecycle}><option>Launch</option><option>Growth</option><option>Mature</option><option>Refresh</option><option>Retire</option></select></label>
            <label>Owner<select defaultValue={product.owner}>{owners.map(owner => <option key={owner}>{owner}</option>)}</select></label>
            <label>Billing Type<select defaultValue={product.billingType}><option>Monthly</option><option>Usage + Monthly</option><option>One-time</option></select></label>
            <label>Availability<input defaultValue={product.availability} /></label>
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
        actions={<><ActionButton icon="opportunities" variant="button" onClick={() => setRoute("sales")}>New Opportunity</ActionButton><ActionButton icon="pricing" onClick={() => setRoute("sales")}>Create Quote</ActionButton><ActionButton icon="orders" onClick={() => setRoute("orders")}>Create Order</ActionButton><ActionButton icon="serviceDesk" onClick={() => showToast("Ticket workflow opened")}>Create Ticket</ActionButton><ActionButton icon="billing" onClick={() => setRoute(`details/billing-account/${customer.id}`)}>View Billing</ActionButton></>}
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

function pdfEscape(value) {
  return String(value ?? "").replace(/[()\\]/g, "");
}

function makeInvoicePdfBlob(invoice) {
  const invoiceNumber = displayInvoiceNumber(invoice);
  const previousBalance = Math.round(invoice.amount * 0.42);
  const currentCharges = invoice.recurring + invoice.usageAmount + invoice.oneTime;
  const commands = [];
  const text = (value, x, y, size = 9, font = "F1", color = "0.06 0.09 0.16") => {
    commands.push(`${color} rg BT /${font} ${size} Tf ${x} ${y} Td (${pdfEscape(value)}) Tj ET`);
  };
  const line = (x1, y1, x2, y2, color = "0.82 0.86 0.9", width = 0.75) => {
    commands.push(`${color} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
  };
  const rect = (x, y, w, h, color = "1 1 1", mode = "f") => {
    commands.push(`${color} rg ${x} ${y} ${w} ${h} re ${mode}`);
  };
  const strokedRect = (x, y, w, h, color = "0.82 0.86 0.9", width = 0.75) => {
    commands.push(`${color} RG ${width} w ${x} ${y} ${w} ${h} re S`);
  };
  const labelValue = (label, value, x, y, valueColor = "0.06 0.09 0.16") => {
    text(label.toUpperCase(), x, y + 14, 7, "F2", "0.42 0.48 0.57");
    text(value, x, y, 10, "F2", valueColor);
  };
  const sectionTitle = (title, x, y) => {
    text(title, x, y, 11, "F2");
    line(x, y - 6, x + 510, y - 6, "0.08 0.45 0.42", 1.2);
  };
  const table = (headers, rows, x, y, widths) => {
    const rowHeight = 22;
    rect(x, y - rowHeight + 5, widths.reduce((a, b) => a + b, 0), rowHeight, "0.95 0.97 0.98");
    let left = x;
    headers.forEach((header, index) => {
      text(header.toUpperCase(), left + 5, y - 10, 6.5, "F2", "0.34 0.39 0.47");
      line(left, y + 5, left, y - rowHeight + 5);
      left += widths[index];
    });
    line(x, y + 5, x + widths.reduce((a, b) => a + b, 0), y + 5);
    line(x, y - rowHeight + 5, x + widths.reduce((a, b) => a + b, 0), y - rowHeight + 5);
    rows.forEach((row, rowIndex) => {
      const rowTop = y - rowHeight * (rowIndex + 1) + 5;
      let cellX = x;
      row.forEach((cell, index) => {
        text(cell, cellX + 5, rowTop - 15, 7.5, index === row.length - 1 ? "F2" : "F1");
        line(cellX, rowTop, cellX, rowTop - rowHeight);
        cellX += widths[index];
      });
      line(x, rowTop - rowHeight, x + widths.reduce((a, b) => a + b, 0), rowTop - rowHeight);
    });
    line(x + widths.reduce((a, b) => a + b, 0), y + 5, x + widths.reduce((a, b) => a + b, 0), y - rowHeight * (rows.length + 1) + 5);
  };

  rect(0, 0, 612, 792, "1 1 1");
  rect(36, 716, 540, 48, "0.04 0.09 0.18");
  text("NORTHSTAR TELECOM", 54, 744, 17, "F2", "1 1 1");
  text("Telecom Services Invoice", 54, 728, 8, "F1", "0.77 0.84 0.92");
  text(invoiceNumber, 420, 744, 14, "F2", "1 1 1");
  text(invoice.status, 420, 728, 8, "F2", invoice.status === "Past Due" ? "0.95 0.35 0.30" : "0.20 0.78 0.56");
  rect(36, 676, 540, 28, "0.95 0.98 0.98");
  labelValue("Invoice Date", invoice.invoiceDate, 54, 684);
  labelValue("Due Date", invoice.due, 150, 684);
  labelValue("Billing Account", invoice.billingAccount, 246, 684);
  labelValue("Customer Account", invoice.accountNumber, 366, 684);
  labelValue("Balance Due", formatMoney(invoice.balance), 486, 684, invoice.balance > 0 ? "0.86 0.15 0.15" : "0.02 0.48 0.34");
  strokedRect(36, 676, 540, 28);

  sectionTitle("Bill To", 54, 648);
  text(invoice.customer, 54, 628, 11, "F2");
  invoice.billingAddress.split("\n").forEach((part, index) => text(part, 54, 614 - index * 12, 8));
  text(`Contact: ${invoice.contact}`, 54, 578, 8);

  sectionTitle("Account Summary", 306, 648);
  labelValue("Previous Balance", formatMoney(previousBalance), 306, 625);
  labelValue("Payments Received", formatMoney(invoice.paid), 430, 625, "0.02 0.48 0.34");
  labelValue("Adjustments", formatMoney(invoice.discounts), 306, 590, "0.02 0.48 0.34");
  labelValue("Total Amount Due", formatMoney(invoice.balance), 430, 590, invoice.balance > 0 ? "0.86 0.15 0.15" : "0.02 0.48 0.34");

  sectionTitle("Charge Summary", 54, 542);
  const chargeRows = [
    ["Recurring services", formatMoney(invoice.recurring), "Usage charges", formatMoney(invoice.usageAmount)],
    ["One-time charges", formatMoney(invoice.oneTime), "Discounts", formatMoney(invoice.discounts)],
    ["Taxes and regulatory fees", formatMoney(invoice.taxes), "Current charges", formatMoney(currentCharges)]
  ];
  chargeRows.forEach((row, index) => {
    const y = 517 - index * 24;
    text(row[0], 54, y, 8);
    text(row[1], 202, y, 8, "F2");
    text(row[2], 306, y, 8);
    text(row[3], 488, y, 8, "F2", row[2] === "Discounts" ? "0.02 0.48 0.34" : "0.06 0.09 0.16");
    line(54, y - 8, 558, y - 8);
  });

  sectionTitle("Service Detail", 54, 448);
  table(
    ["Service ID", "Product", "Period", "MRC", "NRC", "Usage", "Taxes", "Total"],
    invoice.serviceRows.map(row => [row.serviceId, row.product.slice(0, 18), row.period.replace(", 2026", ""), formatMoney(row.mrc), formatMoney(row.nrc), formatMoney(row.usage), formatMoney(row.taxes), formatMoney(row.total)]),
    54,
    426,
    [70, 92, 78, 58, 56, 58, 58, 64]
  );

  sectionTitle("Taxes and Surcharges", 54, 306);
  table(
    ["Category", "Basis", "Amount"],
    [
      ["Telecom regulatory fees", "Recurring + usage", formatMoney(Math.round(invoice.taxes * 0.48))],
      ["State and local taxes", "Service location", formatMoney(Math.round(invoice.taxes * 0.37))],
      ["911 / recovery surcharge", "Voice and access lines", formatMoney(invoice.taxes - Math.round(invoice.taxes * 0.48) - Math.round(invoice.taxes * 0.37))]
    ],
    54,
    284,
    [190, 190, 154]
  );

  sectionTitle("Payment Instructions", 54, 166);
  text("Remit To: Northstar Telecom, PO Box 12545, Dallas, TX 75201", 54, 144, 8);
  text("Payment Terms: Net 30    Online payment: billing.northstar.example", 54, 130, 8);
  text("Include invoice number and billing account on all remittances.", 54, 116, 8);

  rect(36, 52, 540, 34, "0.96 0.97 0.98");
  text("Support: billing@northstar.example | 1-800-555-0199", 54, 72, 7.5, "F2", "0.28 0.33 0.40");
  text("Disputes must be submitted within 30 days with invoice number, service ID, and adjustment reason. Page 1", 54, 60, 7, "F1", "0.40 0.45 0.52");
  strokedRect(36, 52, 540, 34);

  const stream = commands.join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >> endobj",
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    "6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj"
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
      <RecordHeader breadcrumb={["Sales", "Custom Pricing", quote.id]} title={`Quote: ${quote.id}`} status={quote.status === "Approval" ? "Approval Required" : quote.status} subtitle={`${quote.account} · ${quote.opportunityName} · Quote Date ${quote.quoteDate} · Expiration ${quote.expiration} · TCV ${formatMoney(quote.tcv)}`} actions={<><ActionButton icon="pricing" onClick={() => showToast("Quote cloned")}>Clone</ActionButton><ActionButton icon="workflow" onClick={() => showToast("Quote sent")}>Send</ActionButton><ActionButton icon="workflow" variant="button" onClick={() => showToast("Quote submitted for approval")}>Submit Approval</ActionButton><ActionButton icon="reports" onClick={() => showToast("Quote PDF exported")}>Export PDF</ActionButton><ActionButton icon="orders" onClick={() => setRoute("orders")}>Convert to Order</ActionButton></>} />
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
  return <ProductPricingDetail id={id} setRoute={setRoute} showToast={showToast} />;
}

function displayInvoiceNumber(invoice) {
  const numeric = String(invoice.id).replace(/\D/g, "").padStart(6, "0");
  return `INV-2025-${numeric}`;
}

function invoiceAgingRows(invoice) {
  return [
    { id: "0-30", bucket: "0-30", amount: invoice.aging <= 30 ? invoice.balance : 0 },
    { id: "31-60", bucket: "31-60", amount: invoice.aging > 30 && invoice.aging <= 60 ? invoice.balance : 0 },
    { id: "61-90", bucket: "61-90", amount: invoice.aging > 60 && invoice.aging <= 90 ? invoice.balance : 0 },
    { id: "90+", bucket: "90+", amount: invoice.aging > 90 ? invoice.balance : 0 }
  ];
}

function paymentRowsFor(invoice) {
  return invoice.paid > 0 ? [
    { id: `PMT-${invoice.id.slice(-4)}-01`, date: "2026-05-14", method: "ACH", amount: invoice.paid, status: "Posted", reference: `ACH-${invoice.billingAccount.slice(-4)}-0514` }
  ] : [
    { id: `PMT-${invoice.id.slice(-4)}-01`, date: "Pending", method: "ACH", amount: 0, status: "Not received", reference: "None" }
  ];
}

function usageRowsForInvoice(invoice) {
  return invoice.serviceRows.map((row, index) => ({
    id: `USG-${row.id}`,
    usageType: index % 2 ? "Voice minutes" : "Data transfer",
    serviceId: row.serviceId,
    location: `${100 + index * 22} Network Plaza, ${invoice.customer}`,
    dateRange: "May 1-31, 2026",
    quantity: index % 2 ? 4820 : 32.4,
    unit: index % 2 ? "Minutes" : "TB",
    rated: row.usage
  }));
}

function InvoicePdfPreview({ invoice }) {
  const invoiceNumber = displayInvoiceNumber(invoice);
  return (
    <section className="invoice-pdf-preview" aria-label="Printable invoice preview">
      <div className="pdf-brand-bar">
        <div>
          <strong>Northstar Telecom</strong>
          <span>Telecom services invoice</span>
        </div>
        <div className="pdf-meta">
          <span>Invoice #</span>
          <strong>{invoiceNumber}</strong>
        </div>
      </div>
      <div className="pdf-section-grid">
        <div>
          <h4>Invoice Metadata</h4>
          <p>Invoice Date: {invoice.invoiceDate}</p>
          <p>Due Date: {invoice.due}</p>
          <p>Billing Account: {invoice.billingAccount}</p>
          <p>Customer Account: {invoice.accountNumber}</p>
          <p>Status: {invoice.status}</p>
        </div>
        <div>
          <h4>Bill To</h4>
          <p>{invoice.customer}</p>
          <p>{invoice.billingAddress.split("\n").join(", ")}</p>
          <p>Contact: {invoice.contact}</p>
        </div>
      </div>
      <div className="pdf-section-grid three">
        <div>
          <h4>Account Summary</h4>
          <p>Previous Balance <b>{formatMoney(Math.round(invoice.amount * 0.42))}</b></p>
          <p>Payments Received <b className="credit">{formatMoney(invoice.paid)}</b></p>
          <p>Adjustments <b className="credit">{formatMoney(invoice.discounts)}</b></p>
          <p>Total Amount Due <b className={invoice.balance > 0 ? "due" : "credit"}>{formatMoney(invoice.balance)}</b></p>
        </div>
        <div>
          <h4>Charge Summary</h4>
          <p>Recurring Services <b>{formatMoney(invoice.recurring)}</b></p>
          <p>Usage Charges <b>{formatMoney(invoice.usageAmount)}</b></p>
          <p>One-Time Charges <b>{formatMoney(invoice.oneTime)}</b></p>
          <p>Taxes and Fees <b>{formatMoney(invoice.taxes)}</b></p>
        </div>
        <div>
          <h4>Payment Instructions</h4>
          <p>Terms: Net 30</p>
          <p>Remit To: Northstar Telecom</p>
          <p>PO Box 12545, Dallas, TX 75201</p>
          <p>Pay online at billing.northstar.example</p>
        </div>
      </div>
      <div className="pdf-table-block">
        <h4>Service Detail</h4>
        <table>
          <thead><tr><th>Service ID</th><th>Product</th><th>Billing Period</th><th>MRC</th><th>NRC</th><th>Usage</th><th>Taxes</th><th>Total</th></tr></thead>
          <tbody>
            {invoice.serviceRows.map(row => (
              <tr key={row.id}><td>{row.serviceId}</td><td>{row.product}</td><td>{row.period}</td><td>{formatMoney(row.mrc)}</td><td>{formatMoney(row.nrc)}</td><td>{formatMoney(row.usage)}</td><td>{formatMoney(row.taxes)}</td><td>{formatMoney(row.total)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pdf-footer">Support: billing@northstar.example / 1-800-555-0199. Disputes must be submitted within 30 days with invoice number, service ID, and reason.</div>
    </section>
  );
}

function InvoiceDetail({ id, setRoute, showToast }) {
  const invoice = enrichedInvoice(invoices.find(item => item.id === id) || invoices[0]);
  const invoiceNumber = displayInvoiceNumber(invoice);
  const [tab, setTab] = useState("Summary");
  const adjustmentRows = adjustments.filter(item => item.customerId === invoice.customerId);
  const agingRows = invoiceAgingRows(invoice);
  function exportInvoicePdf() {
    downloadBlob(makeInvoicePdfBlob(invoice), `${invoiceNumber}.pdf`);
    showToast("Invoice PDF exported");
  }
  return (
    <>
      <RecordHeader
        breadcrumb={["Billing", "Invoices", invoiceNumber]}
        title={`Invoice ${invoiceNumber}`}
        status={invoice.status}
        subtitle={`${invoice.customer} · ${invoice.billingAccount}`}
        actions={<><ActionButton icon="workflow" onClick={() => showToast("Invoice sent")}>Send</ActionButton><ActionButton icon="reports" variant="button" onClick={exportInvoicePdf}>Export PDF</ActionButton><ActionButton icon="billing" onClick={() => showToast("Payment entry opened")}>Record Payment</ActionButton><ActionButton icon="workflow" onClick={() => showToast("Adjustment workflow opened")}>Create Adjustment</ActionButton><ActionButton icon="workflow" onClick={() => showToast("Dispute opened")}>Dispute</ActionButton></>}
      />
      <SummaryStrip items={[
        { label: "Customer", value: invoice.customer, note: invoice.accountNumber },
        { label: "Billing Account", value: invoice.billingAccount, note: "Consolidated bill" },
        { label: "Invoice Date", value: invoice.invoiceDate, note: invoiceNumber },
        { label: "Due Date", value: invoice.due, note: "Net 30" },
        { label: "Total Amount", value: formatMoney(invoice.amount), note: "Invoice total" },
        { label: "Balance Due", value: formatMoney(invoice.balance), note: invoice.status },
        { label: "Aging Bucket", value: agingBucket(invoice), note: `${invoice.aging} days` }
      ]} />
      <Tabs tabs={["Summary", "Line Items", "Usage Detail", "Payments", "Adjustments", "Notes", "Documents"]} active={tab} onChange={setTab} />
      {tab === "Summary" && (
        <>
          <section className="invoice-summary-layout">
            <Panel title="Invoice Summary" description="Charge components, amount paid, and balance due.">
              <div className="invoice-kv-list">
                <span>Recurring Charges <b>{formatMoney(invoice.recurring)}</b></span>
                <span>Usage Charges <b>{formatMoney(invoice.usageAmount)}</b></span>
                <span>One-Time Charges <b>{formatMoney(invoice.oneTime)}</b></span>
                <span>Discounts <b className="credit">{formatMoney(invoice.discounts)}</b></span>
                <span>Taxes/Surcharges <b>{formatMoney(invoice.taxes)}</b></span>
                <span>Total <b>{formatMoney(invoice.amount)}</b></span>
                <span>Amount Paid <b className="credit">{formatMoney(invoice.paid)}</b></span>
                <span>Balance Due <b className={invoice.balance > 0 ? "due" : "credit"}>{formatMoney(invoice.balance)}</b></span>
              </div>
            </Panel>
            <Panel title="Aging" description="Receivables by aging bucket.">
              <DataTable columns={[{ key: "bucket", label: "Bucket" }, { key: "amount", label: "Amount", render: row => formatMoney(row.amount) }]} rows={agingRows} />
            </Panel>
            <Panel title="Payment Info" description="Terms, method, remit-to, and AutoPay profile.">
              <div className="invoice-kv-list">
                <span>Payment Terms <b>Net 30</b></span>
                <span>Payment Method <b>ACH</b></span>
                <span>Remit To <b>Northstar Telecom</b></span>
                <span>AutoPay <b>No</b></span>
              </div>
            </Panel>
          </section>
          <InvoicePdfPreview invoice={invoice} />
        </>
      )}
      {tab === "Line Items" && <Panel title="Line Items" description="Service-level charge detail."><DataTable columns={[{ key: "line", label: "Line #" }, { key: "serviceId", label: "Service ID" }, { key: "product", label: "Product" }, { key: "description", label: "Description" }, { key: "period", label: "Billing Period" }, { key: "quantity", label: "Qty" }, { key: "rate", label: "Rate", render: row => formatMoney(row.rate) }, { key: "mrc", label: "MRC", render: row => formatMoney(row.mrc) }, { key: "nrc", label: "NRC", render: row => formatMoney(row.nrc) }, { key: "usage", label: "Usage", render: row => formatMoney(row.usage) }, { key: "discount", label: "Discount", render: row => formatMoney(row.discount) }, { key: "taxes", label: "Taxes/Surcharges", render: row => formatMoney(row.taxes) }, { key: "total", label: "Total", render: row => formatMoney(row.total) }]} rows={invoice.serviceRows} /></Panel>}
      {tab === "Usage Detail" && <Panel title="Usage Detail" description="Rated usage by service and location."><DataTable columns={[{ key: "usageType", label: "Usage Type" }, { key: "serviceId", label: "Service ID" }, { key: "location", label: "Location" }, { key: "dateRange", label: "Date Range" }, { key: "quantity", label: "Quantity" }, { key: "unit", label: "Unit" }, { key: "rated", label: "Rated Amount", render: row => formatMoney(row.rated) }]} rows={usageRowsForInvoice(invoice)} /></Panel>}
      {tab === "Payments" && <Panel title="Payments" description="Payment records posted or pending against this invoice."><DataTable columns={[{ key: "id", label: "Payment ID" }, { key: "date", label: "Date" }, { key: "method", label: "Method" }, { key: "amount", label: "Amount", render: row => formatMoney(row.amount) }, { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Posted" ? "success" : "warn"}>{row.status}</StatusTag> }, { key: "reference", label: "Reference #" }]} rows={paymentRowsFor(invoice)} /></Panel>}
      {tab === "Adjustments" && <Panel title="Adjustments" description="Invoice credits, disputes, approvals, and adjustment reasons."><DataTable columns={[{ key: "id", label: "Adjustment ID" }, { key: "type", label: "Type" }, { key: "reason", label: "Reason", render: row => row.type }, { key: "amount", label: "Amount", render: row => formatMoney(row.amount) }, { key: "status", label: "Status" }, { key: "createdBy", label: "Created By", render: () => "Billing Ops" }, { key: "approvedBy", label: "Approved By", render: row => row.status === "Posted" ? "Finance" : "Pending" }, { key: "date", label: "Date", render: () => "2026-05-13" }]} rows={adjustmentRows} /></Panel>}
      {["Notes", "Documents"].includes(tab) && <Panel title={tab} description={`${tab} connected to ${invoiceNumber}.`}><DataTable columns={[{ key: "id", label: "Record" }, { key: "name", label: "Name" }, { key: "status", label: "Status" }]} rows={[{ id: `${tab}-1`, name: `${invoiceNumber} ${tab}`, status: "Active" }]} /></Panel>}
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
  if (type === "product" || type === "product-pricing") return <ProductPricingDetail id={id} setRoute={setRoute} showToast={showToast} />;
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
      {route === "product-pricing" && <ProductPricingModule setRoute={setRoute} showToast={showToast} />}
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
