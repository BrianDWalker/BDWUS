import { expect, test } from "@playwright/test";
import { can, roleCapabilities, roles } from "../src/utils/permissions";

test("admin can perform every registered action", () => {
  expect(roleCapabilities("Admin")).toContain("*");
  expect(can("create:adjustment", "Admin")).toBe(true);
  expect(can("close:ticket", "Admin")).toBe(true);
});

test("billing role is limited to billing workflow actions", () => {
  expect(can("create:invoice-action", "Billing")).toBe(true);
  expect(can("create:adjustment", "Billing")).toBe(true);
  expect(can("close:ticket", "Billing")).toBe(false);
});

test("care role can update tickets but cannot create billing adjustments", () => {
  expect(can("create:ticket", "Care")).toBe(true);
  expect(can("comment:ticket", "Care")).toBe(true);
  expect(can("escalate:ticket", "Care")).toBe(true);
  expect(can("close:ticket", "Care")).toBe(true);
  expect(can("create:adjustment", "Care")).toBe(false);
});

test("all named roles have at least one capability", () => {
  for (const [role, capabilities] of Object.entries(roles)) {
    expect(role).toBeTruthy();
    expect(capabilities.length).toBeGreaterThan(0);
  }
});
