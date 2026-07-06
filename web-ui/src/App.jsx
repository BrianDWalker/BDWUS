import React, { useEffect, useState } from "react";
import { Shell } from "./components/Shell";
import DashboardModule from "./modules/dashboard/DashboardModule";
import KnowledgeModule from "./modules/knowledge/KnowledgeModule";
import ReportsModule from "./modules/reports/ReportsModule";
import AdministrationModule from "./modules/admin/AdministrationModule";
import ProductPricingModule from "./modules/productPricing/ProductPricingModule";
import Customer360Module from "./modules/customer360/Customer360Module";
import CustomerServiceModule from "./modules/customerService/CustomerServiceModule";
import CustomerServiceTicketDetail from "./modules/customerService/CustomerServiceTicketDetail";
import NetworkDetailModule from "./modules/details/NetworkDetailModule";
import CustomerAccountDetailModule from "./modules/details/CustomerAccountDetailModule";
import InvoiceDetailModule from "./modules/details/InvoiceDetailModule";
import OrderDetailModule from "./modules/details/OrderDetailModule";
import ProductDetailModule from "./modules/details/ProductDetailModule";
import RecordDetailModule from "./modules/details/RecordDetailModule";
import BillingModule from "./modules/billing/BillingModule";
import OrdersModule from "./modules/orders/OrdersModule";
import ServiceOpsModule from "./modules/ops/ServiceOpsModule";
import { SalesContractDetail, SalesLeadDetail, SalesModule, SalesOpportunityDetail, SalesQuoteDetail } from "./components/SalesDatabaseCRM";
import { isExtractedRoute, normalizeRoute } from "./routeOwnership";

function currentHashRoute() {
  const route = window.location.hash.replace(/^#\/?/, "");
  return normalizeRoute(route || "dashboard");
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

function detailId(route, prefix) {
  return decodeURIComponent(route.slice(prefix.length));
}

function Toast({ toast }) {
  return toast ? <div className="toast">{toast}</div> : null;
}

function ExtractedRoute({ route, setRoute, showToast }) {
  if (route === "dashboard") return <DashboardModule setRoute={setRoute} showToast={showToast} />;
  if (route === "knowledge") return <KnowledgeModule setRoute={setRoute} showToast={showToast} />;
  if (route === "sales") return <SalesModule setRoute={setRoute} showToast={showToast} />;
  if (route === "reports") return <ReportsModule setRoute={setRoute} showToast={showToast} />;
  if (route === "administration") return <AdministrationModule setRoute={setRoute} showToast={showToast} />;
  if (route === "product-pricing") return <ProductPricingModule setRoute={setRoute} showToast={showToast} />;
  if (route === "customer-360") return <Customer360Module setRoute={setRoute} showToast={showToast} />;
  if (route === "customer-service") return <CustomerServiceModule setRoute={setRoute} showToast={showToast} />;
  if (route.startsWith("details/customer/")) return <CustomerAccountDetailModule id={detailId(route, "details/customer/")} setRoute={setRoute} showToast={showToast} />;
  if (route.startsWith("details/account/")) return <CustomerAccountDetailModule id={detailId(route, "details/account/")} setRoute={setRoute} showToast={showToast} />;
  if (route.startsWith("details/billing-account/")) return <CustomerAccountDetailModule id={detailId(route, "details/billing-account/")} setRoute={setRoute} showToast={showToast} />;
  if (route.startsWith("details/invoice/")) return <InvoiceDetailModule id={detailId(route, "details/invoice/")} setRoute={setRoute} showToast={showToast} />;
  if (route.startsWith("details/order/")) return <OrderDetailModule id={detailId(route, "details/order/")} setRoute={setRoute} showToast={showToast} />;
  if (route.startsWith("details/product/")) return <ProductDetailModule id={detailId(route, "details/product/")} setRoute={setRoute} showToast={showToast} />;
  if (route.startsWith("details/product-pricing/")) return <ProductDetailModule id={detailId(route, "details/product-pricing/")} setRoute={setRoute} showToast={showToast} />;
  if (route.startsWith("details/ticket/")) return <CustomerServiceTicketDetail id={route.split("/")[2]} setRoute={setRoute} showToast={showToast} />;
  if (route.startsWith("details/lead/")) return <SalesLeadDetail id={route.split("/")[2]} setRoute={setRoute} showToast={showToast} />;
  if (route.startsWith("details/opportunity/")) return <SalesOpportunityDetail id={route.split("/")[2]} setRoute={setRoute} showToast={showToast} />;
  if (route.startsWith("details/quote/")) return <SalesQuoteDetail id={route.split("/")[2]} setRoute={setRoute} showToast={showToast} />;
  if (route.startsWith("details/contract/")) return <SalesContractDetail id={route.split("/")[2]} setRoute={setRoute} showToast={showToast} />;
  if (route.startsWith("details/network/")) return <NetworkDetailModule id={route.split("/")[2]} setRoute={setRoute} showToast={showToast} />;
  if (route.startsWith("details/record/")) return <RecordDetailModule id={route.split("/")[2]} setRoute={setRoute} showToast={showToast} />;
  if (route === "billing") return <BillingModule setRoute={setRoute} showToast={showToast} />;
  if (route === "orders") return <OrdersModule setRoute={setRoute} showToast={showToast} />;
  if (["network", "service-management", "provisioning", "carrier-settlement"].includes(route)) return <ServiceOpsModule route={route} setRoute={setRoute} showToast={showToast} />;
  return null;
}

function UnknownRoute({ route, setRoute }) {
  return (
    <section className="page-stack">
      <div className="empty-state">
        Route "{route}" is not available in the API-backed portal.
      </div>
      <button className="button" type="button" onClick={() => setRoute("dashboard")}>
        Back to Home
      </button>
    </section>
  );
}

export default function App() {
  const [route, setRoute] = useRoute();
  const [toast, setToast] = useState("");

  function showToast(message) {
    setToast(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(""), 2200);
  }

  return (
    <>
      <Shell activeRoute={route} setRoute={setRoute}>
        {isExtractedRoute(route)
          ? <ExtractedRoute route={route} setRoute={setRoute} showToast={showToast} />
          : <UnknownRoute route={route} setRoute={setRoute} />}
        <Toast toast={toast} />
      </Shell>
    </>
  );
}
