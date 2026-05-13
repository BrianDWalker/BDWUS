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

function SalesModule({ setRoute }) {
  const [modal, setModal] = useState(false);
  const [filters, setFilters] = useState({ leads: "", opportunities: "", customers: "", quotes: "" });
  const filteredLeads = leads.filter(lead => matchAny(lead, filters.leads, [item => item.id, item => item.account]));
  const filteredOpps = opportunities.filter(opportunity => matchAny(opportunity, filters.opportunities, [item => item.id, item => item.name, item => customerName(item.customerId)]));
  const filteredCustomers = customers.filter(customer => matchAny(customer, filters.customers, [item => item.id, item => item.name]));
  const filteredQuotes = quotes.filter(quote => matchAny(quote, filters.quotes, [item => item.id, item => item.package, item => customerName(item.customerId)]));

  return (
    <>
      <PageHeader
        title="Sales"
        description="Leads, opportunities, quotes, and customer list in one commercial workspace."
        actions={<ToolbarButton icon="leads" variant="button" onClick={() => setModal(true)}>New lead</ToolbarButton>}
      />
      <section className="sales-board">
        <BoardColumn title="Leads" icon="leads" search={filters.leads} onSearch={value => setFilters({ ...filters, leads: value })}>
          {filteredLeads.map(lead => (
            <div className="pipeline-card" key={lead.id}>
              <span>{lead.id} · {lead.source}</span>
              <strong>{lead.account}</strong>
              <small>{lead.product} · {formatMoney(lead.estValue)} · {lead.owner}</small>
              <div className="row-actions"><StatusTag>{lead.stage}</StatusTag><DetailButton type="lead" id={lead.id} setRoute={setRoute} /></div>
            </div>
          ))}
        </BoardColumn>
        <BoardColumn title="Opportunities" icon="opportunities" search={filters.opportunities} onSearch={value => setFilters({ ...filters, opportunities: value })}>
          {filteredOpps.map(opportunity => (
            <div className="pipeline-card focus-card" key={opportunity.id}>
              <span>{opportunity.id} · {customerName(opportunity.customerId)}</span>
              <strong>{opportunity.name}</strong>
              <small>{formatMoney(opportunity.value)} · {opportunity.probability}% · {opportunity.closeDate}</small>
              <div className="row-actions"><StatusTag tone="success">{opportunity.stage}</StatusTag><DetailButton type="opportunity" id={opportunity.id} setRoute={setRoute} /></div>
            </div>
          ))}
        </BoardColumn>
        <BoardColumn title="Customer List" icon="customers" search={filters.customers} onSearch={value => setFilters({ ...filters, customers: value })}>
          {filteredCustomers.map(customer => (
            <div className="customer-row" key={customer.id}>
              <div><strong>{customer.name}</strong><span>{customer.id} · {customer.segment} · {customer.region}</span></div>
              <div className="row-actions"><StatusTag tone={customer.churnRisk === "High" ? "warn" : "blue"}>{customer.churnRisk}</StatusTag><DetailButton type="customer" id={customer.id} setRoute={setRoute} /></div>
            </div>
          ))}
        </BoardColumn>
      </section>
      <Panel title="Quote desk" description="Quotes are connected to opportunities and can feed order creation." action={<SearchBox value={filters.quotes} onChange={value => setFilters({ ...filters, quotes: value })} placeholder="Search quote, customer, package" />}>
        <DataTable
          columns={[
            { key: "id", label: "Quote" },
            { key: "customerId", label: "Customer", render: quote => customerName(quote.customerId) },
            { key: "package", label: "Package" },
            { key: "value", label: "Value", render: quote => formatMoney(quote.value) },
            { key: "margin", label: "Margin", render: quote => `${quote.margin}%` },
            { key: "status", label: "Status", render: quote => <StatusTag tone={quote.status === "Approval" ? "warn" : "blue"}>{quote.status}</StatusTag> },
            { key: "details", label: "", render: quote => <DetailButton type="quote" id={quote.id} setRoute={setRoute} /> }
          ]}
          rows={filteredQuotes}
        />
      </Panel>
      {modal && (
        <Modal
          title="New lead"
          onClose={() => setModal(false)}
          actions={
            <>
              <button className="button" type="button" onClick={() => setModal(false)}>Submit</button>
              <button className="ghost-button" type="reset">Reset</button>
              <button className="ghost-button" type="button">Save</button>
              <button className="ghost-button" type="button" onClick={() => setModal(false)}>Cancel</button>
            </>
          }
        >
          <form className="modal-form">
            <label>Lead name<input placeholder="Account or prospect name" /></label>
            <label>Lead ID<input placeholder="Auto-generated" /></label>
            <label>Source<select><option>Partner referral</option><option>Website</option><option>Outbound</option></select></label>
            <label>Product interest<select>{services.map(service => <option key={service.id}>{service.name}</option>)}</select></label>
            <label>Estimated value<input placeholder="$0" /></label>
            <label>Owner<input placeholder="Sales owner" /></label>
          </form>
        </Modal>
      )}
    </>
  );
}

