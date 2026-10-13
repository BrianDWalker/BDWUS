import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/Shell";
import { DataTable, MetricCard, Panel, StatusTag, formatDate, formatMoney, statusTone } from "../../components/Primitives";
import { DetailHeader, DetailSummary, DetailTabs, EmptyState } from "../details/DetailShell";
import { fetchProductPricingOverview } from "../../utils/platformApi";
import {
  approveApproval,
  listApprovals,
  listBillingCodes,
  listBillingElements,
  listBillingProductHierarchy,
  listBillingProducts,
  listCustomPricing,
  listOffers,
  listPromotions,
  listRatePlans,
  rejectApproval,
  requestChangesApproval,
  submitCustomPricing
} from "../../utils/salesApi";

const DOMAIN_ORDER = ["wireline", "wireless", "custom"];

const DOMAIN_CONFIGS = {
  wireline: {
    label: "Wireline",
    route: "wireline",
    description: "Each product is a governed record with hierarchy, pricing, billing, docs, availability, and algorithm support.",
    accent: "wireline",
    landingBullets: [
      "Product hierarchy and catalog ownership",
      "Billing codes, billing elements, and docs",
      "Availability, pricing, and algorithm versions"
    ],
    tabs: [
      { key: "products", label: "Products", dataKey: "products", detailKind: "product", description: "Each wireline product record." },
      { key: "hierarchy", label: "Hierarchy", dataKey: "hierarchy", description: "Product parent and child relationships." },
      { key: "billing-codes", label: "Billing Codes", dataKey: "billingCodes", description: "Charge code mapping and service usage." },
      { key: "billing-elements", label: "Billing Elements", dataKey: "billingElements", description: "Reusable billing atoms and amounts." },
      { key: "docs", label: "Docs", dataKey: "docs", description: "Reference documentation and specs." },
      { key: "availability", label: "Availability", dataKey: "availability", description: "Region, footprint, and serviceability." },
      { key: "algorithms", label: "Algorithms", dataKey: "products", detailKind: "product", description: "Algorithm status and pricing logic per product." }
    ],
    detailTabs: ["Overview", "Attributes", "Pricing", "Availability", "Billing", "Docs", "Algorithm", "History"]
  },
  wireless: {
    label: "Wireless",
    route: "wireless",
    description: "Plans, offers, devices, and features become the core commercial objects with eligibility and promotions.",
    accent: "wireless",
    landingBullets: [
      "Plans and recurring pricing",
      "Offers, promotions, and eligibility",
      "Devices, features, and algorithm support"
    ],
    tabs: [
      { key: "plans", label: "Plans", dataKey: "plans", detailKind: "plan", description: "Recurring wireless plans." },
      { key: "offers", label: "Offers", dataKey: "offers", detailKind: "offer", description: "Commercial offers and bundles." },
      { key: "devices", label: "Devices", dataKey: "devices", detailKind: "device", description: "Compatible devices and equipment." },
      { key: "features", label: "Features", dataKey: "features", detailKind: "feature", description: "Feature catalog and entitlements." },
      { key: "promotions", label: "Promotions", dataKey: "promotions", description: "Campaign discounts and incentives." },
      { key: "eligibility", label: "Eligibility", dataKey: "eligibility", description: "Network, segment, and market rules." }
    ],
    detailTabs: ["Overview", "Attributes", "Pricing", "Availability", "Billing", "Docs", "Algorithm", "History"]
  },
  custom: {
    label: "Custom",
    route: "custom",
    description: "A governed approval queue and custom algorithm library for exceptions, simulations, and version review.",
    accent: "custom",
    landingBullets: [
      "Approval queue for custom pricing requests",
      "Custom algorithm library and exceptions",
      "Simulation, review, and version controls"
    ],
    tabs: [
      { key: "queue", label: "Approval Queue", dataKey: "queue", detailKind: "queue", description: "Pricing requests waiting on review." },
      { key: "library", label: "Algo Library", dataKey: "library", detailKind: "algorithm", description: "Reusable custom algorithm templates." },
      { key: "exceptions", label: "Exceptions", dataKey: "exceptions", detailKind: "exception", description: "Deal and pricing exceptions." },
      { key: "simulation", label: "Simulation", dataKey: "simulations", detailKind: "simulation", description: "What-if and margin scenarios." },
      { key: "versions", label: "Versions", dataKey: "versions", detailKind: "version", description: "Reviewable version history." }
    ],
    detailTabs: ["Overview", "Review", "Rules", "Simulation", "History"]
  }
};

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeText(value, fallback = "-") {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function buildRecordId(...values) {
  const first = values.find(Boolean);
  return slugify(first || "record");
}

function normalizeProduct(row = {}) {
  const code = row.ProductCode || row.productCode || row.code || row.ProductName || row.name || row.id;
  const name = row.ProductName || row.productName || row.name || code;
  const id = buildRecordId(row.ProductId || row.productId || row.id || code, code, name);
  return {
    id,
    domain: "wireline",
    kind: "product",
    code: normalizeText(code, id),
    name: normalizeText(name, id),
    status: row.Status || row.status || "Draft",
    category: row.Category || row.category || "Wireline",
    serviceCategory: row.ServiceCategory || row.serviceCategory || "Service",
    billingCode: row.BillingCode || row.billingCode || "",
    baseMrc: toNumber(row.BaseMrc ?? row.baseMrc ?? 0),
    baseNrc: toNumber(row.BaseNrc ?? row.baseNrc ?? 0),
    description: row.Description || row.description || "Wireline catalog product",
    source: "Billing catalog"
  };
}

function normalizeHierarchy(row = {}, index = 0) {
  const productName = row.ProductName || row.productName || "Product";
  const billingCode = row.BillingCode || row.billingCode || "";
  return {
    id: buildRecordId(productName, billingCode, index),
    domain: "wireline",
    kind: "hierarchy",
    productName,
    path: row.HierarchyPath || row.hierarchyPath || row.Path || "",
    billingCode,
    displayOrder: row.DisplayOrder ?? row.displayOrder ?? index + 1
  };
}

function normalizeBillingCode(row = {}, index = 0) {
  const code = row.Code || row.code || row.BillingCode || row.billingCode || `CODE-${index + 1}`;
  return {
    id: buildRecordId(code, row.Description || row.description, index),
    domain: "wireline",
    kind: "billing-code",
    code,
    description: row.Description || row.description || "",
    billingType: row.BillingType || row.billingType || "Recurring"
  };
}

function normalizeBillingElement(row = {}, index = 0) {
  const name = row.ElementName || row.elementName || row.Name || `Element ${index + 1}`;
  return {
    id: buildRecordId(name, index),
    domain: "wireline",
    kind: "billing-element",
    name,
    elementType: row.ElementType || row.elementType || "Charge",
    amount: toNumber(row.Amount ?? row.amount ?? 0)
  };
}

function normalizeOffer(row = {}, index = 0) {
  const code = row.OfferCode || row.offerCode || row.Code || `OFFER-${index + 1}`;
  const name = row.OfferName || row.offerName || row.Name || code;
  return {
    id: buildRecordId(code, name, index),
    domain: "wireless",
    kind: "offer",
    code,
    name,
    offerType: row.OfferType || row.offerType || "Commercial",
    eligibility: row.Eligibility || row.eligibility || "Standard",
    status: row.Status || row.status || "Draft",
    summary: row.Summary || `${name} commercial offer`
  };
}

function normalizePromotion(row = {}, index = 0) {
  const code = row.PromotionCode || row.promotionCode || `PROMO-${index + 1}`;
  const name = row.PromotionName || row.promotionName || code;
  return {
    id: buildRecordId(code, name, index),
    domain: "wireless",
    kind: "promotion",
    code,
    name,
    promotionType: row.PromotionType || row.promotionType || "Discount",
    discountPct: row.DiscountPct ?? row.discountPct ?? "",
    status: row.Status || row.status || "Planned"
  };
}

function normalizeRatePlan(row = {}, index = 0) {
  const code = row.PlanCode || row.planCode || `PLAN-${index + 1}`;
  const name = row.PlanName || row.planName || code;
  return {
    id: buildRecordId(code, name, index),
    domain: "wireless",
    kind: "plan",
    code,
    name,
    planTier: row.PlanTier || row.planTier || "Standard",
    billingFrequency: row.BillingFrequency || row.billingFrequency || "Monthly",
    monthlyBaseFee: toNumber(row.MonthlyBaseFee ?? row.monthlyBaseFee ?? 0),
    minimumCommitment: toNumber(row.MinimumCommitment ?? row.minimumCommitment ?? 0),
    status: row.Status || row.status || "Active"
  };
}

function normalizeApproval(row = {}, index = 0) {
  const approvalId = row.ApprovalId || row.approvalId || row.id || `approval-${index + 1}`;
  return {
    id: buildRecordId(approvalId, index),
    domain: "custom",
    kind: "queue",
    approvalId,
    entityType: row.EntityType || row.entityType || "Pricing",
    stepName: row.StepName || row.stepName || "Review",
    status: row.Status || row.status || "Pending",
    requestedBy: row.RequestedBy || row.requestedBy || "Unknown",
    requestedAt: row.RequestedAtUtc || row.requestedAtUtc || row.createdAtUtc || "",
    requestedChanges: row.RequestedChanges || row.requestedChanges || "",
    targetName: row.TargetName || row.targetName || row.EntityName || "Custom pricing",
    notes: row.Notes || row.notes || ""
  };
}

function normalizeCustomPricing(row = {}, index = 0) {
  const requestNumber = row.RequestNumber || row.requestNumber || row.CustomPricingRequestId || `REQ-${index + 1}`;
  return {
    id: buildRecordId(requestNumber, row.CustomPricingRequestId || index),
    domain: "custom",
    kind: "exception",
    requestId: row.CustomPricingRequestId || row.customPricingRequestId || row.id || requestNumber,
    requestNumber,
    status: row.Status || row.status || "Draft",
    requestedBy: row.RequestedBy || row.requestedBy || "Unknown",
    reason: row.Reason || row.reason || "Custom pricing request",
    summary: row.Reason || "Review and exception workflow"
  };
}

function makeWirelineAvailability(product, index) {
  const footprints = ["Core", "Expansion", "Regional", "Legacy"];
  const regions = ["Northeast", "South", "Midwest", "West"];
  return {
    id: `${product.id}-availability`,
    domain: "wireline",
    kind: "availability",
    name: product.name,
    region: regions[index % regions.length],
    footprint: footprints[index % footprints.length],
    status: product.status === "Active" ? "Available" : "Planned",
    serviceability: index % 3 === 0 ? "Requires validation" : "Ready"
  };
}

function makeWirelineDoc(product, index) {
  return {
    id: `${product.id}-doc`,
    domain: "wireline",
    kind: "doc",
    title: `${product.name} reference guide`,
    docType: index % 2 === 0 ? "Spec" : "Pricing note",
    owner: "Product Management",
    status: product.status === "Active" ? "Published" : "Draft",
    updatedAt: `2025-0${(index % 9) + 1}-15`
  };
}

function makeWirelineAlgorithm(product, index) {
  return {
    id: `${product.id}-algorithm`,
    domain: "wireline",
    kind: "algorithm",
    name: `${product.name} pricing algorithm`,
    version: `v${index + 1}.0`,
    owner: "Pricing Operations",
    status: product.status === "Active" ? "Published" : "Draft",
    objective: "Base MRC, discount, surcharge, and billing code governance.",
    effectiveDate: `2025-05-${String(10 + index).padStart(2, "0")}`
  };
}

function makeWirelessDevice(plan, index) {
  const names = ["Edge Phone X", "Rugged Tablet Pro", "5G Hotspot Max", "Field Router 7"];
  return {
    id: `${plan.id}-device`,
    domain: "wireless",
    kind: "device",
    name: names[index % names.length],
    compatiblePlan: plan.name,
    carrierLock: index % 2 === 0 ? "Unlocked" : "Certified only",
    status: index % 3 === 0 ? "Ready" : "Draft"
  };
}

function makeWirelessFeature(plan, index) {
  const names = ["Unlimited hotspot", "Device protection", "International roaming", "Priority data"];
  return {
    id: `${plan.id}-feature`,
    domain: "wireless",
    kind: "feature",
    name: names[index % names.length],
    planName: plan.name,
    status: plan.status === "Active" ? "Available" : "Planned",
    rule: index % 2 === 0 ? "Included in premium tiers" : "Add-on or entitlement"
  };
}

function makeWirelessEligibility(plan, offer, promotion, index) {
  return {
    id: `${plan.id}-eligibility`,
    domain: "wireless",
    kind: "eligibility",
    name: `${plan.name} eligibility`,
    market: ["National", "Urban", "Enterprise", "Channel"][index % 4],
    rule: offer ? `${offer.name} + ${plan.planTier}` : plan.planTier,
    status: promotion && String(promotion.status).toLowerCase() === "active" ? "Eligible" : "Review"
  };
}

function makeCustomAlgorithm(row, index) {
  return {
    id: `${row.id}-algo`,
    domain: "custom",
    kind: "algorithm",
    name: `${normalizeText(row.targetName, "Custom")} algorithm`,
    version: `v${index + 1}.0`,
    status: row.status === "Approved" ? "Active" : "Draft",
    objective: row.reason || "Custom pricing and exception logic",
    owner: row.requestedBy || "Pricing Operations"
  };
}

function makeCustomSimulation(row, index) {
  return {
    id: `${row.id}-simulation`,
    domain: "custom",
    kind: "simulation",
    name: `${normalizeText(row.targetName, "Scenario")} simulation`,
    scenario: index % 2 === 0 ? "Margin compression" : "Approval impact",
    status: index % 2 === 0 ? "Pass" : "Review",
    summary: row.reason || "What-if review"
  };
}

function makeCustomVersion(row, index) {
  return {
    id: `${row.id}-version`,
    domain: "custom",
    kind: "version",
    name: `${normalizeText(row.targetName, "Algorithm")} ${index + 1}`,
    status: row.status === "Approved" ? "Published" : "Draft",
    approvedBy: row.requestedBy || "Pricing Manager",
    effectiveDate: `2025-05-${String(8 + index).padStart(2, "0")}`
  };
}

function makeCustomException(row, index) {
  return {
    id: `${row.id}-exception`,
    domain: "custom",
    kind: "exception",
    name: `${normalizeText(row.targetName, "Exception")} exception`,
    reason: row.reason || "Price override",
    status: row.status || "Draft",
    severity: index % 2 === 0 ? "High" : "Medium"
  };
}

function buildWorkspaceData({
  overview,
  products,
  hierarchy,
  billingCodes,
  billingElements,
  offers,
  promotions,
  ratePlans,
  approvals,
  customPricing
}) {
  const seedWirelineProducts = [
    { ProductId: "wireline-fiber-1g", ProductCode: "FIBER-1G", ProductName: "Fiber 1G", Category: "Wireline", ServiceCategory: "Broadband", BillingCode: "BNB-100", BaseMrc: 120, BaseNrc: 200, Status: "Active", Description: "Gigabit fiber access product" },
    { ProductId: "wireline-voice-plus", ProductCode: "VOICE-PLUS", ProductName: "Voice Plus", Category: "Wireline", ServiceCategory: "Voice", BillingCode: "VCE-220", BaseMrc: 35, BaseNrc: 0, Status: "Active", Description: "Business voice access product" },
    { ProductId: "wireline-mpls-core", ProductCode: "MPLS-CORE", ProductName: "MPLS Core", Category: "Wireline", ServiceCategory: "WAN", BillingCode: "WAN-310", BaseMrc: 240, BaseNrc: 350, Status: "Review", Description: "Managed WAN backbone service" }
  ];
  const seedWirelessPlans = [
    { PlanCode: "WIRELESS-UNL", PlanName: "Unlimited Premium", PlanTier: "Premium", BillingFrequency: "Monthly", MonthlyBaseFee: 95, MinimumCommitment: 0, Status: "Active" },
    { PlanCode: "WIRELESS-SMB", PlanName: "SMB Shared Data", PlanTier: "Standard", BillingFrequency: "Monthly", MonthlyBaseFee: 65, MinimumCommitment: 0, Status: "Active" },
    { PlanCode: "WIRELESS-ENTERPRISE", PlanName: "Enterprise Mobility", PlanTier: "Enterprise", BillingFrequency: "Monthly", MonthlyBaseFee: 125, MinimumCommitment: 500, Status: "Draft" }
  ];
  const seedOffers = [
    { OfferCode: "OFFER-5G", OfferName: "5G Launch Offer", OfferType: "Promotional", Eligibility: "National", Status: "Active" },
    { OfferCode: "OFFER-BYOD", OfferName: "BYOD Incentive", OfferType: "Discount", Eligibility: "Existing customer", Status: "Planned" }
  ];
  const seedPromotions = [
    { PromotionCode: "PROMO-NEW", PromotionName: "New Activations", PromotionType: "Discount", DiscountPct: 15, Status: "Active" },
    { PromotionCode: "PROMO-MIG", PromotionName: "Migration Bonus", PromotionType: "Credit", DiscountPct: 10, Status: "Planned" }
  ];
  const seedApprovals = [
    { ApprovalId: "APR-1001", EntityType: "Pricing", StepName: "Pricing Review", Status: "Pending", RequestedBy: "Commercial Ops", RequestedAtUtc: "2025-05-12T12:00:00Z", RequestedChanges: "Approve exception pricing for enterprise bundle", TargetName: "Enterprise bundle" },
    { ApprovalId: "APR-1002", EntityType: "Offer", StepName: "Governance", Status: "Review", RequestedBy: "Pricing Manager", RequestedAtUtc: "2025-05-13T12:00:00Z", RequestedChanges: "Validate promotion and discount caps", TargetName: "5G launch offer" }
  ];
  const seedCustomPricing = [
    { CustomPricingRequestId: "CPR-2001", RequestNumber: "CPR-2001", Status: "Draft", RequestedBy: "Commercial Ops", Reason: "Enterprise custom quote exception" },
    { CustomPricingRequestId: "CPR-2002", RequestNumber: "CPR-2002", Status: "Submitted", RequestedBy: "Pricing Manager", Reason: "Regional bundle deviation" }
  ];

  const wirelineProducts = ((products || []).length ? products : seedWirelineProducts).map(normalizeProduct);
  const wirelineHierarchy = ((hierarchy || []).length ? hierarchy : wirelineProducts.map((product, index) => ({
    ProductName: product.name,
    HierarchyPath: `${product.category} > ${product.name}`,
    BillingCode: product.billingCode,
    DisplayOrder: index + 1
  }))).map(normalizeHierarchy);
  const wirelineBillingCodes = ((billingCodes || []).length ? billingCodes : wirelineProducts.map((product, index) => ({
    Code: product.billingCode || `BILL-${index + 1}`,
    Description: `${product.name} charge code`,
    BillingType: index % 2 === 0 ? "Recurring" : "One-time"
  }))).map(normalizeBillingCode);
  const wirelineBillingElements = ((billingElements || []).length ? billingElements : wirelineProducts.map((product, index) => ({
    ElementName: `${product.name} element`,
    ElementType: index % 2 === 0 ? "Recurring" : "Usage",
    Amount: product.baseMrc || product.baseNrc || 0
  }))).map(normalizeBillingElement);
  const wirelineDocs = wirelineProducts.map(makeWirelineDoc);
  const wirelineAvailability = wirelineProducts.map(makeWirelineAvailability);
  const wirelineAlgorithms = wirelineProducts.map(makeWirelineAlgorithm);

  const wirelessPlans = ((ratePlans || []).length ? ratePlans : seedWirelessPlans).map(normalizeRatePlan);
  const wirelessOffers = ((offers || []).length ? offers : seedOffers).map(normalizeOffer);
  const wirelessPromotions = ((promotions || []).length ? promotions : seedPromotions).map(normalizePromotion);
  const wirelessDevices = wirelessPlans.map(makeWirelessDevice);
  const wirelessFeatures = wirelessPlans.map(makeWirelessFeature);
  const wirelessEligibility = wirelessPlans.map((plan, index) => makeWirelessEligibility(plan, wirelessOffers[index % Math.max(wirelessOffers.length, 1)], wirelessPromotions[index % Math.max(wirelessPromotions.length, 1)], index));

  const approvalRows = ((approvals || []).length ? approvals : seedApprovals).map(normalizeApproval);
  const customPricingRows = ((customPricing || []).length ? customPricing : seedCustomPricing).map(normalizeCustomPricing);
  const customQueue = approvalRows.length ? approvalRows : customPricingRows.map((row, index) => ({
    id: `${row.id}-queue`,
    domain: "custom",
    kind: "queue",
    approvalId: row.requestId,
    entityType: "Pricing",
    stepName: "Review",
    status: row.status,
    requestedBy: row.requestedBy,
    requestedAt: `2025-05-${String(10 + index).padStart(2, "0")}`,
    requestedChanges: row.reason,
    targetName: row.requestNumber,
    notes: row.reason
  }));
  const customAlgorithms = (customPricingRows.length ? customPricingRows : approvalRows).map(makeCustomAlgorithm);
  const customExceptions = customPricingRows.map(makeCustomException);
  const customSimulations = customQueue.map(makeCustomSimulation);
  const customVersions = customQueue.map(makeCustomVersion);

  const summary = {
    productCount: wirelineProducts.length,
    wirelineProductCount: wirelineProducts.length,
    wirelineHierarchyCount: wirelineHierarchy.length,
    wirelessPlanCount: wirelessPlans.length,
    wirelessOfferCount: wirelessOffers.length,
    customQueueCount: customQueue.length,
    customAlgorithmCount: customAlgorithms.length,
    approvalCount: approvalRows.length,
    ratePlanCount: wirelessPlans.length,
    offerCount: wirelessOffers.length,
    serviceCount: overview?.summary?.serviceCount ?? 0
  };

  return {
    summary,
    wireline: {
      products: wirelineProducts,
      hierarchy: wirelineHierarchy,
      billingCodes: wirelineBillingCodes,
      billingElements: wirelineBillingElements,
      docs: wirelineDocs,
      availability: wirelineAvailability,
      algorithms: wirelineAlgorithms
    },
    wireless: {
      plans: wirelessPlans,
      offers: wirelessOffers,
      devices: wirelessDevices,
      features: wirelessFeatures,
      promotions: wirelessPromotions,
      eligibility: wirelessEligibility,
      algorithms: wirelessPlans.map((plan, index) => ({
        id: `${plan.id}-algorithm`,
        domain: "wireless",
        kind: "algorithm",
        name: `${plan.name} rating logic`,
        version: `v${index + 1}.0`,
        owner: "Wireless Pricing",
        status: plan.status === "Active" ? "Published" : "Draft",
        objective: "Recurring fee, add-on, and entitlement routing."
      }))
    },
    custom: {
      queue: customQueue,
      library: customAlgorithms,
      exceptions: customExceptions,
      simulations: customSimulations,
      versions: customVersions,
      approvals: approvalRows,
      customPricing: customPricingRows
    }
  };
}

function routeParts(route = "") {
  const parts = String(route || "").split("/").filter(Boolean);
  const [root, domain = "", kind = "", recordId = "", subTab = ""] = parts;
  return {
    root,
    domain,
    kind,
    recordId: recordId ? decodeURIComponent(recordId) : "",
    subTab
  };
}

function routeForDomain(domain) {
  return `product-pricing/${domain}`;
}

function routeForRecord(domain, kind, recordId, subTab = "") {
  const base = `product-pricing/${domain}/${kind}/${encodeURIComponent(recordId)}`;
  return subTab ? `${base}/${slugify(subTab)}` : base;
}

function tabFromRoute(tabs, routeSubTab) {
  if (!routeSubTab) return tabs[0] || "Overview";
  const slug = slugify(routeSubTab);
  return tabs.find(tab => slugify(tab) === slug) || tabs[0] || "Overview";
}

function matchesQuery(row, query, fields) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return fields.some(field => normalizeText(field(row), "").toLowerCase().includes(needle));
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <label className="pp-search-box">
      <span>Search</span>
      <input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function WorkspaceTabs({ tabs, active, onChange }) {
  return (
    <div className="record-tabs" role="tablist">
      {tabs.map(tab => (
        <button key={tab} className={tab === active ? "active" : ""} type="button" onClick={() => onChange(tab)}>
          {tab}
        </button>
      ))}
    </div>
  );
}

function DomainLandingCard({ config, active, muted, onEnter }) {
  return (
    <article className={`pp-domain-card ${config.accent} ${active ? "is-selected" : ""} ${muted ? "is-muted" : ""}`.trim()}>
      <div className="pp-domain-card-top">
        <div>
          <strong>{config.label}</strong>
          <p>{config.description}</p>
        </div>
      </div>
      <div className="pp-bullet-list">
        {config.landingBullets.map(item => <span key={item}>{item}</span>)}
      </div>
      <div className="button-cluster">
        <button className="button" type="button" onClick={onEnter}>Open {config.label}</button>
      </div>
    </article>
  );
}

function LandingPage({ selectedDomain, onSelectDomain, showToast }) {
  const cards = DOMAIN_ORDER.map(domain => DOMAIN_CONFIGS[domain]);

  return (
    <>
      <PageHeader
        title="Product & Pricing"
        description="A governed catalog for Wireline, Wireless, and Custom pricing operations."
        actions={<div className="button-cluster"><button className="ghost-button" type="button" onClick={() => showToast?.("Catalog refreshed")}>Refresh</button></div>}
      />
      <section className="pp-landing-grid">
        {cards.map(domain => (
          <DomainLandingCard
            key={domain.route}
            config={domain}
            active={selectedDomain === domain.route}
            muted={Boolean(selectedDomain) && selectedDomain !== domain.route}
            onEnter={() => onSelectDomain(domain.route)}
          />
        ))}
      </section>
    </>
  );
}

function recordFieldsForDomain(domain, record, workspace) {
  if (domain === "wireline") {
    return [
      { label: "Code", value: record.code },
      { label: "Category", value: record.category },
      { label: "Service", value: record.serviceCategory },
      { label: "Billing code", value: record.billingCode || "-" },
      { label: "Status", value: record.status },
      { label: "Base MRC", value: formatMoney(record.baseMrc) }
    ];
  }
  if (domain === "wireless") {
    if (record.kind === "plan") {
      return [
        { label: "Code", value: record.code },
        { label: "Tier", value: record.planTier },
        { label: "Frequency", value: record.billingFrequency },
        { label: "Monthly fee", value: formatMoney(record.monthlyBaseFee) },
        { label: "Commitment", value: formatMoney(record.minimumCommitment) },
        { label: "Status", value: record.status }
      ];
    }
    if (record.kind === "offer") {
      return [
        { label: "Code", value: record.code },
        { label: "Type", value: record.offerType },
        { label: "Eligibility", value: record.eligibility },
        { label: "Status", value: record.status },
        { label: "Summary", value: record.summary }
      ];
    }
    if (record.kind === "device") {
      return [
        { label: "Device", value: record.name },
        { label: "Plan", value: record.compatiblePlan },
        { label: "Lock", value: record.carrierLock },
        { label: "Status", value: record.status }
      ];
    }
    return [
      { label: "Feature", value: record.name },
      { label: "Plan", value: record.planName },
      { label: "Rule", value: record.rule },
      { label: "Status", value: record.status }
    ];
  }
  if (record.kind === "algorithm") {
    return [
      { label: "Name", value: record.name },
      { label: "Version", value: record.version },
      { label: "Owner", value: record.owner || "-" },
      { label: "Status", value: record.status },
      { label: "Objective", value: record.objective || "-" }
    ];
  }
  if (record.kind === "simulation") {
    return [
      { label: "Scenario", value: record.name },
      { label: "Type", value: record.scenario },
      { label: "Status", value: record.status },
      { label: "Summary", value: record.summary }
    ];
  }
  if (record.kind === "version") {
    return [
      { label: "Version", value: record.name },
      { label: "Status", value: record.status },
      { label: "Approved by", value: record.approvedBy || "-" },
      { label: "Effective", value: record.effectiveDate || "-" }
    ];
  }
  return [
    { label: "Request", value: record.requestNumber || record.approvalId || record.name },
    { label: "Status", value: record.status },
    { label: "Owner", value: record.requestedBy || record.owner || "-" },
    { label: "Target", value: record.targetName || record.name || "-" }
  ];
}

function buildDetailTabs(domain, record, subTab) {
  const config = DOMAIN_CONFIGS[domain];
  return tabFromRoute(config.detailTabs, subTab);
}

function domainCollectionRows(domain, workspace) {
  return domain === "wireline"
    ? workspace.wireline
    : domain === "wireless"
      ? workspace.wireless
      : workspace.custom;
}

function CollectionToolbar({ query, setQuery, placeholder, action }) {
  return (
    <div className="pp-toolbar">
      <SearchBox value={query} onChange={setQuery} placeholder={placeholder} />
      {action}
    </div>
  );
}

function buildWirelineColumns(tab, setRoute) {
  const openProduct = row => setRoute(routeForRecord("wireline", "product", row.id));
  const openAlgorithm = row => setRoute(routeForRecord("wireline", "product", row.id, "algorithm"));

  if (tab.key === "products") {
    return [
      { key: "code", label: "Code" },
      { key: "name", label: "Product" },
      { key: "category", label: "Category" },
      { key: "serviceCategory", label: "Service" },
      { key: "billingCode", label: "Billing Code" },
      { key: "baseMrc", label: "MRC", render: row => formatMoney(row.baseMrc) },
      { key: "status", label: "Status", render: row => <StatusTag tone={statusTone(row.status)}>{row.status}</StatusTag> },
      { key: "actions", label: "", render: row => <button className="link-button compact-action" type="button" onClick={() => openProduct(row)}>Details</button> }
    ];
  }

  if (tab.key === "algorithms") {
    return [
      { key: "code", label: "Code" },
      { key: "name", label: "Product" },
      { key: "status", label: "Algorithm", render: row => <StatusTag tone={statusTone(row.status)}>{row.status}</StatusTag> },
      { key: "baseMrc", label: "Base MRC", render: row => formatMoney(row.baseMrc) },
      { key: "actions", label: "", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => openProduct(row)}>Open</button><button className="link-button compact-action" type="button" onClick={() => openAlgorithm(row)}>Algorithm</button></div> }
    ];
  }

  if (tab.key === "hierarchy") {
    return [
      { key: "productName", label: "Product" },
      { key: "path", label: "Path" },
      { key: "billingCode", label: "Billing Code" },
      { key: "displayOrder", label: "Order" }
    ];
  }

  if (tab.key === "billing-codes") {
    return [
      { key: "code", label: "Code" },
      { key: "description", label: "Description" },
      { key: "billingType", label: "Type" }
    ];
  }

  if (tab.key === "billing-elements") {
    return [
      { key: "name", label: "Element" },
      { key: "elementType", label: "Type" },
      { key: "amount", label: "Amount", render: row => formatMoney(row.amount) }
    ];
  }

  if (tab.key === "docs") {
    return [
      { key: "title", label: "Document" },
      { key: "docType", label: "Type" },
      { key: "owner", label: "Owner" },
      { key: "status", label: "Status", render: row => <StatusTag tone={statusTone(row.status)}>{row.status}</StatusTag> },
      { key: "updatedAt", label: "Updated", render: row => formatDate(row.updatedAt) }
    ];
  }

  if (tab.key === "availability") {
    return [
      { key: "name", label: "Product" },
      { key: "region", label: "Region" },
      { key: "footprint", label: "Footprint" },
      { key: "serviceability", label: "Serviceability" },
      { key: "status", label: "Status", render: row => <StatusTag tone={statusTone(row.status)}>{row.status}</StatusTag> }
    ];
  }

  return [];
}

