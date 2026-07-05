import React, { useEffect, useMemo, useState } from "react";
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
import { DetailHeader, DetailSummary, DetailTabs, EmptyState } from "./DetailShell";

function normalizeProduct(row = {}) {
  return {
    ...row,
    ProductId: row.ProductId || row.productId || row.id,
    ProductCode: row.ProductCode || row.productCode || row.code,
    ProductName: row.ProductName || row.productName || row.name,
    Category: row.Category || row.category,
    ServiceCategory: row.ServiceCategory || row.serviceCategory,
    BillingCode: row.BillingCode || row.billingCode,
    BaseMrc: Number(row.BaseMrc ?? row.baseMrc ?? 0),
    BaseNrc: Number(row.BaseNrc ?? row.baseNrc ?? 0),
    Status: row.Status || row.status
  };
}

function matchesProduct(row, id) {
  const target = String(id || "").toLowerCase();
  return [row?.ProductId, row?.ProductCode, row?.ProductName, row?.id, row?.code, row?.name]
    .filter(Boolean)
    .some(value => String(value).toLowerCase() === target);
}

function tone(status) {
  return status === "Active" ? "success" : status === "Retired" ? "warn" : "blue";
}

export default function ProductDetailModule({ id, setRoute, showToast }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [overview, setOverview] = useState(null);
  const [products, setProducts] = useState([]);
  const [hierarchy, setHierarchy] = useState([]);
  const [billingCodes, setBillingCodes] = useState([]);
  const [billingElements, setBillingElements] = useState([]);
  const [offers, setOffers] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [ratePlans, setRatePlans] = useState([]);
  const [tab, setTab] = useState("Overview");

  async function loadDetail() {
    setLoading(true);
    setError("");
    setWarnings([]);
    const results = await Promise.allSettled([
      fetchProductPricingOverview(),
      listBillingProducts(),
      listBillingProductHierarchy(),
      listBillingCodes(),
      listBillingElements(),
      listOffers(),
      listPromotions(),
      listRatePlans()
    ]);

    const [overviewResult, productsResult, hierarchyResult, codesResult, elementsResult, offersResult, promotionsResult, ratePlansResult] = results;
    const nextOverview = overviewResult.status === "fulfilled" ? overviewResult.value || null : null;
    const nextProducts = productsResult.status === "fulfilled" ? (productsResult.value || []).map(normalizeProduct) : [];
    const nextHierarchy = hierarchyResult.status === "fulfilled" ? hierarchyResult.value || [] : [];
    const nextCodes = codesResult.status === "fulfilled" ? codesResult.value || [] : [];
    const nextElements = elementsResult.status === "fulfilled" ? elementsResult.value || [] : [];
    const nextOffers = offersResult.status === "fulfilled" ? offersResult.value || [] : [];
    const nextPromotions = promotionsResult.status === "fulfilled" ? promotionsResult.value || [] : [];
    const nextRatePlans = ratePlansResult.status === "fulfilled" ? ratePlansResult.value || [] : [];

    setOverview(nextOverview);
    setProducts(nextProducts);
    setHierarchy(nextHierarchy);
    setBillingCodes(nextCodes);
    setBillingElements(nextElements);
    setOffers(nextOffers);
    setPromotions(nextPromotions);
    setRatePlans(nextRatePlans);

    const failures = results
      .map((result, index) => (result.status === "rejected" ? ["overview", "products", "hierarchy", "billing codes", "billing elements", "offers", "promotions", "rate plans"][index] : ""))
      .filter(Boolean);

    if (failures.length && (nextProducts.length || nextHierarchy.length || nextCodes.length || nextElements.length || nextOffers.length || nextPromotions.length || nextRatePlans.length)) {
      setWarnings([`${failures.join(", ")} source${failures.length === 1 ? "" : "s"} unavailable; showing available catalog data.`]);
    } else if (failures.length) {
      setError(overviewResult.reason?.message || productsResult.reason?.message || hierarchyResult.reason?.message || codesResult.reason?.message || elementsResult.reason?.message || offersResult.reason?.message || promotionsResult.reason?.message || ratePlansResult.reason?.message || "Unable to load product detail.");
    }

    setLoading(false);
  }

  useEffect(() => {
    loadDetail().catch(err => {
      setError(err.message || "Unable to load product detail.");
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const selectedProduct = useMemo(() => products.find(row => matchesProduct(row, id)) || products[0] || normalizeProduct({ ProductId: id, ProductCode: id, ProductName: "Product", Status: "Active" }), [products, id]);
  const selectedOverview = overview?.summary || {};
  const relatedHierarchy = useMemo(() => hierarchy.filter(row => String(row.ProductName || row.productName || "").toLowerCase().includes(String(selectedProduct.ProductName || selectedProduct.ProductCode || id).toLowerCase()) || String(row.BillingCode || row.billingCode || "").toLowerCase() === String(selectedProduct.BillingCode || "").toLowerCase()), [hierarchy, selectedProduct, id]);
  const relatedCodes = useMemo(() => billingCodes.filter(row => String(row.Code || row.code || "").toLowerCase().includes(String(selectedProduct.BillingCode || selectedProduct.ProductCode || "").toLowerCase())), [billingCodes, selectedProduct]);
  const relatedElements = useMemo(() => billingElements.filter(row => String(row.ElementName || row.elementName || "").toLowerCase().includes(String(selectedProduct.ProductName || selectedProduct.ProductCode || id).toLowerCase())), [billingElements, selectedProduct, id]);
  const tabs = ["Overview", "Hierarchy", "Billing Codes", "Billing Elements", "Offers", "Promotions", "Rate Plans"];

  return (
    <>
      <PageHeader title="Product & Pricing" description="Dedicated product and pricing detail workspace." actions={<div className="button-cluster"><button className="ghost-button" type="button" onClick={() => setRoute?.("product-pricing")}>Back to Product & Pricing</button></div>} />
      {warnings.map(warning => <WarningBanner key={warning}>{warning}</WarningBanner>)}
      {error && <EmptyState>{error}</EmptyState>}
      {loading ? <EmptyState>Loading product detail...</EmptyState> : (
        <>
          <DetailHeader
            breadcrumb={["Product & Pricing", selectedProduct.ProductName || id]}
            title={selectedProduct.ProductName || id}
            status={selectedProduct.Status || "Active"}
            subtitle={`${selectedProduct.ProductCode || id} · ${selectedProduct.Category || "Category unavailable"} · ${selectedProduct.ServiceCategory || "Service category unavailable"}`}
            actions={<div className="button-cluster"><button className="button" type="button" onClick={() => setRoute?.(`details/product/${selectedProduct.ProductId || selectedProduct.ProductCode || id}`)}>Open Catalog Record</button><button className="ghost-button" type="button" onClick={() => showToast?.("Product snapshot refreshed")}>Snapshot</button></div>}
          />
          <DetailSummary items={[
            { label: "Product code", value: selectedProduct.ProductCode || "-", note: "Catalog identifier" },
            { label: "Category", value: selectedProduct.Category || "-", note: "Catalog family" },
            { label: "Service", value: selectedProduct.ServiceCategory || "-", note: "Service mapping" },
            { label: "MRC", value: formatMoney(selectedProduct.BaseMrc || 0), note: "Base recurring" },
            { label: "NRC", value: formatMoney(selectedProduct.BaseNrc || 0), note: "Base non-recurring" },
            { label: "Status", value: selectedProduct.Status || "-", note: "Catalog state" }
          ]} />
          <DetailTabs tabs={tabs} active={tab} onChange={setTab} />
          {tab === "Overview" && (
            <section className="record-main-layout">
              <Panel title="Product summary" description="Catalog, billing, and service mapping.">
                <div className="field-grid compact-fields">
                  <MetricCard label="Product Count" value={selectedOverview.productCount ?? products.length} delta="Catalog records" />
                  <MetricCard label="Service Count" value={selectedOverview.serviceCount ?? overview?.services?.length ?? 0} delta="Service definitions" />
                  <MetricCard label="Offer Count" value={selectedOverview.offerCount ?? offers.length} delta="Commercial programs" />
                  <MetricCard label="Rate Plans" value={selectedOverview.ratePlanCount ?? ratePlans.length} delta="Recurring plans" />
                </div>
              </Panel>
              <Panel title="Pricing profile" description="Base pricing and catalog placement.">
                <div className="field-grid compact-fields">
                  <MetricCard label="Status" value={selectedProduct.Status || "-"} delta="Catalog state" />
                  <MetricCard label="Billing code" value={selectedProduct.BillingCode || "-"} delta="Charge mapping" />
                  <MetricCard label="Base MRC" value={formatMoney(selectedProduct.BaseMrc || 0)} delta="Recurring" />
                  <MetricCard label="Base NRC" value={formatMoney(selectedProduct.BaseNrc || 0)} delta="Non-recurring" />
                </div>
              </Panel>
            </section>
          )}
          {tab === "Hierarchy" && (
            <Panel title="Hierarchy" description="Product-to-billing hierarchy records.">
              {relatedHierarchy.length ? <DataTable columns={[{ key: "ProductName", label: "Product" }, { key: "HierarchyPath", label: "Path" }, { key: "BillingCode", label: "Billing Code" }, { key: "DisplayOrder", label: "Order" }]} rows={relatedHierarchy} /> : <EmptyState>No hierarchy rows returned for this product.</EmptyState>}
            </Panel>
          )}
          {tab === "Billing Codes" && (
            <Panel title="Billing codes" description="Charge codes used by pricing and billing.">
              {relatedCodes.length ? <DataTable columns={[{ key: "Code", label: "Code" }, { key: "Description", label: "Description" }, { key: "BillingType", label: "Type" }]} rows={relatedCodes} /> : <EmptyState>No billing codes returned for this product.</EmptyState>}
            </Panel>
          )}
          {tab === "Billing Elements" && (
            <Panel title="Billing elements" description="Reusable charge elements and amounts.">
              {relatedElements.length ? <DataTable columns={[{ key: "ElementName", label: "Element" }, { key: "ElementType", label: "Type" }, { key: "Amount", label: "Amount", render: row => formatMoney(row.Amount || 0) }]} rows={relatedElements} /> : <EmptyState>No billing elements returned for this product.</EmptyState>}
            </Panel>
          )}
          {tab === "Offers" && (
            <Panel title="Offers" description="Offer positioning and eligibility.">
              {offers.length ? <DataTable columns={[{ key: "OfferCode", label: "Code" }, { key: "OfferName", label: "Offer" }, { key: "OfferType", label: "Type" }, { key: "Eligibility", label: "Eligibility" }, { key: "Status", label: "Status", render: row => <StatusTag tone={tone(row.Status)}>{row.Status || "-"}</StatusTag> }]} rows={offers} /> : <EmptyState>No offers returned for this product.</EmptyState>}
            </Panel>
          )}
          {tab === "Promotions" && (
            <Panel title="Promotions" description="Active and planned promotions.">
              {promotions.length ? <DataTable columns={[{ key: "PromotionCode", label: "Code" }, { key: "PromotionName", label: "Promotion" }, { key: "PromotionType", label: "Type" }, { key: "DiscountPct", label: "Discount %" }, { key: "Status", label: "Status", render: row => <StatusTag tone={tone(row.Status)}>{row.Status || "-"}</StatusTag> }]} rows={promotions} /> : <EmptyState>No promotions returned for this product.</EmptyState>}
            </Panel>
          )}
          {tab === "Rate Plans" && (
            <Panel title="Rate plans" description="Recurring and usage plans associated with the catalog.">
              {ratePlans.length ? <DataTable columns={[{ key: "PlanCode", label: "Code" }, { key: "PlanName", label: "Plan" }, { key: "PlanTier", label: "Tier" }, { key: "BillingFrequency", label: "Frequency" }, { key: "MonthlyBaseFee", label: "Base Fee", render: row => formatMoney(row.MonthlyBaseFee || 0) }, { key: "MinimumCommitment", label: "Commitment", render: row => formatMoney(row.MinimumCommitment || 0) }]} rows={ratePlans} /> : <EmptyState>No rate plans returned for this product.</EmptyState>}
            </Panel>
          )}
        </>
      )}
    </>
  );
}
