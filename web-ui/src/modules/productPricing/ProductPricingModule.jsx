import React, { useEffect, useState } from "react";
import { PageHeader } from "../../components/Shell";
import { DataTable, MetricCard, Panel, StatusTag, formatMoney } from "../../components/Primitives";
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

export default function ProductPricingModule({ showToast }) {
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
  const [error, setError] = useState("");

  async function loadProductPricing() {
    setLoading(true);
    setError("");
    try {
      const [overview, products, hierarchy, billingCodes, billingElements, offers, promotions, ratePlans] = await Promise.all([
        fetchProductPricingOverview(),
        listBillingProducts(),
        listBillingProductHierarchy(),
        listBillingCodes(),
        listBillingElements(),
        listOffers(),
        listPromotions(),
        listRatePlans()
      ]);
      setData({ overview, products, hierarchy, billingCodes, billingElements, offers, promotions, ratePlans });
    } catch (err) {
      setError(err.message || "Unable to load product and pricing data.");
    } finally {
      setLoading(false);
    }
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
        actions={<button className="button" type="button" onClick={() => { loadProductPricing(); showToast?.("Product pricing refreshed"); }}>Refresh</button>}
      />
      {error && <div className="empty-state">{error}</div>}
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
          {tab === "Products" && <Panel title="Products" description="Billing product records from the platform API."><DataTable columns={[{ key: "ProductCode", label: "Code" }, { key: "ProductName", label: "Product" }, { key: "Category", label: "Category" }, { key: "ServiceCategory", label: "Service Category" }, { key: "BaseMrc", label: "MRC", render: row => formatMoney(row.BaseMrc || 0) }, { key: "BaseNrc", label: "NRC", render: row => formatMoney(row.BaseNrc || 0) }, { key: "Status", label: "Status", render: row => <StatusTag tone={productStatusTone(row.Status)}>{row.Status}</StatusTag> }]} rows={data.products} /></Panel>}
          {tab === "Hierarchy" && <Panel title="Product Hierarchy" description="Product-to-billing hierarchy returned by /api/billing/product-hierarchy."><DataTable columns={[{ key: "ProductName", label: "Product" }, { key: "HierarchyPath", label: "Path" }, { key: "BillingCode", label: "Billing Code" }, { key: "DisplayOrder", label: "Order" }]} rows={data.hierarchy} /></Panel>}
          {tab === "Billing Codes" && <Panel title="Billing Codes" description="Charge codes available to pricing and quote workflows."><DataTable columns={[{ key: "Code", label: "Code" }, { key: "Description", label: "Description" }, { key: "BillingType", label: "Type" }]} rows={data.billingCodes} /></Panel>}
          {tab === "Billing Elements" && <Panel title="Billing Elements" description="Reusable billing elements and amounts."><DataTable columns={[{ key: "ElementName", label: "Element" }, { key: "ElementType", label: "Type" }, { key: "Amount", label: "Amount", render: row => formatMoney(row.Amount || 0) }]} rows={data.billingElements} /></Panel>}
          {tab === "Offers" && <Panel title="Offers" description="Offer positioning and eligibility."><DataTable columns={[{ key: "OfferCode", label: "Code" }, { key: "OfferName", label: "Offer" }, { key: "OfferType", label: "Type" }, { key: "Eligibility", label: "Eligibility" }, { key: "Status", label: "Status", render: row => <StatusTag tone={productStatusTone(row.Status)}>{row.Status}</StatusTag> }]} rows={data.offers} /></Panel>}
          {tab === "Promotions" && <Panel title="Promotions" description="Active and planned promotion records."><DataTable columns={[{ key: "PromotionCode", label: "Code" }, { key: "PromotionName", label: "Promotion" }, { key: "PromotionType", label: "Type" }, { key: "DiscountPct", label: "Discount %" }, { key: "Status", label: "Status", render: row => <StatusTag tone={productStatusTone(row.Status)}>{row.Status}</StatusTag> }]} rows={data.promotions} /></Panel>}
          {tab === "Rate Plans" && <Panel title="Rate Plans" description="Recurring and usage price plans."><DataTable columns={[{ key: "PlanCode", label: "Code" }, { key: "PlanName", label: "Plan" }, { key: "PlanTier", label: "Tier" }, { key: "BillingFrequency", label: "Frequency" }, { key: "MonthlyBaseFee", label: "Base Fee", render: row => formatMoney(row.MonthlyBaseFee || 0) }, { key: "MinimumCommitment", label: "Commitment", render: row => formatMoney(row.MinimumCommitment || 0) }]} rows={data.ratePlans} /></Panel>}
        </>
      )}
    </>
  );
}
