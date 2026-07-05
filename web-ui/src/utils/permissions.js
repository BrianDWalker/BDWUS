export const roles = {
  Viewer: [],
  Executive: ["view:dashboard", "view:reports", "view:customers", "view:billing", "view:orders", "view:care", "view:network"],
  Sales: ["view:dashboard", "view:sales", "view:customers", "create:quote", "create:order"],
  Care: ["view:dashboard", "view:care", "view:customers", "create:ticket", "update:ticket", "comment:ticket", "escalate:ticket", "close:ticket"],
  Billing: ["view:dashboard", "view:billing", "view:customers", "create:invoice-action", "create:adjustment"],
  Ops: ["view:dashboard", "view:orders", "view:network", "update:order", "create:provisioning-job"],
  Admin: ["*"]
};

export const defaultRole = "Admin";

export function activeRole() {
  if (typeof window === "undefined") return defaultRole;
  return window.localStorage?.getItem("bdwus.role") || defaultRole;
}

export function demoRoleHeaders(role = activeRole()) {
  return { "X-Demo-Role": role };
}

export function roleCapabilities(role = activeRole()) {
  return roles[role] || roles[defaultRole];
}

export function can(action, role = activeRole()) {
  const capabilities = roleCapabilities(role);
  return capabilities.includes("*") || capabilities.includes(action);
}

export function permissionMessage(action, role = activeRole()) {
  return `${role} does not have permission for ${action}.`;
}
