import React, { useEffect, useState } from "react";
import { PageHeader } from "../../components/Shell";
import { DataTable, MetricCard, Panel, StatusTag, WarningBanner, formatMoney } from "../../components/Primitives";
import { fetchProductPricingOverview } from "../../utils/platformApi";
import {
  listBillingCodes,
  listBillingElements,
  listBillingProductHierarchy,
  listBillingProducts,
  listOffers,
  listPromotions,
  listRatePlans
} from "../../utils/salesApi";

function productStatusTone(status) {
  return status === "Active" ? "success" : status === "Retired" ? "warn" : "blue";
}

function TableOrEmpty({ rows, columns, empty }) {
  return rows.length ? <DataTable columns={columns} rows={rows} /> : null;
}

export default function ProductPricingModule({ setRoute, showToast }) {
  const [tab, setTab] = useState("Products");
  const [data, setData] = useState({
    overview: null,
    products: [],
    hierarchy: [],
    billingCodes: [],
    billingElements: [],
    offers: [],
    promotions: [],
    ratePlans: []
  });
  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState([]);

  async function loadProductPricing() {
    setLoading(true);
    setWarnings([]);
    const requests = [
        fetchProductPricingOverview(),
        listBillingProducts(),
        listBillingProductHierarchy(),
        listBillingCodes(),
        listBillingElements(),
        listOffers(),
        listPromotions(),
        listRatePlans()
      ];
    const [overview, products, hierarchy, billingCodes, billingElements, offers, promotions, ratePlans] = await Promise.allSettled(requests);
    const nextData = {
      overview: overview.status === "fulfilled" ? overview.value : null,
      products: products.status === "fulfilled" ? products.value || [] : [],
      hierarchy: hierarchy.status === "fulfilled" ? hierarchy.value || [] : [],
      billingCodes: billingCodes.status === "fulfilled" ? billingCodes.value || [] : [],
      billingElements: billingElements.status === "fulfilled" ? billingElements.value || [] : [],
      offers: offers.status === "fulfilled" ? offers.value || [] : [],
      promotions: promotions.status === "fulfilled" ? promotions.value || [] : [],
      ratePlans: ratePlans.status === "fulfilled" ? ratePlans.value || [] : []
    };
    setData(nextData);
    setWarnings([]);
    setLoading(false);
  }

  useEffect(() => {
    loadProductPricing();
  }, []);

  const summary = data.overview?.summary || {};

  return (
    <>
      <PageHeader
        title="Product & Pricing"
        description="API-backed catalog, hierarchy, billing elements, offers, promotions, and rate plans."
      />
      {warnings.map(warning => <WarningBanner key={warning}>{warning}</WarningBanner>)}
      {loading ? <div className="empty-state">Loading product and pricing data...</div> : (
        <>
          <section className="overview-grid">
            <MetricCard label="Products" value={summary.productCount ?? data.products.length} delta="Catalog records" />
            <MetricCard label="Services" value={summary.serviceCount ?? data.overview?.services?.length ?? 0} delta="Service definitions" />
            <MetricCard label="Offers" value={summary.offerCount ?? data.offers.length} delta="Commercial programs" />
            <MetricCard label="Rate plans" value={summary.ratePlanCount ?? data.ratePlans.length} delta="Recurring pricing" />
          </section>
          <div className="record-tabs" role="tablist">
            {["Products", "Hierarchy", "Billing Codes", "Billing Elements", "Offers", "Promotions", "Rate Plans"].map(item => (
              <button key={item} className={item === tab ? "active" : ""} type="button" onClick={() => setTab(item)}>{item}</button>
            ))}
          </div>
          {tab === "Products" && <Panel title="Products" description="Billing product records."><TableOrEmpty rows={data.products} empty="" columns={[{ key: "ProductCode", label: "Code" }, { key: "ProductName", label: "Product" }, { key: "Category", label: "Category" }, { key: "ServiceCategory", label: "Service Category" }, { key: "BaseMrc", label: "MRC", render: row => formatMoney(row.BaseMrc || 0) }, { key: "BaseNrc", label: "NRC", render: row => formatMoney(row.BaseNrc || 0) }, { key: "Status", label: "Status", render: row => <StatusTag tone={productStatusTone(row.Status)}>{row.Status}</StatusTag> }, { key: "details", label: "", render: row => <button className="link-button compact-action" type="button" onClick={() => setRoute?.(`details/product/${encodeURIComponent(row.ProductId || row.ProductCode || row.ProductName)}`)}>Details</button> }]} /></Panel>}
          {tab === "Hierarchy" && <Panel title="Product Hierarchy" description="Product hierarchy."><TableOrEmpty rows={data.hierarchy} empty="" columns={[{ key: "ProductName", label: "Product" }, { key: "HierarchyPath", label: "Path" }, { key: "BillingCode", label: "Billing Code" }, { key: "DisplayOrder", label: "Order" }]} /></Panel>}
          {tab === "Billing Codes" && <Panel title="Billing Codes" description="Charge codes."><TableOrEmpty rows={data.billingCodes} empty="" columns={[{ key: "Code", label: "Code" }, { key: "Description", label: "Description" }, { key: "BillingType", label: "Type" }]} /></Panel>}
          {tab === "Billing Elements" && <Panel title="Billing Elements" description="Billing elements."><TableOrEmpty rows={data.billingElements} empty="" columns={[{ key: "ElementName", label: "Element" }, { key: "ElementType", label: "Type" }, { key: "Amount", label: "Amount", render: row => formatMoney(row.Amount || 0) }]} /></Panel>}
          {tab === "Offers" && <Panel title="Offers" description="Offers."><TableOrEmpty rows={data.offers} empty="" columns={[{ key: "OfferCode", label: "Code" }, { key: "OfferName", label: "Offer" }, { key: "OfferType", label: "Type" }, { key: "Eligibility", label: "Eligibility" }, { key: "Status", label: "Status", render: row => <StatusTag tone={productStatusTone(row.Status)}>{row.Status}</StatusTag> }]} /></Panel>}
          {tab === "Promotions" && <Panel title="Promotions" description="Promotion records."><TableOrEmpty rows={data.promotions} empty="" columns={[{ key: "PromotionCode", label: "Code" }, { key: "PromotionName", label: "Promotion" }, { key: "PromotionType", label: "Type" }, { key: "DiscountPct", label: "Discount %" }, { key: "Status", label: "Status", render: row => <StatusTag tone={productStatusTone(row.Status)}>{row.Status}</StatusTag> }]} /></Panel>}
          {tab === "Rate Plans" && <Panel title="Rate Plans" description="Price plans."><TableOrEmpty rows={data.ratePlans} empty="" columns={[{ key: "PlanCode", label: "Code" }, { key: "PlanName", label: "Plan" }, { key: "PlanTier", label: "Tier" }, { key: "BillingFrequency", label: "Frequency" }, { key: "MonthlyBaseFee", label: "Base Fee", render: row => formatMoney(row.MonthlyBaseFee || 0) }, { key: "MinimumCommitment", label: "Commitment", render: row => formatMoney(row.MinimumCommitment || 0) }]} /></Panel>}
        </>
      )}
    </>
  );
}
