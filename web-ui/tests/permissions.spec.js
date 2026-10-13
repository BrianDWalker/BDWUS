import { expect, test } from "@playwright/test";
import { can, roleCapabilities, roles } from "../src/utils/permissions";

test("admin has wildcard permissions", () => {
  expect(roleCapabilities("Admin")).toContain("*");
  expect(can("create:adjustment", "Admin")).toBe(true);
  expect(can("close:ticket", "Admin")).toBe(true);
  expect(can("create:provisioning-job", "Admin")).toBe(true);
});

test("viewer has no mutation permissions", () => {
  expect(roleCapabilities("Viewer")).toEqual([]);
  expect(can("create:order", "Viewer")).toBe(false);
  expect(can("create:invoice-action", "Viewer")).toBe(false);
  expect(can("close:ticket", "Viewer")).toBe(false);
});

test("billing can create billing workflow records but cannot close tickets", () => {
  expect(can("create:invoice-action", "Billing")).toBe(true);
  expect(can("create:adjustment", "Billing")).toBe(true);
  expect(can("close:ticket", "Billing")).toBe(false);
});

test("care can operate tickets but cannot create adjustments", () => {
  expect(can("create:ticket", "Care")).toBe(true);
  expect(can("comment:ticket", "Care")).toBe(true);
  expect(can("escalate:ticket", "Care")).toBe(true);
  expect(can("close:ticket", "Care")).toBe(true);
  expect(can("create:adjustment", "Care")).toBe(false);
});

test("ops can create provisioning jobs but not billing adjustments", () => {
  expect(can("create:provisioning-job", "Ops")).toBe(true);
  expect(can("create:adjustment", "Ops")).toBe(false);
});

test("sales can create orders from quotes but cannot close care tickets", () => {
  expect(can("create:order", "Sales")).toBe(true);
  expect(can("close:ticket", "Sales")).toBe(false);
});

test("roles registry includes expected personas", () => {
  expect(Object.keys(roles)).toEqual(expect.arrayContaining(["Viewer", "Executive", "Sales", "Care", "Billing", "Ops", "Admin"]));
});
