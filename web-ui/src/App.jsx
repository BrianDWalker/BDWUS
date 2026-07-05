import React, { useEffect, useState } from "react";
import LegacyPortal from "./LegacyPortal";
import { Shell } from "./components/Shell";
import ReportsModule from "./modules/reports/ReportsModule";
import AdministrationModule from "./modules/admin/AdministrationModule";
import ProductPricingModule from "./modules/productPricing/ProductPricingModule";
import Customer360Module from "./modules/customer360/Customer360Module";
import CustomerServiceModule from "./modules/customerService/CustomerServiceModule";
import CustomerServiceTicketDetail from "./modules/customerService/CustomerServiceTicketDetail";
import BillingModule from "./modules/billing/BillingModule";
import OrdersModule from "./modules/orders/OrdersModule";
import ServiceOpsModule from "./modules/ops/ServiceOpsModule";
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

function Toast({ toast }) {
  return toast ? <div className="toast">{toast}</div> : null;
}

function ExtractedRoute({ route, setRoute, showToast }) {
  if (route === "reports") return <ReportsModule setRoute={setRoute} showToast={showToast} />;
  if (route === "administration") return <AdministrationModule setRoute={setRoute} showToast={showToast} />;
  if (route === "product-pricing") return <ProductPricingModule setRoute={setRoute} showToast={showToast} />;
  if (route === "customer-360") return <Customer360Module setRoute={setRoute} showToast={showToast} />;
  if (route === "customer-service") return <CustomerServiceModule setRoute={setRoute} showToast={showToast} />;
  if (route.startsWith("details/ticket/")) return <CustomerServiceTicketDetail id={route.split("/")[2]} setRoute={setRoute} showToast={showToast} />;
  if (route === "billing") return <BillingModule setRoute={setRoute} showToast={showToast} />;
  if (route === "orders") return <OrdersModule setRoute={setRoute} showToast={showToast} />;
  if (["network", "service-management", "provisioning", "carrier-settlement"].includes(route)) return <ServiceOpsModule route={route} setRoute={setRoute} showToast={showToast} />;
  return null;
}

export default function App() {
  const [route, setRoute] = useRoute();
  const [toast, setToast] = useState("");

  function showToast(message) {
    setToast(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(""), 2200);
  }

  if (!isExtractedRoute(route)) {
    return <LegacyPortal />;
  }

  return (
    <Shell activeRoute={route} setRoute={setRoute}>
      <ExtractedRoute route={route} setRoute={setRoute} showToast={showToast} />
      <Toast toast={toast} />
    </Shell>
  );
}
