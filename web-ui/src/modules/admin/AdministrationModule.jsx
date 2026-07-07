import React, { useEffect, useState } from "react";
import { PageHeader } from "../../components/Shell";
import { DataTable, MetricCard, Panel, StatusTag, StructuredValueSummary, formatDateTime } from "../../components/Primitives";
import { fetchAdministrationSummary } from "../../utils/platformApi";
import { fetchAdminIntegrations, fetchAdminRoles, fetchAdminUsers } from "../../utils/opsApi";
import { createAdminIntegration, createAdminRole, createAdminUser } from "../../utils/opsMutations";
import { useProfileSettings } from "../../utils/profileSettings";

function TimelineList({ items }) {
  return (
    <div className="timeline">
      {items.map(item => (
        <div className="timeline-item" key={`${item.date}-${item.title}`}>
          <span className="timeline-dot"></span>
          <div><strong>{item.title}</strong><div className="small-muted">{formatDate(item.date)} · {item.body}</div></div>
          {item.status && <StatusTag tone={item.tone || "blue"}>{item.status}</StatusTag>}
        </div>
      ))}
    </div>
  );
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-";
}

export default function AdministrationModule({ setRoute, showToast }) {
  const [tab, setTab] = useState("Users");
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [profile, setProfile] = useProfileSettings();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadAdministration() {
    setLoading(true);
    setError("");
    try {
      const [summaryPayload, userRows, roleRows, integrationRows] = await Promise.all([
        fetchAdministrationSummary(),
        fetchAdminUsers(),
        fetchAdminRoles(),
        fetchAdminIntegrations()
      ]);
      setSummary(summaryPayload);
      setUsers(userRows || []);
      setRoles(roleRows || []);
      setIntegrations(integrationRows || []);
    } catch (err) {
      setError(err.message || "Unable to load administration data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdministration();
  }, []);

  async function createSample(kind) {
    setSaving(true);
    setError("");
    try {
      if (kind === "user") {
        await createAdminUser({ userName: `Platform User ${users.length + 1}`, email: `platform-user-${users.length + 1}@example.com`, roleName: "Operator", status: "Active" });
        showToast?.("Sample user created");
      } else if (kind === "role") {
        await createAdminRole({ roleName: `Role ${roles.length + 1}`, permissions: ["dashboard", "reports"], status: "Active" });
        showToast?.("Sample role created");
      } else if (kind === "integration") {
        await createAdminIntegration({ integrationName: `Integration ${integrations.length + 1}`, ownerName: "Platform", status: "Pending", detail: "Created from administration module" });
        showToast?.("Sample integration created");
      }
      await loadAdministration();
    } catch (err) {
      setError(err.message || "Unable to create administration record.");
    } finally {
      setSaving(false);
    }
  }

  const auditItems = [
    { date: "May 14, 2026", title: "Role updated", body: "Billing Analyst permissions changed", status: "Changed" },
    { date: "May 13, 2026", title: "Integration synced", body: "CRM Sync completed successfully", status: "Synced", tone: "success" },
    { date: "May 12, 2026", title: "User locked", body: "Inactive login detected", status: "Locked", tone: "warn" }
  ];

  return (
    <>
      <PageHeader
        title="Administration"
        description="Platform users, roles, integrations, audit, and system settings."
        actions={<button className="button" type="button" onClick={() => showToast?.("Administration settings opened")}>System Settings</button>}
      />
      {loading ? <div className="empty-state">Loading administration data…</div> : (
        <>
          <section className="overview-grid">
            <MetricCard label="Users" value={users.length} delta="Licensed accounts" />
            <MetricCard label="Roles" value={roles.length} delta="Permission sets" />
            <MetricCard label="Integrations" value={integrations.length} delta="Connected systems" />
            <MetricCard label="Pending approvals" value={summary?.controls?.pendingApprovals || 0} delta={summary?.platform?.environment || "environment"} />
          </section>
          <div className="record-tabs" role="tablist">
            {["Users", "Roles", "Integrations", "Audit", "Settings"].map(item => <button key={item} className={item === tab ? "active" : ""} type="button" onClick={() => setTab(item)}>{item}</button>)}
          </div>
          {tab === "Users" && (
            <section className="record-main-layout">
              <Panel title="Users" description="Operational user accounts and access state." action={<button className="ghost-button" type="button" disabled={saving} onClick={() => createSample("user")}>Create sample user</button>}>
                <DataTable columns={[{ key: "UserNumber", label: "User ID" }, { key: "UserName", label: "Name" }, { key: "RoleName", label: "Role" }, { key: "Status", label: "Status", render: row => <StatusTag tone={row.Status === "Active" ? "success" : "warn"}>{row.Status}</StatusTag> }, { key: "LastLoginAtUtc", label: "Last Login", render: row => formatDateTime(row.LastLoginAtUtc) }, { key: "details", label: "", render: row => <button className="link-button compact-action" type="button" onClick={() => setRoute?.(`details/record/${row.UserNumber}`)}>View</button> }]} rows={users} />
              </Panel>
              <section className="side-stack">
                <Panel title="Invite user" description="Add a new platform account.">
                  <div className="button-cluster">
                    <button className="button" type="button" disabled={saving} onClick={() => createSample("user")}>Invite</button>
                    <button className="ghost-button" type="button" onClick={() => showToast?.("SSO invitation copied")}>Copy invite</button>
                  </div>
                </Panel>
              </section>
            </section>
          )}
          {tab === "Roles" && <Panel title="Roles" description="Permission groups and access scope." action={<button className="ghost-button" type="button" disabled={saving} onClick={() => createSample("role")}>Create sample role</button>}><DataTable columns={[{ key: "RoleNumber", label: "Role ID" }, { key: "RoleName", label: "Role" }, { key: "PermissionsJson", label: "Permissions", render: row => <StructuredValueSummary value={row.PermissionsJson} empty="No permissions assigned" /> }, { key: "Status", label: "Status", render: row => <StatusTag tone={row.Status === "Active" ? "success" : "warn"}>{row.Status}</StatusTag> }]} rows={roles} /></Panel>}
          {tab === "Integrations" && <Panel title="Integrations" description="Platform connections and sync status." action={<button className="ghost-button" type="button" disabled={saving} onClick={() => createSample("integration")}>Create sample integration</button>}><DataTable columns={[{ key: "IntegrationNumber", label: "Integration ID" }, { key: "IntegrationName", label: "Integration" }, { key: "Detail", label: "Detail" }, { key: "OwnerName", label: "Owner" }, { key: "Status", label: "Status", render: row => <StatusTag tone={row.Status === "Connected" ? "success" : "warn"}>{row.Status}</StatusTag> }]} rows={integrations} /></Panel>}
          {tab === "Audit" && <Panel title="Audit" description="System actions and version history."><TimelineList items={auditItems} /></Panel>}
          {tab === "Settings" && (
            <section className="record-main-layout">
              <Panel title="Profile" description="Controls the identity shown in the top-right profile menu.">
                <div className="profile-settings-grid">
                  <div className="profile-settings-preview">
                    {profile.avatarUrl ? (
                      <img src={profile.avatarUrl} alt={profile.name} className="profile-settings-photo" />
                    ) : (
                      <div className="profile-settings-photo profile-settings-photo-fallback">{profile.name.split(" ").filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "?"}</div>
                    )}
                    <div>
                      <strong>{profile.name}</strong>
                      <span>{profile.role}</span>
                      <span>{profile.jobTitle}</span>
                      <span>{profile.email}</span>
                    </div>
                  </div>
                  <div className="profile-settings-form">
                    <label>
                      <span>Name</span>
                      <input value={profile.name} onChange={event => setProfile(current => ({ ...current, name: event.target.value }))} />
                    </label>
                    <label>
                      <span>Role</span>
                      <input value={profile.role} onChange={event => setProfile(current => ({ ...current, role: event.target.value }))} />
                    </label>
                    <label>
                      <span>Job title</span>
                      <input value={profile.jobTitle} onChange={event => setProfile(current => ({ ...current, jobTitle: event.target.value }))} />
                    </label>
                    <label>
                      <span>Email</span>
                      <input type="email" value={profile.email} onChange={event => setProfile(current => ({ ...current, email: event.target.value }))} />
                    </label>
                    <label>
                      <span>Profile picture URL</span>
                      <input value={profile.avatarUrl} onChange={event => setProfile(current => ({ ...current, avatarUrl: event.target.value }))} placeholder="https://..." />
                    </label>
                  </div>
                </div>
              </Panel>
              <Panel title="Settings" description="Platform defaults and governance controls.">
                <div className="field-grid">
                  <MetricCard label="Security" value="MFA required" delta="Policy" />
                  <MetricCard label="Session timeout" value="30 minutes" delta="Platform" />
                  <MetricCard label="Audit retention" value="7 years" delta="Governance" />
                  <MetricCard label="Release mode" value={summary?.platform?.environment || "Controlled"} delta={summary?.platform?.serviceName || "Platform API"} />
                </div>
              </Panel>
            </section>
          )}
        </>
      )}
    </>
  );
}
