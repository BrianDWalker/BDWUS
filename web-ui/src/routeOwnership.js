export const extractedRoutes = [
  "reports",
  "administration",
  "product-pricing",
  "customer-360",
  "billing",
  "orders",
  "network",
  "service-management",
  "provisioning",
  "carrier-settlement"
];

export const integratedSalesDetailTypes = ["lead", "opportunity", "quote", "contract"];

export const legacyOwnedRoutes = [
  "dashboard",
  "knowledge",
  "customer-service"
];

export const intentionalLegacyDetailTypes = [
  "ticket",
  "network",
  "record"
];

export const routeAliases = {
  pricing: "product-pricing",
  products: "product-pricing",
  quotes: "sales"
};

export function normalizeRoute(route) {
  const normalized = routeAliases[route] || route;
  if (normalized.startsWith("details/customer/") || normalized.startsWith("details/account/")) return "customer-360";
  if (normalized.startsWith("details/billing-account/")) return "customer-360";
  if (normalized.startsWith("details/invoice/")) return "billing";
  if (normalized.startsWith("details/service/")) return "billing";
  if (normalized.startsWith("details/order/")) return "orders";
  if (normalized.startsWith("details/product/") || normalized.startsWith("details/product-pricing/")) return "product-pricing";
  return normalized;
}

export function detailType(route) {
  if (!route.startsWith("details/")) return "";
  const [, type] = route.split("/");
  return type || "";
}

export function isExtractedRoute(route) {
  return extractedRoutes.includes(route);
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
