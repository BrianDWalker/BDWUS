import React, { useContext } from "react";
import { PermissionRoleContext } from "./Shell";
import { activeRole, can, permissionMessage } from "../utils/permissions";

export function PermissionGate({ action, children, fallback = null }) {
  const role = useContext(PermissionRoleContext) || activeRole();
  return can(action, role) ? children : fallback;
}

export function GatedButton({ action, children, onClick, className = "button", disabled = false, title, ...props }) {
  const role = useContext(PermissionRoleContext) || activeRole();
  const allowed = can(action, role);
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
