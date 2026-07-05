import React, { useEffect, useState } from "react";
import App from "./App";
import { Shell } from "./components/Shell";
import { SalesContractDetail, SalesLeadDetail, SalesModule, SalesOpportunityDetail, SalesQuoteDetail } from "./components/SalesDatabaseCRM";

const routeAliases = { pricing: "product-pricing", products: "product-pricing", quotes: "sales" };

function normalizeRoute(route) {
  const normalized = routeAliases[route] || route;
  if (normalized.startsWith("details/customer/") || normalized.startsWith("details/account/")) return "customer-360";
  if (normalized.startsWith("details/billing-account/")) return "customer-360";
  if (normalized.startsWith("details/invoice/")) return "billing";
  if (normalized.startsWith("details/service/")) return "billing";
  if (normalized.startsWith("details/order/")) return "orders";
  if (normalized.startsWith("details/product/") || normalized.startsWith("details/product-pricing/")) return "product-pricing";
  return normalized;
}

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

function isIntegratedSalesRoute(route) {
  if (route === "sales") return true;
  if (!route.startsWith("details/")) return false;
  const [, type] = route.split("/");
  return ["lead", "opportunity", "quote", "contract"].includes(type);
}

function IntegratedSalesRoute({ route, setRoute, showToast }) {
  if (route === "sales") return <SalesModule setRoute={setRoute} showToast={showToast} />;

  const [, type, id] = route.split("/");
  if (type === "opportunity") return <SalesOpportunityDetail id={id} setRoute={setRoute} showToast={showToast} />;
  if (type === "quote") return <SalesQuoteDetail id={id} setRoute={setRoute} showToast={showToast} />;
  if (type === "contract") return <SalesContractDetail id={id} setRoute={setRoute} showToast={showToast} />;
  if (type === "lead") return <SalesLeadDetail id={id} setRoute={setRoute} showToast={showToast} />;

  return <SalesModule setRoute={setRoute} showToast={showToast} />;
}

export default function SalesAppRouter() {
  const [route, setRoute] = useRoute();
  const [toast, setToast] = useState("");

  function showToast(message) {
    setToast(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(""), 2200);
  }

  if (!isIntegratedSalesRoute(route)) {
    return <App />;
  }

  return (
    <Shell activeRoute={route} setRoute={setRoute}>
      <IntegratedSalesRoute route={route} setRoute={setRoute} showToast={showToast} />
      <Toast toast={toast} />
    </Shell>
  );
}
