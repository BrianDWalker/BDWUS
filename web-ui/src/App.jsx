import React, { useEffect, useState } from "react";
import LegacyPortal from "./LegacyPortal";
import { Shell } from "./components/Shell";
import ReportsModule from "./modules/reports/ReportsModule";
import AdministrationModule from "./modules/admin/AdministrationModule";

const routeAliases = { pricing: "product-pricing", products: "product-pricing", quotes: "sales" };

function normalizeRoute(route) {
  return routeAliases[route] || route;
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

function isExtractedRoute(route) {
  return ["reports", "administration"].includes(route);
}

function ExtractedRoute({ route, setRoute, showToast }) {
  if (route === "reports") return <ReportsModule setRoute={setRoute} showToast={showToast} />;
  if (route === "administration") return <AdministrationModule setRoute={setRoute} showToast={showToast} />;
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