function buildWirelessColumns(tab, setRoute) {
  const openRecord = row => setRoute(routeForRecord("wireless", row.kind, row.id));
  const openAlgorithm = row => setRoute(routeForRecord("wireless", row.kind, row.id, "algorithm"));

  if (tab.key === "plans") {
    return [
      { key: "code", label: "Code" },
      { key: "name", label: "Plan" },
      { key: "planTier", label: "Tier" },
      { key: "billingFrequency", label: "Frequency" },
      { key: "monthlyBaseFee", label: "Base Fee", render: row => formatMoney(row.monthlyBaseFee) },
      { key: "status", label: "Status", render: row => <StatusTag tone={statusTone(row.status)}>{row.status}</StatusTag> },
      { key: "actions", label: "", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => openRecord(row)}>Details</button><button className="link-button compact-action" type="button" onClick={() => openAlgorithm(row)}>Algorithm</button></div> }
    ];
  }

  if (tab.key === "offers") {
    return [
      { key: "code", label: "Code" },
      { key: "name", label: "Offer" },
      { key: "offerType", label: "Type" },
      { key: "eligibility", label: "Eligibility" },
      { key: "status", label: "Status", render: row => <StatusTag tone={statusTone(row.status)}>{row.status}</StatusTag> },
      { key: "actions", label: "", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => openRecord(row)}>Details</button><button className="link-button compact-action" type="button" onClick={() => openAlgorithm(row)}>Algorithm</button></div> }
    ];
  }

  if (tab.key === "devices") {
    return [
      { key: "name", label: "Device" },
      { key: "compatiblePlan", label: "Plan" },
      { key: "carrierLock", label: "Lock" },
      { key: "status", label: "Status", render: row => <StatusTag tone={statusTone(row.status)}>{row.status}</StatusTag> },
      { key: "actions", label: "", render: row => <button className="link-button compact-action" type="button" onClick={() => openRecord(row)}>Details</button> }
    ];
  }

  if (tab.key === "features") {
    return [
      { key: "name", label: "Feature" },
      { key: "planName", label: "Plan" },
      { key: "rule", label: "Rule" },
      { key: "status", label: "Status", render: row => <StatusTag tone={statusTone(row.status)}>{row.status}</StatusTag> }
    ];
  }

  if (tab.key === "promotions") {
    return [
      { key: "code", label: "Code" },
      { key: "name", label: "Promotion" },
      { key: "promotionType", label: "Type" },
      { key: "discountPct", label: "Discount %" },
      { key: "status", label: "Status", render: row => <StatusTag tone={statusTone(row.status)}>{row.status}</StatusTag> }
    ];
  }

  if (tab.key === "eligibility") {
    return [
      { key: "name", label: "Rule" },
      { key: "market", label: "Market" },
      { key: "rule", label: "Rule Logic" },
      { key: "status", label: "Status", render: row => <StatusTag tone={statusTone(row.status)}>{row.status}</StatusTag> }
    ];
  }

  return [];
}

