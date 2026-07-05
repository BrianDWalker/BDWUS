import { expect, test } from "@playwright/test";
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

test("route ownership registry documents extracted and legacy owners", () => {
  expect(extractedRoutes).toEqual(expect.arrayContaining([
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
  expect(legacyOwnedRoutes).toEqual(["dashboard", "knowledge"]);
  expect(integratedSalesDetailTypes).toEqual(["lead", "opportunity", "quote", "contract"]);
  expect(intentionalLegacyDetailTypes).toEqual(["ticket", "network", "record"]);
});

test("migrated detail routes normalize away from LegacyPortal", () => {
  expect(normalizeRoute("pricing")).toBe("product-pricing");
  expect(normalizeRoute("products")).toBe("product-pricing");
  expect(normalizeRoute("quotes")).toBe("sales");
  expect(normalizeRoute("details/customer/CUST-1001")).toBe("customer-360");
  expect(normalizeRoute("details/account/ACCT-1001")).toBe("customer-360");
  expect(normalizeRoute("details/billing-account/CUST-1001")).toBe("customer-360");
  expect(normalizeRoute("details/invoice/INV-1001")).toBe("billing");
  expect(normalizeRoute("details/service/SVC-1001")).toBe("billing");
  expect(normalizeRoute("details/order/ORD-1001")).toBe("orders");
  expect(normalizeRoute("details/product/FIBER-1G")).toBe("product-pricing");
});

test("ownership predicates classify route families", () => {
  expect(isExtractedRoute("billing")).toBe(true);
  expect(isExtractedRoute("customer-service")).toBe(true);
  expect(isIntegratedSalesRoute("sales")).toBe(true);
  expect(isIntegratedSalesRoute("details/opportunity/OPP-1001")).toBe(true);
  expect(isIntentionalLegacyRoute("dashboard")).toBe(true);
  expect(isIntentionalLegacyRoute("knowledge")).toBe(true);
  expect(isIntentionalLegacyRoute("customer-service")).toBe(false);
  expect(isIntentionalLegacyRoute("details/ticket/TKT-1001")).toBe(true);
  expect(isIntentionalLegacyRoute("details/invoice/INV-1001")).toBe(false);
});
