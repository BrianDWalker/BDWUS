export const navGroups = [
  {
    label: "Command",
    items: [
      { id: "dashboard", label: "Home", icon: "dashboard" },
      { id: "reports", label: "Reports", icon: "reports" }
    ]
  },
  {
    label: "Commercial",
    items: [
      { id: "sales", label: "Sales", icon: "sales" },
      { id: "orders", label: "Orders", icon: "orders" },
      { id: "product-pricing", label: "Product & Pricing", icon: "pricing" }
    ]
  },
  {
    label: "Customer",
    items: [
      { id: "customer-service", label: "Customer Service", icon: "serviceDesk" },
      { id: "customer-360", label: "Customer 360", icon: "customerSearch" },
      { id: "billing", label: "Billing", icon: "billing" }
    ]
  },
  {
    label: "Network & Service",
    items: [
      { id: "network", label: "Network", icon: "network" },
      { id: "service-management", label: "Service Mgmt", icon: "service" },
      { id: "provisioning", label: "Provisioning", icon: "provisioning" }
    ]
  },
  {
    label: "Finance",
    items: [
      { id: "carrier-settlement", label: "Carrier Settlement", icon: "finance" }
    ]
  }
];

export const topNavSections = [
  {
    id: "dashboard",
    label: "Home",
    icon: "dashboard",
    route: "dashboard",
    routes: ["dashboard"]
  },
  {
    id: "sales",
    label: "Sales",
    icon: "sales",
    route: "sales",
    routes: ["sales", "details/opportunity", "details/lead", "details/quote"]
  },
  {
    id: "customer-360",
    label: "Customer 360",
    icon: "customerSearch",
    route: "customer-360",
    routes: ["customer-360", "customer-service", "details/billing-account", "details/invoice", "details/service"]
  },
  {
    id: "orders",
    label: "Orders",
    icon: "orders",
    route: "orders",
    routes: ["orders", "details/order"]
  },
  {
    id: "product-pricing",
    label: "Product & Pricing",
    icon: "pricing",
    route: "product-pricing",
    routes: ["product-pricing", "details/product", "details/product-pricing"]
  },
  {
    id: "network",
    label: "Network & Service",
    icon: "network",
    route: "network",
    routes: ["network", "service-management", "provisioning", "carrier-settlement"]
  },
  {
    id: "billing",
    label: "Billing",
    icon: "billing",
    route: "billing",
    routes: ["billing", "details/invoice", "details/billing-account"]
  },
  {
    id: "reports",
    label: "Reports",
    icon: "reports",
    route: "reports",
    routes: ["reports"]
  },
  {
    id: "administration",
    label: "Administration",
    icon: "settings",
    route: "administration",
    routes: ["administration"]
  }
];

export const customers = [
  {
    id: "CUST-1001",
    name: "Apex Health",
    segment: "Enterprise",
    region: "Midwest",
    contact: "Mara Ellis",
    mrr: 1480000,
    health: 72,
    churnRisk: "Medium",
    billingProfile: "Net 30, tax exempt, consolidated bill",
    services: ["Fiber 1G", "Cloud Voice", "SLA Support"],
    inactiveServices: ["Managed Firewall 2019"],
    activeOffers: ["Enterprise loyalty credit", "Cloud voice renewal"],
    inactiveOffers: ["Q4 fiber burst promo"],
    attributes: ["HIPAA", "High availability", "Executive sponsor"]
  },
  {
    id: "CUST-1002",
    name: "Brightstar Retail",
    segment: "SMB",
    region: "Southeast",
    contact: "Nolan Pierce",
    mrr: 228300,
    health: 61,
    churnRisk: "High",
    billingProfile: "Net 15, card autopay, store-level detail",
    services: ["Mobile Plus", "Fiber 500"],
    inactiveServices: ["Legacy DSL"],
    activeOffers: ["Retail continuity bundle"],
    inactiveOffers: ["Seasonal SIM promo"],
    attributes: ["Multi-location", "High call volume", "Collections watch"]
  },
  {
    id: "CUST-1003",
    name: "Metro Logistics",
    segment: "Enterprise",
    region: "Southwest",
    contact: "Devin Rowe",
    mrr: 336200,
    health: 84,
    churnRisk: "Low",
    billingProfile: "Net 45, PO required, usage summary",
    services: ["SD-WAN", "DIA"],
    inactiveServices: ["Legacy MPLS"],
    activeOffers: ["SD-WAN branch expansion"],
    inactiveOffers: ["Voice seat discount"],
    attributes: ["Logistics", "Multi-region", "Gold SLA"]
  },
  {
    id: "CUST-1004",
    name: "Summit Manufacturing",
    segment: "Enterprise",
    region: "West Coast",
    contact: "Iris Chen",
    mrr: 189500,
    health: 69,
    churnRisk: "Medium",
    billingProfile: "Net 30, cost center split",
    services: ["IoT SIM", "Mobile Plus"],
    inactiveServices: ["Temporary LTE failover"],
    activeOffers: ["IoT fleet accelerator"],
    inactiveOffers: ["Pilot SIM credit"],
    attributes: ["IoT heavy", "Factory sites", "Device lifecycle"]
  },
  {
    id: "CUST-1005",
    name: "Coastal Health Partners",
    segment: "Enterprise",
    region: "Southeast",
    contact: "Priya Shah",
    mrr: 319300,
    health: 58,
    churnRisk: "High",
    billingProfile: "Net 30, parent-child hierarchy",
    services: ["DIA", "Managed Router"],
    inactiveServices: ["PRI Voice"],
    activeOffers: ["SLA remediation credit"],
    inactiveOffers: ["Router refresh promo"],
    attributes: ["Outage sensitive", "Credit review", "Care escalation"]
  }
];