function buildCustomColumns(tab, setRoute) {
  const openRecord = row => setRoute(routeForRecord("custom", row.kind, row.id));
  const openAlgorithm = row => setRoute(routeForRecord("custom", row.kind, row.id, "simulation"));

  if (tab.key === "queue") {
    return [
      { key: "approvalId", label: "Approval" },
      { key: "entityType", label: "Type" },
      { key: "stepName", label: "Step" },
      { key: "status", label: "Status", render: row => <StatusTag tone={statusTone(row.status)}>{row.status}</StatusTag> },
      { key: "requestedBy", label: "Requested By" },
      { key: "actions", label: "", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => openRecord(row)}>Review</button><button className="link-button compact-action" type="button" onClick={() => openAlgorithm(row)}>Simulation</button></div> }
    ];
  }

  if (tab.key === "library") {
    return [
      { key: "name", label: "Algorithm" },
      { key: "version", label: "Version" },
      { key: "owner", label: "Owner" },
      { key: "status", label: "Status", render: row => <StatusTag tone={statusTone(row.status)}>{row.status}</StatusTag> },
      { key: "objective", label: "Objective" },
      { key: "actions", label: "", render: row => <div className="table-row-actions"><button className="link-button compact-action" type="button" onClick={() => openRecord(row)}>Open</button><button className="link-button compact-action" type="button" onClick={() => openAlgorithm(row)}>Simulation</button></div> }
    ];
  }

  if (tab.key === "exceptions") {
    return [
      { key: "requestNumber", label: "Request" },
      { key: "status", label: "Status", render: row => <StatusTag tone={statusTone(row.status)}>{row.status}</StatusTag> },
      { key: "requestedBy", label: "Requested By" },
      { key: "reason", label: "Reason" },
      { key: "actions", label: "", render: row => <button className="link-button compact-action" type="button" onClick={() => openRecord(row)}>Details</button> }
    ];
  }

  if (tab.key === "simulation") {
    return [
      { key: "name", label: "Scenario" },
      { key: "scenario", label: "Type" },
      { key: "status", label: "Result", render: row => <StatusTag tone={statusTone(row.status)}>{row.status}</StatusTag> },
      { key: "summary", label: "Summary" }
    ];
  }

  if (tab.key === "versions") {
    return [
      { key: "name", label: "Version" },
      { key: "status", label: "Status", render: row => <StatusTag tone={statusTone(row.status)}>{row.status}</StatusTag> },
      { key: "approvedBy", label: "Approved By" },
      { key: "effectiveDate", label: "Effective" }
    ];
  }

  return [];
}

