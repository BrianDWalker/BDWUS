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

const sum = (items, selector) => items.reduce((total, item) => total + selector(item), 0);
const customerName = id => customers.find(customer => customer.id === id)?.name || id;
const money = value => formatMoney(value);

function currentRoute() {
  const route = window.location.hash.replace(/^#\/?/, "");
  return route || "dashboard";
}

function useHashRoute() {
  const [route, setRouteValue] = useState(currentRoute);

  useEffect(() => {
    const sync = () => setRouteValue(currentRoute());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  function setRoute(nextRoute) {
    window.location.hash = `/${nextRoute}`;
    setRouteValue(nextRoute);
  }

  return [route, setRoute];
}

function SearchBox({ value, onChange, placeholder = "Search" }) {
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

function WorkCard({ icon, title, text, route, setRoute, tone = "" }) {
  return (
    <button className={`work-card ${tone}`} type="button" onClick={() => setRoute(route)}>
      <Icon name={icon} className="button-icon" />
      <strong>{title}</strong>
      <span>{text}</span>
    </button>
  );
}

const moduleBlueprint = [
  {
    route: "sales",
    icon: "sales",
    title: "Sales & Quote Desk",
    promise: "Convert leads into margin-aware quotes and order-ready packages.",
    data: "Leads, opportunities, quotes, customers, products, pricing guardrails",
    next: "Connect quote creation to pricing API and order orchestration."
  },
  {
    route: "customer-360",
    icon: "customerSearch",
    title: "Customer 360",
    promise: "Give sales, care, billing, and service teams one account workspace.",
    data: "Accounts, services, invoices, tickets, orders, offers, health, churn risk",
    next: "Replace mock profile data with Azure SQL customer/service views."
  },
  {
    route: "network",
    icon: "network",
    title: "Network & Serviceability",
    promise: "Show where service can be sold, installed, monitored, and protected.",
    data: "Network events, service locations, circuits, FCC data, GIS/fiber overlays",
    next: "Add serviceability and health APIs behind customer-specific connectors."
  },
  {
    route: "pricing",
    icon: "pricing",
    title: "Pricing Intelligence",
    promise: "Recommend prices using margin, competition, product cost, and customer context.",
    data: "Quotes, products, coefficients, offers, competitor intelligence, cost tables",
    next: "Separate pricing engine into a Container Apps API with quote history persistence."
  },
  {
    route: "service-management",
    icon: "service",
    title: "Service Management",
    promise: "Track installs, tickets, outages, SLA exposure, and operational ownership.",
    data: "Tickets, orders, network events, service inventory, SLA exposure",
    next: "Add workflow state machines, audit history, and notification hooks."
  },
  {
    route: "reports",
    icon: "reports",
    title: "Reporting & Intelligence",
    promise: "Turn operational data into executive, commercial, network, and billing reports.",
    data: "Report definitions, paginated rows, exports, summary metrics",
    next: "Add Power BI/Fabric-ready datasets and customer-safe report permissions."
  }
];

const tenantOptions = [
  {
    name: "Shared SaaS",
    fit: "Small ISP / early demo customers",
    model: "Shared app runtime, tenant key in data layer, lowest cost",
    monthly: "$2K-$10K/mo"
  },
  {
    name: "Dedicated Tenant",
    fit: "Regional providers and security-sensitive operators",
    model: "Dedicated Azure SQL DB, storage container, Key Vault secrets, isolated configs",
    monthly: "$15K-$75K/mo"
  },
  {
    name: "Managed Telecom Cloud",
    fit: "Customers without big data/engineering teams",
    model: "You host data pipelines, reporting store, competitor data, and API layer",
    monthly: "$25K-$150K+/mo"
  },
  {
    name: "Customer-Owned Data",
    fit: "Enterprise telecoms with their own data platforms",
    model: "Platform connects to their systems via APIs/VPN and stores minimal derived data",
    monthly: "Custom enterprise"
  }
];

const azurePlan = [
  ["Web UI", "Azure Static Web Apps or App Service", "Host the portal with the same look and feel for each customer."],
  ["APIs", "Azure Container Apps", "Run pricing, customer, quote, reporting, and integration APIs."],
  ["Data", "Azure SQL + Blob/ADLS", "Store operational records, raw FCC files, exports, and customer data."],
  ["Integration", "API Management + Functions + Service Bus", "Expose secure APIs and run reliable order/provisioning workflows."],
  ["Tenant isolation", "Separate DB/storage/Key Vault/VNet per customer", "Keeps one customer from touching another customer's data."],
  ["Network access", "VPN Gateway or ExpressRoute", "Connect to customer-owned systems when private access is required."],
  ["Observability", "Application Insights + Log Analytics", "Track usage, errors, API performance, and customer activity."],
  ["Security", "Entra ID + Key Vault + RBAC", "SSO, role permissions, secrets, and auditability."],
  ["Analytics/AI later", "Fabric, AI Search, Azure OpenAI", "Add large-scale reporting, intelligence search, and AI assistant features."]
];

const packageTiers = [
  {
    tier: "Starter ISP",
    target: "Local fiber/WISP operators",
    base: "$2.5K-$6.5K/mo",
    modules: "Sales, Customer 360, basic billing, reports",
    implementation: "$10K-$50K"
  },
  {
    tier: "Growth Provider",
    target: "Regional fiber/cable/wireless providers",
    base: "$10K-$35K/mo",
    modules: "Pricing, serviceability, network events, managed data option",
    implementation: "$50K-$250K"
  },
  {
    tier: "Enterprise Tenant",
    target: "Large regional or national telecoms",
    base: "$75K-$250K+/mo",
    modules: "Dedicated tenant, API usage, data cloud, custom integrations",
    implementation: "$250K-$2M+"
  }
];

function Dashboard({ setRoute }) {
  const mrr = sum(customers, customer => customer.mrr);
  const quoteValue = sum(quotes, quote => quote.value);
  const urgentTickets = tickets.filter(ticket => ["Urgent", "High"].includes(ticket.priority)).length;
  const activeNetworkRisk = sum(networkEvents, event => event.slaExposure);

  return (
    <>
      <PageHeader
        title="Northstar Telecom Command Center"
        description="A modular telecom SaaS workspace for sales, customer 360, pricing, serviceability, billing, reporting, and operational intelligence."
        actions={<button className="button" type="button" onClick={() => setRoute("architecture")}>View platform blueprint</button>}
      />

      <section className="platform-hero upgraded-hero">
        <div>
          <span className="eyebrow">Productized telecom operations</span>
          <h2>One UI, isolated customer environments, reusable modules.</h2>
          <p>
            This build frames the portal as a deployable SaaS product: shared look and feel, customer-specific data boundaries,
            optional managed data storage, and integration paths for customer-owned telecom systems.
          </p>
          <div className="button-cluster">
            <button className="button" type="button" onClick={() => setRoute("sales")}>Run sales flow</button>
            <button className="ghost-button" type="button" onClick={() => setRoute("customer-360")}>Open Customer 360</button>
            <button className="ghost-button" type="button" onClick={() => setRoute("network")}>Review network risk</button>
          </div>
        </div>
        <div className="hero-scorecard">
          <MiniStat label="Managed MRR" value={money(mrr)} note="Demo customer book" />
          <MiniStat label="Pipeline quotes" value={money(quoteValue)} note="Quote desk value" />
          <MiniStat label="Priority care" value={urgentTickets} note="High-risk tickets" />
          <MiniStat label="SLA exposure" value={money(activeNetworkRisk)} note="Network event risk" />
        </div>
      </section>

      <section className="overview-grid">
        <MetricCard label="Commercial modules" value="3" delta="Sales, Pricing, Products" />
        <MetricCard label="Customer modules" value="3" delta="Care, 360, Billing" />
        <MetricCard label="Network modules" value="3" delta="Network, Service Mgmt, Provisioning" />
        <MetricCard label="Deployment model" value="Hybrid" delta="Shared SaaS or dedicated tenant" />
      </section>

      <section className="module-blueprint-grid">
        {moduleBlueprint.map(module => (
          <button className="platform-card module-blueprint-card" type="button" key={module.route} onClick={() => setRoute(module.route)}>
            <span className="module-icon"><Icon name={module.icon} /></span>
            <strong>{module.title}</strong>
            <span>{module.promise}</span>
            <small>{module.next}</small>
          </button>
        ))}
      </section>
    </>
  );
}

function Sales({ setRoute }) {
  const rows = opportunities.map(opportunity => ({
    ...opportunity,
    customer: customerName(opportunity.customerId),
    quote: quotes.find(quote => quote.opportunityId === opportunity.id)?.id || "Not quoted"
  }));

  return (
    <>
      <PageHeader title="Sales & Quote Desk" description="Convert demand into margin-aware telecom packages that can feed order creation." />
      <section className="overview-grid">
        <MetricCard label="Leads" value={leads.length} delta="Qualified and discovery queue" />
        <MetricCard label="Opportunities" value={opportunities.length} delta={money(sum(opportunities, item => item.value))} />
        <MetricCard label="Quotes" value={quotes.length} delta={money(sum(quotes, item => item.value))} />
        <MetricCard label="Custom pricing" value={quotes.filter(quote => quote.customPrice).length} delta="Requires pricing governance" />
      </section>
      <section className="ops-split">
        <Panel title="Opportunity command" description="A single sales pipeline view with customer and quote context.">
          <DataTable
            rows={rows}
            columns={[
              { key: "id", label: "Opportunity" },
              { key: "customer", label: "Customer" },
              { key: "name", label: "Need" },
              { key: "value", label: "Value", render: row => money(row.value) },
              { key: "probability", label: "Probability", render: row => `${row.probability}%` },
              { key: "quote", label: "Quote" },
              { key: "stage", label: "Stage", render: row => <StatusTag tone="success">{row.stage}</StatusTag> }
            ]}
          />
        </Panel>
        <Panel title="Sales workflow" description="How this becomes production-ready.">
          <div className="workflow-list">
            <WorkCard icon="leads" title="Lead capture" text="CRM/API imports and manual creation." route="customer-360" setRoute={setRoute} />
            <WorkCard icon="pricing" title="Pricing handoff" text="Send quote inputs to pricing API for margin-aware recommendation." route="pricing" setRoute={setRoute} />
            <WorkCard icon="orders" title="Quote to order" text="Approved packages become install, modify, or disconnect orders." route="orders" setRoute={setRoute} />
          </div>
        </Panel>
      </section>
    </>
  );
}

function Customer360() {
  const [selectedId, setSelectedId] = useState(customers[0].id);
  const customer = customers.find(item => item.id === selectedId) || customers[0];
  const customerInvoices = invoices.filter(invoice => invoice.customerId === customer.id);
  const customerTickets = tickets.filter(ticket => ticket.customerId === customer.id);
  const customerOrders = orders.filter(order => order.customerId === customer.id);
  const customerNetwork = networkEvents.filter(event => event.customerId === customer.id);

  return (
    <>
      <PageHeader title="Customer 360" description="A single account workspace connecting commercial, service, network, and billing context." />
      <section className="customer360-layout">
        <Panel title="Accounts" description="Demo tenant account list.">
          <div className="account-picker">
            {customers.map(item => (
              <button className={item.id === selectedId ? "account-chip active" : "account-chip"} type="button" key={item.id} onClick={() => setSelectedId(item.id)}>
                <strong>{item.name}</strong>
                <span>{item.id} · {item.segment} · {item.region}</span>
              </button>
            ))}
          </div>
        </Panel>
        <section className="profile-surface">
          <div className="profile-hero">
            <div>
              <span>{customer.id}</span>
              <h2>{customer.name}</h2>
              <p>{customer.contact} · {customer.billingProfile}</p>
            </div>
            <div className="health-ring">{customer.health}</div>
          </div>
          <div className="profile-grid">
            <MiniStat label="MRR" value={money(customer.mrr)} note={customer.churnRisk} />
            <MiniStat label="Services" value={customer.services.length} note={customer.services.join(", ")} />
            <MiniStat label="Open tickets" value={customerTickets.length} note="Care workload" />
            <MiniStat label="Orders" value={customerOrders.length} note="Fulfillment" />
          </div>
          <div className="profile-columns upgraded-profile-columns">
            <div><h3>Active offers</h3>{customer.activeOffers.map(offer => <span className="soft-pill" key={offer}>{offer}</span>)}</div>
            <div><h3>Attributes</h3>{customer.attributes.map(attribute => <span className="soft-pill" key={attribute}>{attribute}</span>)}</div>
            <div><h3>Network signals</h3>{customerNetwork.length ? customerNetwork.map(event => <span className="ledger-line" key={event.id}>{event.market} · {event.severity}</span>) : <span className="ledger-line">No active network events</span>}</div>
          </div>
        </section>
      </section>
      <section className="ops-split lower-space">
        <Panel title="Invoices" description="Billing context tied to this customer.">
          <DataTable
            rows={customerInvoices}
            columns={[
              { key: "id", label: "Invoice" },
              { key: "amount", label: "Amount", render: row => money(row.amount) },
              { key: "usage", label: "Usage" },
              { key: "aging", label: "Aging", render: row => `${row.aging} days` },
              { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Priority" || row.status === "Review" ? "warn" : "blue"}>{row.status}</StatusTag> }
            ]}
          />
        </Panel>
        <Panel title="Care and orders" description="Work items connected to the same account.">
          <div className="compact-card-stack">
            {[...customerTickets, ...customerOrders].map(item => (
              <div className="compact-card" key={item.id}>
                <strong>{item.id}</strong>
                <span>{item.type || item.service} · {item.status || item.priority}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </>
  );
}

function Pricing() {
  return (
    <>
      <PageHeader title="Pricing Intelligence" description="A productized pricing workspace for quote recommendations, offer guardrails, cost visibility, and coefficient governance." />
      <section className="overview-grid">
        <MetricCard label="Custom quotes" value={quotes.filter(quote => quote.customPrice).length} delta="Route to pricing API" />
        <MetricCard label="Avg margin" value="32.7%" delta="Demo quote book" />
        <MetricCard label="Programs" value={pricingPrograms.length} delta="Promo and strategic offers" />
        <MetricCard label="Target API" value="/price" delta="Future Container Apps endpoint" />
      </section>
      <section className="ops-split">
        <Panel title="Quote recommendations" description="This is where the pricing microservice would return recommended price, confidence, and margin impact.">
          <DataTable
            rows={quotes}
            columns={[
              { key: "id", label: "Quote" },
              { key: "customerId", label: "Customer", render: row => customerName(row.customerId) },
              { key: "package", label: "Package" },
              { key: "value", label: "Price", render: row => money(row.value) },
              { key: "margin", label: "Margin", render: row => `${row.margin}%` },
              { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Approval" ? "warn" : "blue"}>{row.status}</StatusTag> }
            ]}
          />
        </Panel>
        <Panel title="Pricing API contract" description="Suggested production API design.">
          <div className="api-contract-card">
            <code>POST /api/pricing/recommend</code>
            <span>Inputs: customer, product, location, quantity, term, target margin, competitor pressure</span>
            <span>Outputs: recommended price, floor price, approval status, confidence, rationale</span>
          </div>
          <div className="api-contract-card">
            <code>POST /api/pricing/simulate</code>
            <span>Run what-if margin, discount, term, and competitor scenarios before sending a quote.</span>
          </div>
        </Panel>
      </section>
    </>
  );
}

function Products() {
  return (
    <>
      <PageHeader title="Product Management" description="Product catalog, lifecycle, financials, owners, and offer relationships." />
      <section className="product-grid">
        {services.map(service => (
          <article className="product-card" key={service.id}>
            <div className="product-card-header">
              <Icon name="products" className="button-icon" />
              <StatusTag tone={service.lifecycle === "Growth" ? "success" : "blue"}>{service.lifecycle}</StatusTag>
            </div>
            <h2>{service.name}</h2>
            <p>{service.productType} · {service.product} · {service.family}</p>
            <div className="mini-stat-row">
              <MiniStat label="Revenue" value={money(service.revenue)} />
              <MiniStat label="Cost" value={money(service.cost)} />
              <MiniStat label="Margin" value={`${service.margin}%`} />
            </div>
            <div className="owner-row">
              <span>Product Manager: {service.productManager}</span>
              <span>Pricing Manager: {service.pricingManager}</span>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

function CustomerService() {
  return (
    <>
      <PageHeader title="Customer Service" description="Support tickets, escalation context, customer-reported outages, and billing inquiries." />
      <section className="overview-grid">
        <MetricCard label="Tickets" value={tickets.length} delta="Open support queue" />
        <MetricCard label="Network tickets" value={tickets.filter(ticket => ticket.category === "Network").length} delta="Customer-reported incidents" />
        <MetricCard label="Billing tickets" value={tickets.filter(ticket => ticket.category === "Billing").length} delta="Invoice and credit cases" />
        <MetricCard label="Avg age" value="36h" delta="Demo queue" />
      </section>
      <Panel title="Service desk queue" description="Tickets connected to customer, billing, and network data.">
        <DataTable
          rows={tickets}
          columns={[
            { key: "id", label: "Ticket" },
            { key: "customerId", label: "Customer", render: row => customerName(row.customerId) },
            { key: "type", label: "Issue" },
            { key: "category", label: "Category" },
            { key: "ageHours", label: "Age", render: row => `${row.ageHours}h` },
            { key: "priority", label: "Priority", render: row => <StatusTag tone={["Urgent", "High"].includes(row.priority) ? "warn" : "blue"}>{row.priority}</StatusTag> }
          ]}
        />
      </Panel>
    </>
  );
}

function Network() {
  return (
    <>
      <PageHeader title="Network & Serviceability" description="Network risk, serviceability intelligence, customer impact, and future live health integration." />
      <section className="overview-grid">
        <MetricCard label="Network events" value={networkEvents.length} delta="Active risk signals" />
        <MetricCard label="Customer-reported" value={networkEvents.filter(event => event.customerReported).length} delta="Care-linked outages" />
        <MetricCard label="SLA exposure" value={money(sum(networkEvents, event => event.slaExposure))} delta="Estimated credits" />
        <MetricCard label="Health API" value="Future" delta="NMS/OLT/CPE connectors" />
      </section>
      <section className="ops-split">
        <Panel title="Network events" description="Current events enriched with customer and revenue exposure.">
          <DataTable
            rows={networkEvents}
            columns={[
              { key: "id", label: "Event" },
              { key: "customerId", label: "Customer", render: row => customerName(row.customerId) },
              { key: "market", label: "Market" },
              { key: "type", label: "Type" },
              { key: "impacted", label: "Impacted" },
              { key: "slaExposure", label: "SLA Exposure", render: row => money(row.slaExposure) },
              { key: "severity", label: "Severity", render: row => <StatusTag tone={row.severity === "Critical" ? "warn" : "blue"}>{row.severity}</StatusTag> }
            ]}
          />
        </Panel>
        <Panel title="Future service health stack" description="Azure-backed pattern for live service health without building deep vendor management first.">
          <div className="stack-list">
            {[
              "VPN Gateway / ExpressRoute to customer network",
              "Container Apps or Functions for NMS, OLT, CPE, and ticketing connectors",
              "Service Bus for reliable health and workflow events",
              "Azure SQL for latest customer/service health snapshot",
              "Log Analytics or Data Explorer for historical telemetry"
            ].map(item => <span className="stack-chip" key={item}>{item}</span>)}
          </div>
        </Panel>
      </section>
    </>
  );
}

function Billing() {
  return (
    <>
      <PageHeader title="Billing" description="Invoices, usage, adjustments, service records, and financial exposure." />
      <section className="overview-grid">
        <MetricCard label="Invoices" value={invoices.length} delta={money(sum(invoices, invoice => invoice.amount))} />
        <MetricCard label="Adjustments" value={adjustments.length} delta={money(sum(adjustments, item => item.amount))} />
        <MetricCard label="Aging watch" value={invoices.filter(invoice => invoice.aging > 60).length} delta="Over 60 days" />
        <MetricCard label="Billing API" value="Future" delta="Invoice + usage endpoints" />
      </section>
      <Panel title="Invoice ledger" description="Customer invoices and billing status.">
        <DataTable
          rows={invoices}
          columns={[
            { key: "id", label: "Invoice" },
            { key: "customerId", label: "Customer", render: row => customerName(row.customerId) },
            { key: "amount", label: "Amount", render: row => money(row.amount) },
            { key: "usage", label: "Usage" },
            { key: "aging", label: "Aging", render: row => `${row.aging} days` },
            { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Priority" || row.status === "Review" ? "warn" : "blue"}>{row.status}</StatusTag> }
          ]}
        />
      </Panel>
    </>
  );
}

function Orders() {
  return (
    <>
      <PageHeader title="Orders" description="Install, modify, research, and disconnect workflows sourced from sales, quote, and care activity." />
      <Panel title="Order operations" description="Order queue ready for provisioning integration.">
        <DataTable
          rows={orders}
          columns={[
            { key: "id", label: "Order" },
            { key: "source", label: "Source" },
            { key: "customerId", label: "Customer", render: row => customerName(row.customerId) },
            { key: "service", label: "Service" },
            { key: "owner", label: "Owner" },
            { key: "due", label: "Due" },
            { key: "status", label: "Status", render: row => <StatusTag tone={row.status === "Staged" ? "warn" : "blue"}>{row.status}</StatusTag> }
          ]}
        />
      </Panel>
    </>
  );
}

function ServiceManagement() {
  return (
    <>
      <PageHeader title="Service Management" description="Operational ownership layer across tickets, orders, incidents, SLA exposure, and service health." />
      <section className="module-blueprint-grid compact-blueprint">
        <WorkCard icon="tickets" title="Tickets" text="Care cases, escalation, priority, customer impact." route="customer-service" setRoute={() => {}} />
        <WorkCard icon="orders" title="Orders" text="Install, modify, disconnect, research workflow." route="orders" setRoute={() => {}} />
        <WorkCard icon="sla" title="SLA" text="Credits, outage exposure, service impact." route="network" setRoute={() => {}} />
        <WorkCard icon="workflow" title="Workflow" text="Future durable workflow and audit trails." route="architecture" setRoute={() => {}} />
      </section>
      <Panel title="Service management backlog" description="What should become backend workflow state next.">
        <DataTable
          rows={[...tickets, ...orders]}
          columns={[
            { key: "id", label: "Item" },
            { key: "customerId", label: "Customer", render: row => customerName(row.customerId) },
            { key: "type", label: "Type", render: row => row.type || row.service },
            { key: "status", label: "Status", render: row => <StatusTag tone={row.priority === "Urgent" || row.status === "Staged" ? "warn" : "blue"}>{row.priority || row.status}</StatusTag> }
          ]}
        />
      </Panel>
    </>
  );
}

function Provisioning() {
  return (
    <>
      <PageHeader title="Provisioning" description="Future API-driven activation, disconnect, and service-change orchestration." />
      <section className="ops-split">
        <Panel title="Provisioning workflow" description="Recommended workflow once customer systems are connected.">
          <div className="stack-list">
            {[
              "Validate customer and product eligibility",
              "Reserve service/location/circuit resources",
              "Create order in customer OSS/ticketing system",
              "Trigger activation or disconnect through provisioning connector",
              "Confirm service status and update Customer 360"
            ].map(item => <span className="stack-chip" key={item}>{item}</span>)}
          </div>
        </Panel>
        <Panel title="Azure services" description="Minimum services for safe orchestration.">
          <DataTable
            rows={[
              { id: "API Management", purpose: "Secure provisioning endpoints" },
              { id: "Container Apps / Functions", purpose: "Run connector logic" },
              { id: "Service Bus", purpose: "Queue long-running activation events" },
              { id: "Azure SQL", purpose: "Persist order and service states" },
              { id: "Key Vault", purpose: "Store customer credentials and secrets" }
            ]}
            columns={[
              { key: "id", label: "Service" },
              { key: "purpose", label: "Purpose" }
            ]}
          />
        </Panel>
      </section>
    </>
  );
}

function Reports() {
  const [selected, setSelected] = useState(reportDefinitions[0].id);
  const rows = reportRows.filter(row => row.reportId === selected);
  const report = reportDefinitions.find(item => item.id === selected) || reportDefinitions[0];

  return (
    <>
      <PageHeader title="Reports" description="Executive, commercial, customer, billing, and network reporting workbench." />
      <section className="report-studio">
        <div className="report-catalog">
          <div className="report-catalog-header">Report library</div>
          {reportDefinitions.map(item => (
            <button className={item.id === selected ? "report-item active" : "report-item"} type="button" key={item.id} onClick={() => setSelected(item.id)}>
              <strong>{item.name}</strong>
              <span>{item.area}</span>
            </button>
          ))}
        </div>
        <Panel title={report.name} description={report.description}>
          <DataTable
            rows={rows}
            columns={[
              { key: "region", label: "Region" },
              { key: "segment", label: "Segment" },
              { key: "account", label: "Account" },
              { key: "service", label: "Service" },
              { key: "amount", label: "Amount", render: row => money(row.amount) },
              { key: "metric", label: "Metric" },
              { key: "status", label: "Status", render: row => <StatusTag>{row.status}</StatusTag> }
            ]}
          />
        </Panel>
      </section>
    </>
  );
}

function CarrierSettlement() {
  return (
    <>
      <PageHeader title="Carrier Settlement" description="Finance workspace for partner/carrier costs, usage reconciliation, and settlement exposure." />
      <section className="overview-grid">
        <MetricCard label="Settlement ready" value="Future" delta="Usage + carrier cost matching" />
        <MetricCard label="Adjustments" value={adjustments.length} delta="Credits and disputes" />
        <MetricCard label="Carrier APIs" value="Planned" delta="Usage and cost feeds" />
        <MetricCard label="Finance reports" value="Planned" delta="Partner reconciliation" />
      </section>
      <Panel title="Settlement model" description="Suggested production data model.">
        <DataTable
          rows={[
            { id: "Usage feed", purpose: "Raw usage records from billing, CDR, or carrier files" },
            { id: "Rated usage", purpose: "Usage after product and customer pricing rules" },
            { id: "Carrier cost", purpose: "Partner wholesale cost or access expense" },
            { id: "Variance", purpose: "Margin leakage, dispute, or settlement adjustment" }
          ]}
          columns={[
            { key: "id", label: "Object" },
            { key: "purpose", label: "Purpose" }
          ]}
        />
      </Panel>
    </>
  );
}

function Architecture() {
  return (
    <>
      <PageHeader title="Platform Blueprint" description="How this UI can become a deployable telecom SaaS product across isolated customer environments." />
      <section className="overview-grid">
        <MetricCard label="Codebase" value="One" delta="Same UI and module library" />
        <MetricCard label="Tenants" value="Many" delta="Shared or dedicated environment" />
        <MetricCard label="Data model" value="Hybrid" delta="Managed or customer-owned" />
        <MetricCard label="Azure path" value="Modular" delta="Start lean, scale by customer tier" />
      </section>
      <section className="ops-split">
        <Panel title="Deployment models" description="Use the same product UI while isolating customer data and integrations.">
          <DataTable
            rows={tenantOptions}
            columns={[
              { key: "name", label: "Model" },
              { key: "fit", label: "Fit" },
              { key: "model", label: "Architecture" },
              { key: "monthly", label: "Indicative pricing" }
            ]}
          />
        </Panel>
        <Panel title="Offer packaging" description="Module pricing plus optional consulting and managed data services.">
          <DataTable
            rows={packageTiers}
            columns={[
              { key: "tier", label: "Tier" },
              { key: "target", label: "Target" },
              { key: "base", label: "Platform" },
              { key: "implementation", label: "Consulting" }
            ]}
          />
        </Panel>
      </section>
      <Panel title="Realistic Azure service map" description="Services needed to turn this frontend into a production platform.">
        <DataTable
          rows={azurePlan.map(([area, service, purpose]) => ({ id: area, service, purpose }))}
          columns={[
            { key: "id", label: "Area" },
            { key: "service", label: "Azure service" },
            { key: "purpose", label: "Purpose" }
          ]}
        />
      </Panel>
    </>
  );
}

function DetailPage({ route, setRoute }) {
  const [, type, id] = route.split("/");
  const allItems = [...leads, ...opportunities, ...quotes, ...customers, ...services, ...tickets, ...networkEvents, ...invoices, ...orders];
  const item = allItems.find(record => record.id === id);

  if (!item) {
    return (
      <>
        <PageHeader title="Record not found" description="The selected demo record is not available in the current data layer." />
        <button className="button" type="button" onClick={() => setRoute("dashboard")}>Back to home</button>
      </>
    );
  }

  return (
    <>
      <PageHeader title={id} description={`Detail view for ${type}. This is ready to be backed by a record API and audit trail.`} actions={<button className="ghost-button" type="button" onClick={() => setRoute("dashboard")}>Back</button>} />
      <Panel title="Record payload" description="Current demo record fields.">
        <DataTable
          rows={Object.entries(item).map(([key, value]) => ({ id: key, key, value: Array.isArray(value) ? value.join(", ") : String(value) }))}
          columns={[
            { key: "key", label: "Field" },
            { key: "value", label: "Value" }
          ]}
        />
      </Panel>
    </>
  );
}

function RouteSwitch({ route, setRoute }) {
  if (route.startsWith("details/")) return <DetailPage route={route} setRoute={setRoute} />;

  const routes = {
    dashboard: <Dashboard setRoute={setRoute} />,
    sales: <Sales setRoute={setRoute} />,
    pricing: <Pricing />,
    products: <Products />,
    "customer-service": <CustomerService />,
    "customer-360": <Customer360 />,
    billing: <Billing />,
    orders: <Orders />,
    reports: <Reports />,
    network: <Network />,
    "service-management": <ServiceManagement />,
    provisioning: <Provisioning />,
    "carrier-settlement": <CarrierSettlement />,
    architecture: <Architecture />
  };

  return routes[route] || <Dashboard setRoute={setRoute} />;
}

export default function PlatformApp() {
  const [route, setRoute] = useHashRoute();
  const bodyPage = route.split("/")[0] || "dashboard";

  useEffect(() => {
    document.body.dataset.page = bodyPage === "dashboard" ? "index" : bodyPage;
  }, [bodyPage]);

  return (
    <Shell activeRoute={bodyPage} setRoute={setRoute}>
      <RouteSwitch route={route} setRoute={setRoute} />
    </Shell>
  );
}
