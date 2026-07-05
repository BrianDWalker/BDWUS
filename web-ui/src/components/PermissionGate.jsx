import React from "react";
import { activeRole, can, permissionMessage } from "../utils/permissions";

export function PermissionGate({ action, children, fallback = null }) {
  return can(action) ? children : fallback;
}

export function GatedButton({ action, children, onClick, className = "button", disabled = false, title, ...props }) {
  const allowed = can(action);
  const role = activeRole();
  return (
    <button
      {...props}
      className={className}
      type="button"
      disabled={disabled || !allowed}
      title={allowed ? title : permissionMessage(action, role)}
      aria-disabled={disabled || !allowed}
      onClick={allowed ? onClick : undefined}
    >
      {children}
    </button>
  );
}
