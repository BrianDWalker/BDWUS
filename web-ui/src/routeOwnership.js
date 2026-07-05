export const extractedRoutes = [
  "dashboard",
  "knowledge",
  "sales",
  "reports",
  "administration",
  "product-pricing",
  "customer-360",
  "customer-service",
  "billing",
  "orders",
  "network",
  "service-management",
  "provisioning",
  "carrier-settlement"
];

export const integratedSalesDetailTypes = ["lead", "opportunity", "quote", "contract"];

export const legacyOwnedRoutes = [];

export const intentionalLegacyDetailTypes = [];

export const routeAliases = {
  pricing: "product-pricing",
  products: "product-pricing",
  quotes: "sales"
};

export function normalizeRoute(route) {
  const normalized = routeAliases[route] || route;
  if (normalized.startsWith("details/service/")) return "billing";
  return normalized;
}

export function detailType(route) {
  if (!route.startsWith("details/")) return "";
  const [, type] = route.split("/");
  return type || "";
}

export function isExtractedRoute(route) {
  return extractedRoutes.includes(route)
    || route.startsWith("details/lead/")
    || route.startsWith("details/opportunity/")
    || route.startsWith("details/quote/")
    || route.startsWith("details/contract/")
    || route.startsWith("details/customer/")
    || route.startsWith("details/account/")
    || route.startsWith("details/billing-account/")
    || route.startsWith("details/invoice/")
    || route.startsWith("details/order/")
    || route.startsWith("details/product/")
    || route.startsWith("details/product-pricing/")
    || route.startsWith("details/ticket/")
    || route.startsWith("details/network/")
    || route.startsWith("details/record/");
}

export function isIntegratedSalesRoute(route) {
  if (route === "sales") return true;
  if (!route.startsWith("details/")) return false;
  return integratedSalesDetailTypes.includes(detailType(route));
}

export function isIntentionalLegacyRoute(route) {
  if (legacyOwnedRoutes.includes(route)) return true;
  if (!route.startsWith("details/")) return false;
  return intentionalLegacyDetailTypes.includes(detailType(route));
}