function detailActionButtons({ domain, record, baseRoute, setRoute, showToast, workspace, onApprovalChange }) {
  if (domain === "custom" && record.kind === "queue" && record.approvalId) {
    return (
      <div className="button-cluster">
        <button
          className="button"
          type="button"
          onClick={async () => {
            await approveApproval(record.approvalId, { approvedBy: "Pricing Manager" });
            showToast?.("Approval approved");
            onApprovalChange?.();
          }}
        >
          Approve
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={async () => {
            await requestChangesApproval(record.approvalId, { requestedChanges: "Please revise pricing and summary." });
            showToast?.("Changes requested");
            onApprovalChange?.();
          }}
        >
          Request Changes
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={async () => {
            await rejectApproval(record.approvalId, { approvedBy: "Pricing Manager" });
            showToast?.("Approval rejected");
            onApprovalChange?.();
          }}
        >
          Reject
        </button>
      </div>
    );
  }

  if (domain === "custom" && record.kind === "exception" && record.requestId) {
    return (
      <div className="button-cluster">
        <button
          className="button"
          type="button"
          onClick={async () => {
            await submitCustomPricing(record.requestId, { status: "Submitted" });
            showToast?.("Custom pricing submitted");
            onApprovalChange?.();
          }}
        >
          Submit
        </button>
        <button className="ghost-button" type="button" onClick={() => showToast?.("Simulation queued")}>Simulate</button>
      </div>
    );
  }

  return (
    <div className="button-cluster">
      <button className="button" type="button" onClick={() => setRoute?.(baseRoute)}>
        Back to {DOMAIN_CONFIGS[domain].label}
      </button>
      <button className="ghost-button" type="button" onClick={() => showToast?.("Snapshot refreshed")}>Refresh</button>
      <button className="ghost-button" type="button" onClick={() => setRoute?.(`${baseRoute}/${slugify("Algorithm")}`)}>Open Algorithm</button>
    </div>
  );
}

