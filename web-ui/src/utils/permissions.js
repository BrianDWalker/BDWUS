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
const ROLE_STORAGE_KEY = "bdwus.role";
const ROLE_TOKEN_STORAGE_KEY = "bdwus.role.token";
const ROLE_TOKEN_ROLE_STORAGE_KEY = "bdwus.role.token.role";
const ROLE_TOKEN_EXP_STORAGE_KEY = "bdwus.role.token.exp";

export function activeRole() {
  if (typeof window === "undefined") return defaultRole;
  return window.localStorage?.getItem(ROLE_STORAGE_KEY) || defaultRole;
}

function storedRoleToken(role = activeRole()) {
  if (typeof window === "undefined") return "";
  const token = window.localStorage?.getItem(ROLE_TOKEN_STORAGE_KEY) || "";
  const tokenRole = window.localStorage?.getItem(ROLE_TOKEN_ROLE_STORAGE_KEY) || "";
  const tokenExp = Number(window.localStorage?.getItem(ROLE_TOKEN_EXP_STORAGE_KEY) || "0");
  if (!token || tokenRole !== role || tokenExp <= Math.floor(Date.now() / 1000) + 60) {
    return "";
  }
  return token;
}

function persistRoleToken(role, token, expiresAt) {
  if (typeof window === "undefined") return;
  window.localStorage?.setItem(ROLE_TOKEN_STORAGE_KEY, token);
  window.localStorage?.setItem(ROLE_TOKEN_ROLE_STORAGE_KEY, role);
  window.localStorage?.setItem(ROLE_TOKEN_EXP_STORAGE_KEY, String(expiresAt || 0));
}

export async function synchronizeRoleToken(apiBase, role = activeRole()) {
  const existing = storedRoleToken(role);
  if (existing) return existing;
  const response = await window.fetch(`${apiBase}/api/auth/demo-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role })
  });
  if (!response.ok) {
    throw new Error(`Unable to issue role token: ${response.status}`);
  }
  const payload = await response.json();
  persistRoleToken(payload.role || role, payload.token, payload.expiresAt);
  return payload.token;
}

export async function roleAuthHeaders(apiBase, role = activeRole()) {
  const token = await synchronizeRoleToken(apiBase, role);
  return token ? { Authorization: `Bearer ${token}` } : {};
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
