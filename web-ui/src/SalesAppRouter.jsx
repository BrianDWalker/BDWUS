import React, { useEffect, useState } from "react";
import App from "./App";
import { Shell } from "./components/Shell";
import { SalesContractDetail, SalesLeadDetail, SalesModule, SalesOpportunityDetail, SalesQuoteDetail } from "./components/SalesDatabaseCRM";
import { convertQuoteToOrder } from "./utils/salesApi";
import { isIntegratedSalesRoute, normalizeRoute } from "./routeOwnership";

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

function QuoteToOrderAction({ route, setRoute, showToast }) {
  const [, type, id] = route.split("/");
  const [saving, setSaving] = useState(false);
  if (type !== "quote" || !id) return null;

  async function createOrderFromQuote() {
    setSaving(true);
    try {
      const result = await convertQuoteToOrder(id, { assignedTeam: "Provisioning Ops" });
      const orderNumber = result?.order?.OrderNumber || result?.order?.orderNumber || "order";
      showToast(`Created ${orderNumber} from quote`);
      setRoute("orders");
    } catch (error) {
      showToast(error.message || "Unable to create order from quote");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="floating-workflow-action" aria-label="Quote workflow action">
      <button className="button" type="button" disabled={saving} onClick={createOrderFromQuote}>
        {saving ? "Creating Order..." : "Create Order from Quote"}
      </button>
    </div>
  );
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
      <QuoteToOrderAction route={route} setRoute={setRoute} showToast={showToast} />
      <IntegratedSalesRoute route={route} setRoute={setRoute} showToast={showToast} />
      <Toast toast={toast} />
    </Shell>
  );
}
