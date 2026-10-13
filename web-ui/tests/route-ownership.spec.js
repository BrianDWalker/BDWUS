import { expect, test } from "@playwright/test";
import { topNavSections } from "../src/navigationConfig";
import {
  extractedRoutes,
  integratedSalesDetailTypes,
  intentionalLegacyDetailTypes,
  isExtractedRoute,
  isIntegratedSalesRoute,
  isIntentionalLegacyRoute,
  legacyOwnedRoutes,
  normalizeRoute
} from "../src/routeOwnership";

test("route ownership registry documents extracted owners", () => {
  expect(extractedRoutes).toEqual(expect.arrayContaining([
    "dashboard",
    "knowledge",
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
  ]));
  expect(legacyOwnedRoutes).toEqual([]);
  expect(integratedSalesDetailTypes).toEqual(["lead", "opportunity", "quote", "contract"]);
  expect(intentionalLegacyDetailTypes).toEqual([]);
});

test("every top navigation route has extracted or integrated ownership", () => {
  for (const section of topNavSections) {
    const route = section.route || section.id;
    expect(isExtractedRoute(route) || isIntegratedSalesRoute(route), `${section.label} route ${route} must resolve inside the active portal routers`).toBe(true);
  }
});

test("no intentional legacy route owners remain", () => {
  expect(legacyOwnedRoutes).toHaveLength(0);
  expect(intentionalLegacyDetailTypes).toHaveLength(0);
});

test("migrated detail routes normalize away from legacy fallbacks", () => {
  expect(normalizeRoute("pricing")).toBe("product-pricing");
  expect(normalizeRoute("products")).toBe("product-pricing");
  expect(normalizeRoute("quotes")).toBe("sales");
  expect(normalizeRoute("details/customer/CUST-1001")).toBe("details/customer/CUST-1001");
  expect(normalizeRoute("details/account/ACCT-1001")).toBe("details/account/ACCT-1001");
  expect(normalizeRoute("details/billing-account/CUST-1001")).toBe("details/billing-account/CUST-1001");
  expect(normalizeRoute("details/invoice/INV-1001")).toBe("details/invoice/INV-1001");
  expect(normalizeRoute("details/service/SVC-1001")).toBe("billing");
  expect(normalizeRoute("details/order/ORD-1001")).toBe("details/order/ORD-1001");
  expect(normalizeRoute("details/product/FIBER-1G")).toBe("details/product/FIBER-1G");
  expect(normalizeRoute("details/product-pricing/FIBER-1G")).toBe("details/product-pricing/FIBER-1G");
  expect(normalizeRoute("details/ticket/TKT-1001")).toBe("details/ticket/TKT-1001");
  expect(normalizeRoute("details/network/NE-1001")).toBe("details/network/NE-1001");
  expect(normalizeRoute("details/record/admin:USR-1001")).toBe("details/record/admin:USR-1001");
});

test("ownership predicates classify route families", () => {
  expect(isExtractedRoute("dashboard")).toBe(true);
  expect(isExtractedRoute("knowledge")).toBe(true);
  expect(isExtractedRoute("billing")).toBe(true);
  expect(isExtractedRoute("customer-service")).toBe(true);
  expect(isExtractedRoute("details/customer/CUST-1001")).toBe(true);
  expect(isExtractedRoute("details/account/ACCT-1001")).toBe(true);
  expect(isExtractedRoute("details/billing-account/CUST-1001")).toBe(true);
  expect(isExtractedRoute("details/invoice/INV-1001")).toBe(true);
  expect(isExtractedRoute("details/order/ORD-1001")).toBe(true);
  expect(isExtractedRoute("details/product/FIBER-1G")).toBe(true);
  expect(isExtractedRoute("details/product-pricing/FIBER-1G")).toBe(true);
  expect(isExtractedRoute("details/ticket/TKT-1001")).toBe(true);
  expect(isExtractedRoute("details/network/NE-1001")).toBe(true);
  expect(isExtractedRoute("details/record/admin:USR-1001")).toBe(true);
  expect(isIntegratedSalesRoute("sales")).toBe(true);
  expect(isIntegratedSalesRoute("details/opportunity/OPP-1001")).toBe(true);
  expect(isIntentionalLegacyRoute("dashboard")).toBe(false);
  expect(isIntentionalLegacyRoute("knowledge")).toBe(false);
  expect(isIntentionalLegacyRoute("details/ticket/TKT-1001")).toBe(false);
  expect(isIntentionalLegacyRoute("details/network/NE-1001")).toBe(false);
  expect(isIntentionalLegacyRoute("details/invoice/INV-1001")).toBe(false);
});