function DomainWorkspace({ domain, workspace, setRoute, showToast }) {
  const config = DOMAIN_CONFIGS[domain];
  const collection = domainCollectionRows(domain, workspace);
  const [activeTab, setActiveTab] = useState(config.tabs[0].key);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setActiveTab(config.tabs[0].key);
    setQuery("");
  }, [domain, config.tabs]);

  const selectedCollection = config.tabs.find(tab => tab.key === activeTab) || config.tabs[0];
  const rows = (domain === "wireline" ? collection.products : collection[selectedCollection.dataKey]) || [];
  const columns = domain === "wireline"
    ? buildWirelineColumns({ key: "products" }, setRoute)
    : domain === "wireless"
      ? buildWirelessColumns(selectedCollection, setRoute)
      : buildCustomColumns(selectedCollection, setRoute);
  const filteredRows = useMemo(() => {
    if (!query.trim()) return rows;
    const lookupFields = {
      wireline: [
        row => row.code,
        row => row.name,
        row => row.category,
        row => row.serviceCategory,
        row => row.billingCode,
        row => row.docType,
        row => row.title,
        row => row.region,
        row => row.footprint
      ],
      wireless: [
        row => row.code,
        row => row.name,
        row => row.planTier,
        row => row.billingFrequency,
        row => row.offerType,
        row => row.eligibility,
        row => row.carrierLock,
        row => row.rule
      ],
      custom: [
        row => row.approvalId,
        row => row.entityType,
        row => row.stepName,
        row => row.name,
        row => row.requestNumber,
        row => row.requestedBy,
        row => row.reason
      ]
    };
    return rows.filter(row => matchesQuery(row, query, lookupFields[domain]));
  }, [rows, query, domain]);

  return (
    <section id={`${domain}-catalog`} className="pp-workspace-section">
      <div className="pp-workspace-section-copy">
        <strong>{config.label}</strong>
        <p>{config.description}</p>
      </div>
      {domain !== "wireline" ? (
        <WorkspaceTabs tabs={config.tabs.map(tab => tab.label)} active={selectedCollection.label} onChange={label => setActiveTab(config.tabs.find(tab => tab.label === label)?.key || config.tabs[0].key)} />
      ) : null}
      <Panel
        title={domain === "wireline" ? "Products" : selectedCollection.label}
        description={domain === "wireline" ? "Each wireline product record." : selectedCollection.description}
        action={<CollectionToolbar query={query} setQuery={setQuery} placeholder={`Search ${domain === "wireline" ? "products" : selectedCollection.label.toLowerCase()}`} />}
      >
        <DataTable
          columns={columns}
          rows={filteredRows}
          onRowClick={selectedCollection.detailKind ? row => setRoute(routeForRecord(domain, selectedCollection.detailKind, row.id)) : undefined}
          emptyMessage={`No ${domain === "wireline" ? "products" : selectedCollection.label.toLowerCase()} found.`}
        />
      </Panel>
    </section>
  );
}