export const leads = [
  { id: "LEAD-441", customerId: "CUST-1001", account: "Apex Health", source: "Partner referral", stage: "Qualified", product: "Fiber 500", estValue: 74200, owner: "Tia Brooks" },
  { id: "LEAD-446", customerId: "CUST-1002", account: "Brightstar Retail", source: "Website", stage: "Discovery", product: "Cloud Voice", estValue: 51800, owner: "Sam Malik" },
  { id: "LEAD-452", customerId: "CUST-1004", account: "Summit Manufacturing", source: "Outbound", stage: "Needs analysis", product: "SD-WAN", estValue: 146900, owner: "Ari Fox" }
];

export const opportunities = [
  { id: "OPP-812", customerId: "CUST-1001", name: "Hospital campus bandwidth uplift", stage: "Contracting", value: 416700, closeDate: "2026-06-04", probability: 82 },
  { id: "OPP-827", customerId: "CUST-1004", name: "IoT fleet expansion", stage: "Solutioning", value: 198210, closeDate: "2026-06-18", probability: 64 },
  { id: "OPP-833", customerId: "CUST-1002", name: "Store continuity bundle", stage: "Proposal", value: 84900, closeDate: "2026-05-28", probability: 58 }
];

export const quotes = [
  { id: "Q-2048", opportunityId: "OPP-812", customerId: "CUST-1001", package: "Fiber + Voice Expansion", value: 216700, margin: 39.8, status: "Approval", customPrice: true },
  { id: "Q-2052", opportunityId: "OPP-827", customerId: "CUST-1004", package: "IoT Fleet SIM Bundle", value: 98210, margin: 22.5, status: "Draft", customPrice: true },
  { id: "Q-2061", opportunityId: "OPP-833", customerId: "CUST-1002", package: "Retail Continuity Pack", value: 54900, margin: 35.7, status: "Sent", customPrice: false }
];

export const pricingPrograms = [
  { id: "PROMO-1", name: "Fiber Winback", type: "Promo", discount: "12%", segment: "SMB", status: "Active", lift: "8.4%" },
  { id: "PROMO-2", name: "Enterprise Renewal Guardrail", type: "Strategic", discount: "Custom", segment: "Enterprise", status: "Approval", lift: "3.1%" },
  { id: "PROMO-3", name: "IoT Device Ramp", type: "Offer", discount: "$2/SIM", segment: "Industrial", status: "Active", lift: "11.2%" }
];

export const pricingCoefficients = [
  { id: "COEF-1", name: "Market fiber density", weight: 0.34, signal: "High", drift: "+2.1%" },
  { id: "COEF-2", name: "Competitor pressure", weight: 0.27, signal: "Elevated", drift: "+5.8%" },
  { id: "COEF-3", name: "Contract term uplift", weight: 0.18, signal: "Stable", drift: "-0.6%" },
  { id: "COEF-4", name: "Care risk discount", weight: 0.21, signal: "Watch", drift: "+3.4%" }
];