function PricingModule({ setRoute }) {
  const [query, setQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const customQuotes = quotes.filter(quote => quote.customPrice && matchAny(quote, query, [
    item => item.id,
    item => item.package,
    item => customerName(item.customerId),
    item => opportunities.find(opp => opp.id === item.opportunityId)?.name
  ]));
  const filteredProducts = services.filter(service => matchAny(service, productQuery, [item => item.name, item => item.product, item => item.productType, item => item.productManager, item => item.pricingManager]));

  return (
    <>
      <PageHeader title="Pricing" description="Custom quote desk and product pricing controls by product type, manager, offer, cost, and coefficient route." />
      <Panel title="Custom quote desk" description="Search by customer name, opportunity name, or quote ID." action={<SearchBox value={query} onChange={setQuery} placeholder="Search custom quotes" />}>
        <DataTable
          columns={[
            { key: "id", label: "Quote" },
            { key: "opportunityId", label: "Opportunity", render: quote => opportunities.find(opp => opp.id === quote.opportunityId)?.name },
            { key: "customerId", label: "Customer", render: quote => customerName(quote.customerId) },
            { key: "package", label: "Package" },
            { key: "value", label: "Value", render: quote => formatMoney(quote.value) },
            { key: "status", label: "Status", render: quote => <StatusTag tone="warn">{quote.status}</StatusTag> },
            { key: "details", label: "", render: quote => <DetailButton type="quote" id={quote.id} setRoute={setRoute} /> }
          ]}
          rows={customQuotes}
        />
      </Panel>
      <Panel title="Product pricing list" description="Product pricing governance by type, product, owner, and routing action." action={<SearchBox value={productQuery} onChange={setProductQuery} placeholder="Search product" />}>
        <DataTable
          columns={[
            { key: "productType", label: "Product Type" },
            { key: "product", label: "Product" },
            { key: "name", label: "Offer/Product" },
            { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Review" ? "warn" : "success"}>{row.status}</StatusTag> },
            { key: "pricingManager", label: "Pricing Manager" },
            { key: "productManager", label: "Product Manager" },
            { key: "actions", label: "Actions", render: row => (
              <div className="button-cluster">
                {["Strategic", "Promos", "Offers", "Costs", "Coefficients", "Reporting"].map(action => (
                  <button className="tiny-button" type="button" key={action} onClick={() => setRoute(`details/pricing-${action.toLowerCase().replaceAll(" ", "-")}/${row.id}`)}>{action}</button>
                ))}
              </div>
            ) }
          ]}
          rows={filteredProducts}
        />
      </Panel>
    </>
  );
}

function ProductsModule({ setRoute }) {
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(false);
  const filteredProducts = services.filter(service => matchAny(service, query, [item => item.name, item => item.product, item => item.productType, item => item.productManager, item => item.lifecycle]));
  return (
    <>
      <PageHeader
        title="Products"
        description="Product catalog, lifecycle, ownership, product development, financials, and management actions."
        actions={<ToolbarButton icon="products" variant="button" onClick={() => setModal(true)}>Add product</ToolbarButton>}
      />
      <Panel title="Product portfolio" description="Search product, type, lifecycle, product manager, or owner." action={<SearchBox value={query} onChange={setQuery} placeholder="Search product" />}>
        <div className="product-grid">
          {filteredProducts.map(service => (
            <article className="product-card" key={service.id}>
              <div className="product-card-header">
                <Icon name="products" className="button-icon" />
                <StatusTag tone={service.lifecycle === "Growth" ? "success" : "blue"}>{service.lifecycle}</StatusTag>
              </div>
              <h2>{service.name}</h2>
              <p>{service.productType} · {service.product} · Status: {service.status}</p>
              <div className="mini-stat-row">
                <MiniStat label="Revenue" value={formatMoney(service.revenue)} />
                <MiniStat label="Cost" value={formatMoney(service.cost)} />
                <MiniStat label="Margin" value={`${service.margin}%`} />
              </div>
              <div className="owner-row">
                <span>Product Manager: {service.productManager}</span>
                <span>Pricing Manager: {service.pricingManager}</span>
              </div>
              <div className="subproduct-list">{service.subProducts.map(sub => <span key={sub}>{sub}</span>)}</div>
              <div className="button-cluster product-actions">
                <DetailButton type="product" id={service.id} setRoute={setRoute} />
                {["Development", "Lifecycle", "Costs", "Offers", "Reporting"].map(action => (
                  <button className="tiny-button" type="button" key={action} onClick={() => setRoute(`details/product-${action.toLowerCase()}/${service.id}`)}>{action}</button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </Panel>
      {modal && (
        <Modal
          title="Add product"
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
            <label>Product Type<select><option>Fiber</option><option>Mobility</option><option>Voice Services</option><option>Ethernet</option></select></label>
            <label>Product<input placeholder="Broadband, IoT, BVoIP..." /></label>
            <label>Sub-products<input placeholder="Static IP, Managed Router..." /></label>
            <label>Product Manager<input placeholder="Owner name" /></label>
            <label>Pricing Manager<input placeholder="Pricing owner" /></label>
            <label>Lifecycle<select><option>Launch</option><option>Growth</option><option>Mature</option><option>Refresh</option><option>Retire</option></select></label>
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

function Customer360Module({ setRoute }) {
  const [selectedId, setSelectedId] = useState(customers[0].id);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Invoices");
  const filteredCustomers = customers.filter(customer => matchAny(customer, query, [item => item.id, item => item.name]));
  const customer = customers.find(item => item.id === selectedId) || filteredCustomers[0] || customers[0];
  const customerInvoices = invoices.filter(invoice => invoice.customerId === customer.id);
  const customerTickets = tickets.filter(ticket => ticket.customerId === customer.id);
  const customerOrders = orders.filter(order => order.customerId === customer.id);
  const customerOpps = opportunities.filter(opportunity => opportunity.customerId === customer.id);
  const customerQuotes = quotes.filter(quote => quote.customerId === customer.id);
  const customerNetwork = networkEvents.filter(event => event.customerId === customer.id);
  const categoryRows = {
    Leads: leads.filter(lead => lead.customerId === customer.id),
    Opportunities: customerOpps,
    Invoices: customerInvoices,
    "Support Tickets": customerTickets,
    Billing: customerInvoices.map(invoice => ({ ...invoice, label: invoice.id, details: `${invoice.usage} · ${invoice.aging} days` })),
    Orders: customerOrders,
    Networking: customerNetwork
  }[category] || [];
  return (
    <>
      <PageHeader title="Customer 360" description="Search accounts and move into customer-specific sales, billing, support, order, and network workflows." />
      <section className="customer360-stack">
        <Panel title="Accounts" description="Search by account name or account number." action={<SearchBox value={query} onChange={setQuery} placeholder="Search accounts" />}>
          <div className="account-picker">
            {filteredCustomers.map(item => (
              <button className={item.id === customer.id ? "account-chip active" : "account-chip"} type="button" key={item.id} onClick={() => setSelectedId(item.id)}>
                <strong>{item.name}</strong>
                <span>{item.id} · {item.region} · {item.segment}</span>
              </button>
            ))}
          </div>
        </Panel>
        <section className="profile-surface">
          <div className="profile-hero">
            <div><span>{customer.id}</span><h2>{customer.name}</h2><p>{customer.contact} · {customer.billingProfile}</p></div>
            <div className="health-ring">{customer.health}</div>
          </div>
          <div className="profile-grid">
            <MiniStat label="MRR" value={formatMoney(customer.mrr)} note={customer.churnRisk} />
            <MiniStat label="Active services" value={customer.services.length} note={customer.services.join(", ")} />
            <MiniStat label="Open tickets" value={customerTickets.length} note="Care workload" />
            <MiniStat label="Orders" value={customerOrders.length} note="Fulfillment" />
          </div>
          <div className="customer-action-grid">
            {["Leads", "Opportunities", "Invoices", "Support Tickets", "Billing", "Orders", "Networking"].map(action => (
              <button className={category === action ? "module-link-button active" : "module-link-button"} type="button" key={action} onClick={() => setCategory(action)}>{action}</button>
            ))}
          </div>
          <div className="profile-columns">
            <div><h3>Offers</h3>{customer.activeOffers.map(offer => <span className="soft-pill" key={offer}>{offer}</span>)}{customer.inactiveOffers.map(offer => <span className="soft-pill muted-pill" key={offer}>{offer}</span>)}</div>
            <div><h3>Attributes</h3>{customer.attributes.map(attribute => <span className="soft-pill" key={attribute}>{attribute}</span>)}</div>
            <div><h3>Invoices</h3>{customerInvoices.map(invoice => <span className="ledger-line" key={invoice.id}>{invoice.id} · {formatMoney(invoice.amount)}</span>)}</div>
          </div>
        </section>
        <Panel title={`${category} for ${customer.name}`} description="Customer-specific records appear here before opening item detail.">
          <DataTable
            columns={[
              { key: "id", label: "ID" },
              { key: "name", label: "Name", render: row => row.name || row.account || row.type || row.service || row.label || row.market || row.package || row.source },
              { key: "status", label: "Status", render: row => <StatusTag tone={["Priority", "Urgent", "High", "Review", "Open"].includes(row.status || row.priority || row.severity) ? "warn" : "blue"}>{row.status || row.priority || row.severity || row.stage || "Active"}</StatusTag> },
              { key: "details", label: "", render: row => <DetailButton type={category === "Invoices" || category === "Billing" ? "invoice" : category === "Support Tickets" ? "ticket" : category === "Orders" ? "order" : category === "Networking" ? "network" : category === "Opportunities" ? "opportunity" : "lead"} id={row.id} setRoute={setRoute} /> }
            ]}
            rows={categoryRows}
          />
        </Panel>
      </section>
    </>
  );
}

function BillingModule({ setRoute }) {
  const [query, setQuery] = useState("");
  const rows = customers.filter(customer => matchAny(customer, query, [item => item.id, item => item.name])).map(customer => ({
    ...customer,
    invoiceTotal: sum(invoices.filter(invoice => invoice.customerId === customer.id), invoice => invoice.amount),
    invoiceCount: invoices.filter(invoice => invoice.customerId === customer.id).length
  }));
  return (
    <>
      <PageHeader title="Billing" description="Search accounts, review basic billing context, and open detailed account billing." />
      <Panel title="Account billing search" description="Search by account name or account number." action={<SearchBox value={query} onChange={setQuery} placeholder="Search accounts" />}>
        <DataTable
          columns={[
            { key: "id", label: "Account" },
            { key: "name", label: "Customer" },
            { key: "region", label: "Region" },
            { key: "segment", label: "Segment" },
            { key: "invoiceCount", label: "Invoices" },
            { key: "invoiceTotal", label: "Balance", render: row => formatMoney(row.invoiceTotal) },
            { key: "details", label: "", render: row => <DetailButton type="billing-account" id={row.id} setRoute={setRoute} /> }
          ]}
          rows={rows}
        />
      </Panel>
    </>
  );
}

function OrdersModule({ setRoute }) {
  const [filters, setFilters] = useState({ customer: "", orderId: "", leadId: "", opportunityId: "", account: "", service: "", source: "" });
  const filteredOrders = orders.filter(order => (
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
      <PageHeader title="Orders" description="Search customer, order ID, lead ID, opportunity ID, account number, service, and source." />
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
        <Panel title="Order list" description="Open an order to modify, cancel, reschedule, or inspect fulfillment details.">
          <DataTable
            columns={[
              { key: "id", label: "Order" },
              { key: "source", label: "Source" },
              { key: "customerId", label: "Customer", render: order => customerName(order.customerId) },
              { key: "service", label: "Service" },
              { key: "due", label: "Due" },
              { key: "modifiable", label: "Modify", render: order => <StatusTag tone={order.modifiable ? "success" : "blue"}>{order.modifiable ? "Allowed" : "Locked"}</StatusTag> },
              { key: "details", label: "", render: order => <DetailButton type="order" id={order.id} setRoute={setRoute} /> }
            ]}
            rows={filteredOrders}
          />
        </Panel>
      </section>
    </>
  );
}

function makePdfBlob(lines) {
  const clean = lines.map(line => String(line).replace(/[()\\]/g, ""));
  const text = clean.map((line, index) => `BT /F1 ${index === 0 ? 18 : 11} Tf 72 ${730 - index * 24} Td (${line}) Tj ET`).join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >> endobj",
    `4 0 obj << /Length ${text.length} >> stream\n${text}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj"
  ];
  const body = objects.join("\n");
  return new Blob([`%PDF-1.4\n${body}\ntrailer << /Root 1 0 R >>\n%%EOF`], { type: "application/pdf" });
}

function BillingAccountDetail({ id, setRoute, showToast }) {
  const customer = customers.find(item => item.id === id) || customers[0];
  const customerInvoices = invoices.filter(invoice => invoice.customerId === customer.id);
  const serviceInstances = serviceInstancesFor(customer);
  const usageRows = usageRowsFor(customer);
  const customerAdjustments = adjustments.filter(adjustment => adjustment.customerId === customer.id);
  return (
    <>
      <PageHeader
        title={`${customer.name} billing detail`}
        description="Invoices, usage, adjustments, active services, promos, offers, product pricing, and service controls."
        actions={<ToolbarButton icon="billing" onClick={() => setRoute("billing")}>Back to billing</ToolbarButton>}
      />
      <section className="billing-detail-grid">
        <Panel title="Service controls" description="Each provisioned service can represent one or many circuits, seats, SIM groups, or service instances.">
          <div className="service-instance-list">
            {serviceInstances.map(instance => (
              <article className="service-instance-card" key={instance.id}>
                <div>
                  <strong>{instance.service}</strong>
                  <span>{instance.circuitId} · {instance.location} · {formatMoney(instance.price)}</span>
                </div>
                <StatusTag tone={instance.status === "Active" ? "success" : "warn"}>{instance.status}</StatusTag>
                <div className="button-cluster">
                  <DetailButton type="service" id={instance.id} setRoute={setRoute} />
                  <button className="tiny-button" type="button">Activate</button>
                  <button className="tiny-button" type="button">Disconnect</button>
                  <button className="tiny-button" type="button">Attach promo</button>
                  <button className="tiny-button" type="button">Attach offer</button>
                  <button className="tiny-button" type="button">Change pricing</button>
                </div>
              </article>
            ))}
          </div>
        </Panel>
        <Panel title="Billing and contract profile" description="Contract, invoicing, customer billing attributes, and active commercial terms.">
          <div className="billing-attribute-grid">
            <MiniStat label="Contract" value="36 mo" note="Renewal window: Q3 2026" />
            <MiniStat label="Billing" value={customer.billingProfile.split(",")[0]} note={customer.billingProfile} />
            <MiniStat label="Invoice mode" value="Consolidated" note="Parent-child account hierarchy supported" />
            <MiniStat label="Tax" value={customer.billingProfile.includes("tax exempt") ? "Exempt" : "Standard"} note="Jurisdiction rules attached" />
          </div>
          <div className="attribute-row">{customer.attributes.map(attribute => <span className="soft-pill" key={attribute}>{attribute}</span>)}</div>
          <div className="attribute-row">{customer.activeOffers.map(offer => <span className="soft-pill" key={offer}>{offer}</span>)}</div>
        </Panel>
      </section>
      <Panel title="Invoices" description="Invoice template with line item export.">
        {customerInvoices[0] && (
          <article className="invoice-template-preview">
            <div className="invoice-brand">
              <div>
                <span>Northstar Telecom</span>
                <h3>Billing invoice preview</h3>
              </div>
              <strong>{customerInvoices[0].id}</strong>
            </div>
            <div className="invoice-preview-grid">
              <div><span>Bill to</span><strong>{customer.name}</strong><small>{customer.id} · {customer.contact}</small></div>
              <div><span>Due date</span><strong>{customerInvoices[0].due}</strong><small>{customer.billingProfile}</small></div>
              <div><span>Amount due</span><strong>{formatMoney(customerInvoices[0].amount)}</strong><small>{customerInvoices[0].usage} rated usage</small></div>
            </div>
            <div className="invoice-line-preview">
              {customerInvoices[0].lineItems.map(item => (
                <div key={item.description}>
                  <span>{item.description}</span>
                  <small>Qty {item.qty}</small>
                  <strong>{formatMoney(item.amount)}</strong>
                </div>
              ))}
            </div>
          </article>
        )}
        <DataTable
          columns={[
            { key: "id", label: "Invoice" },
            { key: "amount", label: "Amount", render: invoice => formatMoney(invoice.amount) },
            { key: "usage", label: "Usage" },
            { key: "due", label: "Due" },
            { key: "status", label: "Status", render: invoice => <StatusTag tone={invoice.status === "Review" || invoice.status === "Priority" ? "warn" : "blue"}>{invoice.status}</StatusTag> },
            { key: "pdf", label: "", render: invoice => <button className="link-button compact-action" type="button" onClick={() => { downloadBlob(makePdfBlob(["Northstar Telecom Invoice", customer.name, invoice.id, `Amount: ${formatMoney(invoice.amount)}`, `Usage: ${invoice.usage}`, `Due: ${invoice.due}`, ...invoice.lineItems.map(item => `${item.description}: ${formatMoney(item.amount)}`)]), `${invoice.id}.pdf`); showToast("Invoice PDF exported"); }}>Export PDF</button> }
          ]}
          rows={customerInvoices}
        />
      </Panel>
      <section className="billing-detail-grid lower">
        <Panel title="Usage details" description="Rated usage records tied to invoice periods.">
          <DataTable columns={[{ key: "id", label: "Usage" }, { key: "invoiceId", label: "Invoice" }, { key: "period", label: "Period" }, { key: "usage", label: "Usage" }, { key: "ratedAmount", label: "Rated", render: row => formatMoney(row.ratedAmount) }]} rows={usageRows} />
        </Panel>
        <Panel title="Adjustments" description="Credits, disputes, true-ups, and billing corrections.">
          <DataTable columns={[{ key: "id", label: "Adjustment" }, { key: "type", label: "Type" }, { key: "amount", label: "Amount", render: row => formatMoney(row.amount) }, { key: "status", label: "Status" }]} rows={customerAdjustments} />
        </Panel>
      </section>
    </>
  );
}

function OrderDetail({ id, setRoute }) {
  const order = orders.find(item => item.id === id) || orders[0];
  return (
    <>
      <PageHeader title={`${order.id} order detail`} description={`${customerName(order.customerId)} · ${order.service} · ${order.source}`} actions={<ToolbarButton icon="orders" onClick={() => setRoute("orders")}>Back to orders</ToolbarButton>} />
      <section className="overview-grid">
        <MetricCard label="Status" value={order.status} delta="Current fulfillment state" />
        <MetricCard label="Due" value={order.due} delta={order.owner} />
        <MetricCard label="Modify" value={order.modifiable ? "Allowed" : "Locked"} delta="Policy controlled" />
        <MetricCard label="Source" value={order.source} delta="Sales lineage" />
      </section>
      <Panel title="Order actions" description="Prototype actions for order management.">
        <div className="button-cluster"><button className="button" type="button">Modify</button><button className="ghost-button" type="button">Cancel</button><button className="ghost-button" type="button">Reschedule</button><button className="ghost-button" type="button">Add note</button></div>
      </Panel>
    </>
  );
}

function ServiceDetail({ id, setRoute }) {
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
        <div className="button-cluster"><button className="button" type="button">Activate</button><button className="ghost-button" type="button">Disconnect</button><button className="ghost-button" type="button">Attach promo</button><button className="ghost-button" type="button">Attach offer</button><button className="ghost-button" type="button">Change pricing</button></div>
      </Panel>
    </>
  );
}

function DetailPage({ route, setRoute, showToast }) {
  const [, type, id] = route.split("/");
  if (type === "billing-account") return <BillingAccountDetail id={id} setRoute={setRoute} showToast={showToast} />;
  if (type === "order") return <OrderDetail id={id} setRoute={setRoute} />;
  if (type === "service") return <ServiceDetail id={id} setRoute={setRoute} />;
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
          <button className="button" type="button">Update</button>
          <button className="ghost-button" type="button">Assign</button>
          <button className="ghost-button" type="button">Audit</button>
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
      {route === "sales" && <SalesModule setRoute={setRoute} />}
      {route === "pricing" && <PricingModule setRoute={setRoute} />}
      {route === "products" && <ProductsModule setRoute={setRoute} />}
      {route === "customer-service" && <CustomerServiceModule setRoute={setRoute} />}
      {route === "customer-360" && <Customer360Module setRoute={setRoute} />}
      {route === "billing" && <BillingModule setRoute={setRoute} />}
      {route === "orders" && <OrdersModule setRoute={setRoute} />}
      {route === "reports" && <ReportsModule showToast={showToast} />}
      {route.startsWith("details/") && <DetailPage route={route} setRoute={setRoute} showToast={showToast} />}
      {["network", "service-management", "provisioning", "carrier-settlement"].includes(route) && <ServiceOpsModule route={route} />}
      <Toast toast={toast} />
    </Shell>
  );
}