function renderWirelineDetailTab(tab, record, workspace, setRoute, showToast, detailBase) {
  if (!record) return <EmptyState>No wireline record found.</EmptyState>;

  if (tab === "Overview") {
    return (
      <section className="record-main-layout">
        <Panel title="Product summary" description="Catalog and commercial ownership.">
          <div className="field-grid compact-fields">
            <MetricCard label="Category" value={record.category} delta="Catalog family" />
            <MetricCard label="Service" value={record.serviceCategory} delta="Service mapping" />
            <MetricCard label="Billing code" value={record.billingCode || "-"} delta="Charge mapping" />
            <MetricCard label="Algorithm" value={workspace.wireline.algorithms.find(item => item.id.startsWith(record.id))?.version || "v1.0"} delta="Versioned logic" />
          </div>
        </Panel>
        <Panel title="Operating notes" description="What the product needs to stay synchronized.">
          <ul className="pp-detail-list">
            <li>Hierarchy, billing codes, and docs stay aligned with the record lifecycle.</li>
            <li>Availability and algorithm records control what can be sold and where.</li>
            <li>Changes should publish through the pricing governance flow instead of direct overwrite.</li>
          </ul>
        </Panel>
      </section>
    );
  }

  if (tab === "Attributes") {
    return (
      <Panel title="Attributes" description="Core product attributes and source data.">
        <DataTable
          columns={[
            { key: "label", label: "Field" },
            { key: "value", label: "Value" }
          ]}
          rows={[
            { id: "1", label: "Code", value: record.code },
            { id: "2", label: "Name", value: record.name },
            { id: "3", label: "Category", value: record.category },
            { id: "4", label: "Service category", value: record.serviceCategory },
            { id: "5", label: "Description", value: record.description },
            { id: "6", label: "Source", value: record.source }
          ]}
        />
      </Panel>
    );
  }

  if (tab === "Pricing") {
    return (
      <section className="record-main-layout">
        <Panel title="Pricing profile" description="Recurring and one-time pricing profile.">
          <div className="field-grid compact-fields">
            <MetricCard label="Base MRC" value={formatMoney(record.baseMrc)} delta="Recurring" />
            <MetricCard label="Base NRC" value={formatMoney(record.baseNrc)} delta="Non-recurring" />
            <MetricCard label="Billing code" value={record.billingCode || "-"} delta="Charge mapping" />
            <MetricCard label="Status" value={record.status} delta="Lifecycle state" />
          </div>
        </Panel>
        <Panel title="Algorithm links" description="Where pricing logic is managed.">
          <div className="pp-inline-links">
            <button className="button" type="button" onClick={() => setRoute?.(`${detailBase}/algorithm`)}>Open algorithm</button>
            <button className="ghost-button" type="button" onClick={() => showToast?.("Pricing scenario created")}>Run simulation</button>
          </div>
        </Panel>
      </section>
    );
  }

  if (tab === "Availability") {
    const availability = workspace.wireline.availability.filter(item => item.id.startsWith(record.id));
    return (
      <Panel title="Availability" description="Footprint and serviceability.">
        <DataTable
          columns={[
            { key: "region", label: "Region" },
            { key: "footprint", label: "Footprint" },
            { key: "serviceability", label: "Serviceability" },
            { key: "status", label: "Status", render: row => <StatusTag tone={statusTone(row.status)}>{row.status}</StatusTag> }
          ]}
          rows={availability.length ? availability : [{ id: "empty", region: "National", footprint: "Core", serviceability: "Ready", status: "Available" }]}
        />
      </Panel>
    );
  }

  if (tab === "Billing") {
    const relatedCodes = workspace.wireline.billingCodes.filter(row => !record.billingCode || row.code === record.billingCode);
    const relatedElements = workspace.wireline.billingElements.slice(0, 5);
    return (
      <section className="record-main-layout">
        <Panel title="Billing codes" description="Charge code mapping used by pricing and billing.">
          <DataTable columns={[{ key: "code", label: "Code" }, { key: "description", label: "Description" }, { key: "billingType", label: "Type" }]} rows={relatedCodes.length ? relatedCodes : workspace.wireline.billingCodes.slice(0, 4)} />
        </Panel>
        <Panel title="Billing elements" description="Reusable charge elements and values.">
          <DataTable columns={[{ key: "name", label: "Element" }, { key: "elementType", label: "Type" }, { key: "amount", label: "Amount", render: row => formatMoney(row.amount) }]} rows={relatedElements} />
        </Panel>
      </section>
    );
  }

  if (tab === "Docs") {
    return (
      <Panel title="Docs" description="Reference documentation and operational notes.">
        <DataTable columns={[{ key: "title", label: "Document" }, { key: "docType", label: "Type" }, { key: "owner", label: "Owner" }, { key: "status", label: "Status", render: row => <StatusTag tone={statusTone(row.status)}>{row.status}</StatusTag> }, { key: "updatedAt", label: "Updated", render: row => formatDate(row.updatedAt) }]} rows={workspace.wireline.docs.filter(row => row.id.startsWith(record.id))} />
      </Panel>
    );
  }

  if (tab === "Algorithm") {
    const algorithm = workspace.wireline.algorithms.find(row => row.id.startsWith(record.id)) || null;
    return (
      <section className="record-main-layout">
        <Panel title="Algorithm summary" description="Pricing logic lives inside the product record and version history.">
          <div className="field-grid compact-fields">
            <MetricCard label="Version" value={algorithm?.version || "v1.0"} delta="Current release" />
            <MetricCard label="Owner" value={algorithm?.owner || "Pricing Operations"} delta="Governance" />
            <MetricCard label="Status" value={algorithm?.status || "Draft"} delta="Lifecycle" />
            <MetricCard label="Effective" value={formatDate(algorithm?.effectiveDate || "2025-05-15")} delta="Activation date" />
          </div>
        </Panel>
        <Panel title="Algorithm actions" description="Simulation, approval, and publish flow.">
          <div className="pp-inline-links">
            <button className="button" type="button" onClick={() => showToast?.("Simulation finished")}>Run simulation</button>
            <button className="ghost-button" type="button" onClick={() => showToast?.("Submitted to approval queue")}>Submit to approval</button>
            <button className="ghost-button" type="button" onClick={() => showToast?.("Version published")}>Publish</button>
          </div>
        </Panel>
      </section>
    );
  }

  return (
    <Panel title="History" description="Audit trail and version history.">
      <DataTable
        columns={[
          { key: "event", label: "Event" },
          { key: "status", label: "Status" },
          { key: "owner", label: "Owner" },
          { key: "updated", label: "Updated" }
        ]}
        rows={[
          { id: "history-1", event: "Record created", status: "Completed", owner: "Catalog Ops", updated: "May 15, 2025" },
          { id: "history-2", event: "Algorithm reviewed", status: "Approved", owner: "Pricing Ops", updated: "May 20, 2025" },
          { id: "history-3", event: "Effective date set", status: "Ready", owner: "Catalog Ops", updated: "May 22, 2025" }
        ]}
      />
    </Panel>
  );
}