export const services = [
  { id: "SVC-01", productType: "Fiber", product: "Broadband", name: "Fiber 1G", family: "Fixed Broadband", subProducts: ["Static IP", "Managed Router", "SLA Plus"], owner: "Rhea Patel", productManager: "Rhea Patel", pricingManager: "Cal Brooks", revenue: 8120000, cost: 4590000, margin: 43.5, lifecycle: "Growth", status: "Live" },
  { id: "SVC-02", productType: "Mobility", product: "IoT", name: "Mobile Plus", family: "Wireless", subProducts: ["Shared Data", "Roaming", "Device Care"], owner: "Marcus Lee", productManager: "Marcus Lee", pricingManager: "Ivy Nguyen", revenue: 4210000, cost: 2910000, margin: 30.9, lifecycle: "Mature", status: "Live" },
  { id: "SVC-03", productType: "Voice Services", product: "BVoIP", name: "Cloud Voice", family: "Voice", subProducts: ["PBX", "Call Recording", "E911"], owner: "Nadia Stone", productManager: "Nadia Stone", pricingManager: "Cal Brooks", revenue: 2380000, cost: 1710000, margin: 28.2, lifecycle: "Refresh", status: "Review" },
  { id: "SVC-04", productType: "Ethernet", product: "Dedicated Ethernet", name: "SD-WAN", family: "Managed Network", subProducts: ["Edge CPE", "Zero Trust", "Analytics"], owner: "Jon Bell", productManager: "Jon Bell", pricingManager: "Maya Ortiz", revenue: 5120000, cost: 3150000, margin: 38.5, lifecycle: "Growth", status: "Live" },
  { id: "SVC-05", productType: "Mobility", product: "IoT", name: "IoT SIM", family: "Wireless", subProducts: ["Telemetry", "Device Pool", "Private APN"], owner: "Iris Chen", productManager: "Iris Chen", pricingManager: "Ivy Nguyen", revenue: 1190000, cost: 918000, margin: 22.8, lifecycle: "Launch", status: "Optimize" }
];

export const invoices = [
  {
    id: "INV-8841",
    customerId: "CUST-1001",
    amount: 512800,
    status: "Approved",
    aging: 12,
    due: "2026-05-20",
    usage: "32.4 TB",
    lineItems: [
      { description: "Fiber 1G campus access", qty: 12, amount: 318000 },
      { description: "Cloud voice seats", qty: 840, amount: 112800 },
      { description: "SLA support", qty: 1, amount: 82000 }
    ]
  },
  {
    id: "INV-8842",
    customerId: "CUST-1002",
    amount: 125430,
    status: "Priority",
    aging: 68,
    due: "2026-05-16",
    usage: "9.8 TB",
    lineItems: [
      { description: "Mobile Plus pooled data", qty: 418, amount: 84300 },
      { description: "Fiber retail sites", qty: 38, amount: 41130 }
    ]
  },
  {
    id: "INV-8843",
    customerId: "CUST-1005",
    amount: 18200,
    status: "Review",
    aging: 91,
    due: "2026-05-12",
    usage: "SLA credit",
    lineItems: [
      { description: "DIA monthly recurring", qty: 1, amount: 28400 },
      { description: "Outage SLA credit", qty: 1, amount: -10200 }
    ]
  },
  {
    id: "INV-8844",
    customerId: "CUST-1003",
    amount: 88410,
    status: "Current",
    aging: 8,
    due: "2026-05-24",
    usage: "18.2 TB",
    lineItems: [
      { description: "SD-WAN managed sites", qty: 52, amount: 62400 },
      { description: "DIA transport", qty: 4, amount: 26010 }
    ]
  }
];

export const adjustments = [
  { id: "ADJ-19", customerId: "CUST-1005", type: "SLA credit", amount: -10200, status: "Pending approval" },
  { id: "ADJ-22", customerId: "CUST-1002", type: "Usage dispute", amount: -4200, status: "Research" },
  { id: "ADJ-27", customerId: "CUST-1001", type: "Contract true-up", amount: 18800, status: "Posted" }
];

export const orders = [
  { id: "ORD-2048", source: "Quote Q-2048", customerId: "CUST-1001", service: "Fiber 1G", status: "Staged", owner: "Provisioning Ops", due: "2026-05-16", modifiable: true },
  { id: "ORD-2067", source: "Lead LEAD-452", customerId: "CUST-1004", service: "Mobile Plus", status: "Assigned", owner: "Service Desk", due: "2026-05-14", modifiable: true },
  { id: "ORD-2012", source: "Opportunity OPP-833", customerId: "CUST-1003", service: "Cloud Voice", status: "Ready", owner: "Network Ops", due: "2026-05-12", modifiable: false }
];

export const tickets = [
  { id: "TKT-301", customerId: "CUST-1002", type: "Network outage reported", category: "Network", priority: "Urgent", status: "Open", ageHours: 48 },
  { id: "TKT-302", customerId: "CUST-1001", type: "Billing inquiry", category: "Billing", priority: "Focus", status: "Active", ageHours: 18 },
  { id: "TKT-303", customerId: "CUST-1003", type: "Install follow-up", category: "Orders", priority: "Normal", status: "Scheduled", ageHours: 9 },
  { id: "TKT-304", customerId: "CUST-1005", type: "SLA credit request", category: "Billing", priority: "High", status: "Research", ageHours: 72 }
];