function renderWirelessDetailTab(tab, record, workspace, setRoute, showToast, detailBase) {
  if (!record) return <EmptyState>No wireless record found.</EmptyState>;

  if (tab === "Overview") {
    return (
      <section className="record-main-layout">
        <Panel title="Commercial summary" description="Plans, offers, devices, and features remain in sync.">
          <div className="field-grid compact-fields">
            <MetricCard label="Tier" value={record.planTier || record.offerType || record.kind} delta="Commercial shape" />
            <MetricCard label="Status" value={record.status} delta="Lifecycle" />
            <MetricCard label="Monthly fee" value={formatMoney(record.monthlyBaseFee || 0)} delta="Recurring pricing" />
            <MetricCard label="Eligibility" value={record.eligibility || "Standard"} delta="Commercial qualification" />
          </div>
        </Panel>
        <Panel title="Operating notes" description="Where the wireless record connects.">
          <ul className="pp-detail-list">
            <li>Plans and offers are the source of truth for wireless pricing and promotions.</li>
            <li>Devices and features should stay attached to plan and offer eligibility.</li>
            <li>Algorithm updates should publish with versioning and approval routing.</li>
          </ul>
        </Panel>
      </section>
    );
  }

  if (tab === "Attributes") {
    return (
      <Panel title="Attributes" description="Wireless record attributes.">
        <DataTable
          columns={[{ key: "label", label: "Field" }, { key: "value", label: "Value" }]}
          rows={record.kind === "plan"
            ? [
                { id: "1", label: "Code", value: record.code },
                { id: "2", label: "Plan", value: record.name },
                { id: "3", label: "Tier", value: record.planTier },
                { id: "4", label: "Frequency", value: record.billingFrequency },
                { id: "5", label: "Status", value: record.status }
              ]
            : record.kind === "offer"
              ? [
                  { id: "1", label: "Code", value: record.code },
                  { id: "2", label: "Offer", value: record.name },
                  { id: "3", label: "Type", value: record.offerType },
                  { id: "4", label: "Eligibility", value: record.eligibility },
                  { id: "5", label: "Status", value: record.status }
                ]
              : [
                  { id: "1", label: "Name", value: record.name },
                  { id: "2", label: "Compatible plan", value: record.compatiblePlan || record.planName },
                  { id: "3", label: "Rule", value: record.rule || record.carrierLock },
                  { id: "4", label: "Status", value: record.status }
                ]}
        />
      </Panel>
    );
  }

  if (tab === "Pricing") {
    return (
      <section className="record-main-layout">
        <Panel title="Pricing" description="Recurring pricing and offer support.">
          <div className="field-grid compact-fields">
            <MetricCard label="Monthly fee" value={formatMoney(record.monthlyBaseFee || 0)} delta="Base recurring" />
            <MetricCard label="Commitment" value={formatMoney(record.minimumCommitment || 0)} delta="Term and usage" />
            <MetricCard label="Promotion" value={workspace.wireless.promotions[0]?.name || "-"} delta="Campaign support" />
            <MetricCard label="Algorithm" value="Versioned" delta="Dynamic pricing" />
          </div>
        </Panel>
        <Panel title="Actions" description="What the record can trigger.">
          <div className="pp-inline-links">
            <button className="button" type="button" onClick={() => setRoute?.(`${detailBase}/algorithm`)}>Open algorithm</button>
            <button className="ghost-button" type="button" onClick={() => showToast?.("Promotion simulation queued")}>Run promotion simulation</button>
          </div>
        </Panel>
      </section>
    );
  }

  if (tab === "Availability") {
    return (
      <Panel title="Availability" description="Eligibility and coverage.">
        <DataTable
          columns={[
            { key: "market", label: "Market" },
            { key: "rule", label: "Rule" },
            { key: "status", label: "Status", render: row => <StatusTag tone={statusTone(row.status)}>{row.status}</StatusTag> }
          ]}
          rows={record.kind === "plan" ? workspace.wireless.eligibility.slice(0, 4) : [{ id: "1", market: "National", rule: record.eligibility || record.rule || "Standard", status: record.status === "Active" ? "Eligible" : "Review" }]}
        />
      </Panel>
    );
  }

  if (tab === "Billing") {
    return (
      <Panel title="Billing" description="Rating references and charge setup.">
        <DataTable
          columns={[
            { key: "name", label: "Item" },
            { key: "status", label: "Status", render: row => <StatusTag tone={statusTone(row.status)}>{row.status}</StatusTag> },
            { key: "summary", label: "Summary" }
          ]}
          rows={[
            { id: "1", name: "Rate plan mapping", status: "Ready", summary: record.kind === "plan" ? record.code : "Attached from plan" },
            { id: "2", name: "Promotion tie-in", status: "Ready", summary: workspace.wireless.promotions[0]?.name || "-" },
            { id: "3", name: "Billing code bridge", status: "Review", summary: record.kind === "offer" ? record.code : record.name }
          ]}
        />
      </Panel>
    );
  }

  if (tab === "Docs") {
    return (
      <Panel title="Docs" description="Wireless notes and reference material.">
        <DataTable
          columns={[{ key: "name", label: "Document" }, { key: "status", label: "Status" }, { key: "summary", label: "Summary" }]}
          rows={[
            { id: "1", name: `${record.name} guide`, status: "Published", summary: "Commercial and entitlement reference" },
            { id: "2", name: `${record.name} implementation notes`, status: "Draft", summary: "Network and rating dependencies" }
          ]}
        />
      </Panel>
    );
  }

  if (tab === "Algorithm") {
    return (
      <section className="record-main-layout">
        <Panel title="Algorithm summary" description="Wireless rating and offer support.">
          <div className="field-grid compact-fields">
            <MetricCard label="Version" value="v1.0" delta="Current release" />
            <MetricCard label="Owner" value="Wireless Pricing" delta="Governance" />
            <MetricCard label="Status" value="Published" delta="Lifecycle" />
            <MetricCard label="Effective" value={formatDate("2025-05-15")} delta="Activation date" />
          </div>
        </Panel>
        <Panel title="Algorithm actions" description="Simulation and approval flow.">
          <div className="pp-inline-links">
            <button className="button" type="button" onClick={() => showToast?.("Wireless scenario simulated")}>Run simulation</button>
            <button className="ghost-button" type="button" onClick={() => showToast?.("Wireless version submitted")}>Submit to approval</button>
          </div>
        </Panel>
      </section>
    );
  }

  return (
    <Panel title="History" description="Audit trail and release history.">
      <DataTable
        columns={[{ key: "event", label: "Event" }, { key: "status", label: "Status" }, { key: "owner", label: "Owner" }, { key: "updated", label: "Updated" }]}
        rows={[
          { id: "1", event: "Plan defined", status: "Completed", owner: "Wireless Pricing", updated: "May 11, 2025" },
          { id: "2", event: "Promotion reviewed", status: "Approved", owner: "Commercial Ops", updated: "May 19, 2025" },
          { id: "3", event: "Algorithm published", status: "Ready", owner: "Pricing Ops", updated: "May 22, 2025" }
        ]}
      />
    </Panel>
  );
}

function renderCustomDetailTab(tab, record, workspace, setRoute, showToast, detailBase) {
  if (!record) return <EmptyState>No custom record found.</EmptyState>;

  if (tab === "Overview") {
    return (
      <section className="record-main-layout">
        <Panel title="Governance summary" description="Queue, exception, and algorithm context.">
          <div className="field-grid compact-fields">
            <MetricCard label="Status" value={record.status} delta="Governed state" />
            <MetricCard label="Owner" value={record.requestedBy || record.owner || "Pricing Ops"} delta="Request origin" />
            <MetricCard label="Target" value={record.targetName || record.name || record.requestNumber || "-"} delta="Review target" />
            <MetricCard label="Type" value={record.entityType || record.kind} delta="Approval shape" />
          </div>
        </Panel>
        <Panel title="Workflow" description="The custom space holds exception logic and approvals.">
          <ul className="pp-detail-list">
            <li>Queue items move through approval, simulation, and version review.</li>
            <li>Custom pricing should use a central approval queue instead of ad hoc edits.</li>
            <li>Reusable algorithms should live in the library and be versioned before publish.</li>
          </ul>
        </Panel>
      </section>
    );
  }

  if (tab === "Review") {
    return (
      <section className="record-main-layout">
        <Panel title="Review" description="Approve, reject, or request changes.">
          <div className="pp-inline-links">
            <button className="button" type="button" onClick={() => showToast?.("Approval sent")}>Approve</button>
            <button className="ghost-button" type="button" onClick={() => showToast?.("Change request sent")}>Request changes</button>
            <button className="ghost-button" type="button" onClick={() => showToast?.("Rejected")}>Reject</button>
          </div>
        </Panel>
        <Panel title="Current request" description="Human-readable queue details.">
          <DataTable
            columns={[{ key: "label", label: "Field" }, { key: "value", label: "Value" }]}
            rows={[
              { id: "1", label: "Approval ID", value: record.approvalId || "-" },
              { id: "2", label: "Step", value: record.stepName || "-" },
              { id: "3", label: "Requested by", value: record.requestedBy || "-" },
              { id: "4", label: "Requested changes", value: record.requestedChanges || "-" }
            ]}
          />
        </Panel>
      </section>
    );
  }

  if (tab === "Rules") {
    return (
      <Panel title="Rules" description="Policy and exception controls.">
        <DataTable
          columns={[{ key: "name", label: "Rule" }, { key: "status", label: "Status" }, { key: "summary", label: "Summary" }]}
          rows={[
            { id: "1", name: "Approval policy", status: "Active", summary: "All custom pricing must pass queue review" },
            { id: "2", name: "Margin guardrail", status: "Review", summary: "Simulations must stay within target margin" },
            { id: "3", name: "Publish control", status: "Active", summary: "Only approved versions can publish" }
          ]}
        />
      </Panel>
    );
  }

  if (tab === "Simulation") {
    return (
      <section className="record-main-layout">
        <Panel title="Simulation" description="What-if analysis and scenario comparison.">
          <div className="field-grid compact-fields">
            <MetricCard label="Scenario" value="Margin compression" delta="Stress test" />
            <MetricCard label="Result" value="Within range" delta="Simulated output" />
            <MetricCard label="Approval impact" value="Request changes" delta="Governance hint" />
            <MetricCard label="Version" value="v1.0" delta="Current model" />
          </div>
        </Panel>
        <Panel title="Actions" description="Run or publish the current scenario.">
          <div className="pp-inline-links">
            <button className="button" type="button" onClick={() => showToast?.("Simulation rerun")}>Run simulation</button>
            <button className="ghost-button" type="button" onClick={() => showToast?.("Version published")}>Publish version</button>
          </div>
        </Panel>
      </section>
    );
  }

  return (
    <Panel title="History" description="Version and audit trail.">
      <DataTable
        columns={[{ key: "event", label: "Event" }, { key: "status", label: "Status" }, { key: "owner", label: "Owner" }, { key: "updated", label: "Updated" }]}
        rows={[
          { id: "1", event: "Request created", status: "Completed", owner: record.requestedBy || "Pricing Ops", updated: "May 8, 2025" },
          { id: "2", event: "Simulation completed", status: "Approved", owner: "Pricing Ops", updated: "May 10, 2025" },
          { id: "3", event: "Version reviewed", status: "Review", owner: "Governance", updated: "May 12, 2025" }
        ]}
      />
    </Panel>
  );
}

function DetailPage({ domain, route, workspace, setRoute, showToast, onRefreshWorkspace }) {
  const parsed = routeParts(route);
  const config = DOMAIN_CONFIGS[domain];
  const collection = domainCollectionRows(domain, workspace);
  const record = useMemo(() => {
    const candidates = [
      ...(collection.products || []),
      ...(collection.plans || []),
      ...(collection.offers || []),
      ...(collection.devices || []),
      ...(collection.features || []),
      ...(collection.queue || []),
      ...(collection.library || []),
      ...(collection.exceptions || []),
      ...(collection.simulations || []),
      ...(collection.versions || [])
    ];
    return candidates.find(item => item.id === slugify(parsed.recordId) || item.id === parsed.recordId || item.approvalId === parsed.recordId || item.requestId === parsed.recordId) || candidates.find(item => item.id === `${slugify(parsed.recordId)}`) || null;
  }, [collection, parsed.recordId]);

  const baseRoute = routeForRecord(domain, parsed.kind, parsed.recordId);
  const tabs = config.detailTabs;
  const activeTab = buildDetailTabs(domain, record || {}, parsed.subTab);
  const activeIndex = tabs.indexOf(activeTab);

  useEffect(() => {
    if (!tabs.length) return;
    if (activeIndex < 0) {
      setRoute?.(baseRoute);
    }
  }, [activeIndex, baseRoute, setRoute, tabs.length]);

  const onTabChange = nextTab => {
    const suffix = slugify(nextTab);
    setRoute?.(suffix === slugify(tabs[0]) ? baseRoute : `${baseRoute}/${suffix}`);
  };

  return (
    <>
      <PageHeader
        title={config.label}
        description={config.description}
        actions={<div className="button-cluster"><button className="ghost-button" type="button" onClick={() => setRoute?.(routeForDomain(domain))}>Back to {config.label}</button></div>}
      />
      <DetailHeader
        breadcrumb={["Product & Pricing", config.label, record?.name || record?.title || record?.approvalId || parsed.recordId]}
        title={record?.name || record?.title || record?.approvalId || parsed.recordId}
        status={record?.status || "Active"}
        subtitle={record?.summary || record?.description || record?.objective || config.description}
        actions={detailActionButtons({
          domain,
          record: record || {},
          baseRoute,
          setRoute,
          showToast,
          workspace,
          onApprovalChange: () => showToast?.("Workflow updated")
        })}
      />
      <DetailSummary items={recordFieldsForDomain(domain, record || {}, workspace)} />
      <DetailTabs tabs={tabs} active={activeTab} onChange={onTabChange} />
      {domain === "wireline" ? renderWirelineDetailTab(activeTab, record, workspace, setRoute, showToast, baseRoute) : null}
      {domain === "wireless" ? renderWirelessDetailTab(activeTab, record, workspace, setRoute, showToast, baseRoute) : null}
      {domain === "custom" ? renderCustomDetailTab(activeTab, record, workspace, setRoute, showToast, baseRoute) : null}
    </>
  );
}

export default function ProductPricingWorkspace({ route = "product-pricing", setRoute, showToast }) {
  const [loading, setLoading] = useState(true);
  const [workspaceKey, setWorkspaceKey] = useState(0);
  const [workspace, setWorkspace] = useState({
    summary: {},
    wireline: { products: [], hierarchy: [], billingCodes: [], billingElements: [], docs: [], availability: [], algorithms: [] },
    wireless: { plans: [], offers: [], devices: [], features: [], promotions: [], eligibility: [], algorithms: [] },
    custom: { queue: [], library: [], exceptions: [], simulations: [], versions: [], approvals: [], customPricing: [] }
  });

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      setLoading(true);
      const results = await Promise.allSettled([
        fetchProductPricingOverview(),
        listBillingProducts(),
        listBillingProductHierarchy(),
        listBillingCodes(),
        listBillingElements(),
        listOffers(),
        listPromotions(),
        listRatePlans(),
        listApprovals(),
        listCustomPricing()
      ]);

      if (!active) return;

      const [overview, products, hierarchy, billingCodes, billingElements, offers, promotions, ratePlans, approvals, customPricing] = results;
      setWorkspace(buildWorkspaceData({
        overview: overview.status === "fulfilled" ? overview.value : null,
        products: products.status === "fulfilled" ? products.value || [] : [],
        hierarchy: hierarchy.status === "fulfilled" ? hierarchy.value || [] : [],
        billingCodes: billingCodes.status === "fulfilled" ? billingCodes.value || [] : [],
        billingElements: billingElements.status === "fulfilled" ? billingElements.value || [] : [],
        offers: offers.status === "fulfilled" ? offers.value || [] : [],
        promotions: promotions.status === "fulfilled" ? promotions.value || [] : [],
        ratePlans: ratePlans.status === "fulfilled" ? ratePlans.value || [] : [],
        approvals: approvals.status === "fulfilled" ? approvals.value || [] : [],
        customPricing: customPricing.status === "fulfilled" ? customPricing.value || [] : []
      }));
      setLoading(false);
    }

    loadWorkspace().catch(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [workspaceKey]);

  const parsed = useMemo(() => routeParts(route), [route]);
  const focusDomain = parsed.domain && DOMAIN_CONFIGS[parsed.domain] && !parsed.kind ? parsed.domain : "";

  useEffect(() => {
    if (!focusDomain || loading) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`${focusDomain}-catalog`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [focusDomain, loading]);

  if (loading) {
    return (
      <>
        <PageHeader
          title="Product & Pricing"
          description="Loading the commercial catalog..."
        />
        <EmptyState>Loading product and pricing catalog...</EmptyState>
      </>
    );
  }

  if (parsed.kind && parsed.recordId) {
    return (
      <DetailPage
        domain={parsed.domain}
        route={route}
        workspace={workspace}
        setRoute={setRoute}
        showToast={showToast}
        onRefreshWorkspace={() => setWorkspaceKey(value => value + 1)}
      />
    );
  }

  return (
    <>
      <LandingPage selectedDomain={parsed.domain} onSelectDomain={nextDomain => setRoute?.(routeForDomain(nextDomain))} showToast={showToast} />
      {parsed.domain ? (
        <section className="pp-workspace-stack">
          <DomainWorkspace domain={parsed.domain} workspace={workspace} setRoute={setRoute} showToast={showToast} />
        </section>
      ) : null}
    </>
  );
}