export const networkEvents = [
  { id: "NET-41", customerId: "CUST-1005", market: "Atlanta", type: "Fiber aggregation loss", severity: "Critical", impacted: 412, slaExposure: 22900, customerReported: true },
  { id: "NET-42", customerId: "CUST-1001", market: "Chicago", type: "Peering saturation", severity: "Watch", impacted: 156, slaExposure: 8200, customerReported: false },
  { id: "NET-43", customerId: "CUST-1002", market: "Phoenix", type: "RAN backhaul jitter", severity: "Elevated", impacted: 88, slaExposure: 6210, customerReported: true }
];

export const reportDefinitions = [
  { id: "executive-scorecard", name: "Executive scorecard", area: "Home", description: "MRR, subscriber movement, quote conversion, NOC events, DSO." },
  { id: "sales-funnel", name: "Sales funnel and quote desk", area: "Sales", description: "Leads, opportunities, custom quotes, margin, and stage velocity." },
  { id: "pricing-coefficients", name: "Pricing coefficients monitor", area: "Pricing", description: "Coefficient drift, promo lift, discount exposure, and guardrail alerts." },
  { id: "product-pnl", name: "Product P&L lifecycle", area: "Products", description: "Revenue, cost, product owner, sub-product, lifecycle, and margin." },
  { id: "customer-care", name: "Customer care workload", area: "Care", description: "Tickets, outage reports, billing inquiries, aging, and priority." },
  { id: "billing-ledger", name: "Billing account ledger", area: "Billing", description: "Invoices, usage detail, services, offers, attributes, and adjustments." },
  { id: "order-operations", name: "Order operations", area: "Orders", description: "Orders from leads, opportunities, quotes, modification status, and due dates." },
  { id: "network-sla", name: "Network outage SLA credits", area: "NOC", description: "Outage credits and exposure by region." }
];

export const reportRows = [
  { reportId: "executive-scorecard", region: "Midwest", segment: "Enterprise", account: "Apex Health", service: "Fiber + Voice", amount: 1480000, metric: "30.9%", status: "Approved" },
  { reportId: "executive-scorecard", region: "Southeast", segment: "SMB", account: "Brightstar Retail", service: "Mobile + Fiber", amount: 228300, metric: "31.8%", status: "Open" },
  { reportId: "sales-funnel", region: "Midwest", segment: "Enterprise", account: "Apex Health", service: "Fiber + Voice Expansion", amount: 216700, metric: "82% close", status: "Contracting" },
  { reportId: "sales-funnel", region: "West Coast", segment: "Enterprise", account: "Summit Manufacturing", service: "IoT Fleet SIM Bundle", amount: 98210, metric: "64% close", status: "Solutioning" },
  { reportId: "pricing-coefficients", region: "All regions", segment: "SMB", account: "Pricing Desk", service: "Fiber Winback", amount: 74200, metric: "12% discount", status: "Active" },
  { reportId: "pricing-coefficients", region: "All regions", segment: "Enterprise", account: "Strategic Pricing", service: "Renewal Guardrail", amount: 416700, metric: "+5.8% drift", status: "Approval" },
  { reportId: "product-pnl", region: "Midwest", segment: "Enterprise", account: "Product P&L", service: "Fiber 1G", amount: 8120000, metric: "43.5%", status: "Growth" },
  { reportId: "product-pnl", region: "West Coast", segment: "Enterprise", account: "Product P&L", service: "IoT SIM", amount: 1190000, metric: "22.8%", status: "Launch" },
  { reportId: "customer-care", region: "Southeast", segment: "SMB", account: "Brightstar Retail", service: "Network outage reported", amount: 125430, metric: "48 hours", status: "Urgent" },
  { reportId: "customer-care", region: "Midwest", segment: "Enterprise", account: "Apex Health", service: "Billing inquiry", amount: 512800, metric: "18 hours", status: "Active" },
  { reportId: "billing-ledger", region: "Southeast", segment: "Enterprise", account: "Coastal Health Partners", service: "DIA", amount: 18200, metric: "91 days", status: "Review" },
  { reportId: "billing-ledger", region: "Southwest", segment: "Enterprise", account: "Metro Logistics", service: "SD-WAN", amount: 88410, metric: "8 days", status: "Current" },
  { reportId: "order-operations", region: "Midwest", segment: "Enterprise", account: "Apex Health", service: "Fiber 1G", amount: 216700, metric: "Due May 16", status: "Staged" },
  { reportId: "order-operations", region: "West Coast", segment: "Enterprise", account: "Summit Manufacturing", service: "Mobile Plus", amount: 98210, metric: "Modifiable", status: "Assigned" },
  { reportId: "network-sla", region: "Southeast", segment: "Enterprise", account: "Coastal Health Partners", service: "DIA", amount: 18200, metric: "1.2%", status: "Open" },
  { reportId: "network-sla", region: "Midwest", segment: "Enterprise", account: "Apex Health", service: "Fiber 500", amount: 22900, metric: "0.8%", status: "Pending" }
];
